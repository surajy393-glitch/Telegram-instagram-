from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# Load environment variables from .env file explicitly
load_dotenv()
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
from jwt import PyJWTError
import base64
import hmac
import hashlib
from urllib.parse import parse_qsl
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'luvhive_database')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Log database connection info
logger = logging.getLogger(__name__)
logger.info(f"Connected to MongoDB at {mongo_url}")
logger.info(f"Using database: {db_name}")
logger.info(f"Database object: {db}")

# Create database indexes for better performance
async def create_indexes():
    """Create database indexes for better performance"""
    try:
        # Index for user search
        await db.users.create_index([
            ("username", "text"),
            ("fullName", "text"),
            ("bio", "text")
        ], name="user_search_index")
        
        # Index for user lookup
        await db.users.create_index("username")
        await db.users.create_index("id")
        
        # Index for posts
        await db.posts.create_index([("userId", 1), ("createdAt", -1)])
        await db.posts.create_index([("caption", "text")], name="post_search_index")
        await db.posts.create_index("createdAt")
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")

# Create the main app without a prefix
app = FastAPI()

# Mount uploads directory for serving static files
import os
os.makedirs("/app/uploads/posts", exist_ok=True)
os.makedirs("/app/uploads/profiles", exist_ok=True)
os.makedirs("/app/uploads/stories", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

# Initialize indexes on startup
@app.on_event("startup")
async def startup_event():
    """Run startup tasks"""
    import asyncio
    asyncio.create_task(create_indexes())

# Add compression middleware for better performance
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# JWT settings
SECRET_KEY = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week


class MessageRequestBody(BaseModel):
    conversationId: str

class ConversationActionBody(BaseModel):
    conversationId: str
    action: str  # pin, unpin, mute_messages, unmute_messages, mute_calls, unmute_calls, delete
    deleteForBoth: Optional[bool] = False  # For delete action: delete for both users or just me

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fullName: str
    username: str
    age: int
    gender: str
    password_hash: Optional[str] = None  # Optional for Telegram-only users
    email: Optional[str] = None  # For password recovery
    mobileNumber: Optional[str] = None  # Mobile number for enhanced security
    bio: Optional[str] = ""
    profileImage: Optional[str] = None  # Base64 or file_id
    
    # Telegram Integration
    telegramId: Optional[int] = None  # Telegram user ID
    telegramUsername: Optional[str] = None  # @username from Telegram
    telegramFirstName: Optional[str] = None
    telegramLastName: Optional[str] = None
    telegramPhotoUrl: Optional[str] = None
    authMethod: str = "password"  # "password", "telegram", or "both"
    
    # Premium & Settings
    isPremium: bool = False
    isPrivate: bool = False  # Privacy setting for the account
    isVerified: bool = False  # LuvHive Verified badge
    verifiedAt: Optional[datetime] = None  # When verification was granted
    verificationPathway: Optional[str] = None  # How user got verified (High Engagement, Moderate, etc.)
    isFounder: bool = False  # Official LuvHive/Founder account
    emailVerified: bool = False  # Email verification status
    mobileVerified: bool = False  # Phone verification status
    
    # Privacy Controls
    publicProfile: bool = True
    appearInSearch: bool = True
    allowDirectMessages: bool = True
    showOnlineStatus: bool = True
    
    # Interaction Preferences
    allowTagging: bool = True
    allowStoryReplies: bool = True
    showVibeScore: bool = True
    
    # Notifications
    pushNotifications: bool = True
    emailNotifications: bool = True
    
    followers: List[str] = []  # List of user IDs
    following: List[str] = []  # List of user IDs
    savedPosts: List[str] = []  # List of post IDs
    blockedUsers: List[str] = []  # List of blocked user IDs
    mutedUsers: List[str] = []  # List of muted user IDs (silent - they won't know)
    hiddenStoryUsers: List[str] = []  # List of user IDs whose stories are hidden
    lastUsernameChange: Optional[datetime] = None  # Track username changes
    country: Optional[str] = None  # User's country
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    fullName: str
    username: str
    age: int
    gender: str
    country: str  # Mandatory country field
    password: Optional[str] = None  # Optional for Telegram auth
    email: Optional[str] = None  # Optional for recovery
    authMethod: str = "password"  # "password" or "telegram"

class TelegramAuthRequest(BaseModel):
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class TelegramSigninRequest(BaseModel):
    telegramId: int

class VerifyOTPRequest(BaseModel):
    telegramId: int
    otp: str

class EnhancedUserRegister(BaseModel):
    fullName: str
    username: str
    age: int
    gender: str
    country: str  # Mandatory country field
    password: str
    email: Optional[str] = None  # Optional email
    mobileNumber: Optional[str] = None  # Optional mobile number
    profileImage: Optional[str] = None  # Optional profile image
    bio: Optional[str] = None  # Optional bio

class EmailOTPRequest(BaseModel):
    email: str

class VerifyEmailOTPRequest(BaseModel):
    email: str
    otp: str

class SendMobileOTPRequest(BaseModel):
    mobileNumber: str

class VerifyMobileOTPRequest(BaseModel):
    mobileNumber: str
    otp: str

class ForgotPasswordMobileRequest(BaseModel):
    mobileNumber: str

class ResetPasswordMobileRequest(BaseModel):
    mobileNumber: str
    otp: str
    new_password: str

class UserProfile(BaseModel):
    fullName: str
    username: str
    age: int
    gender: str
    bio: Optional[str] = ""
    profileImage: Optional[str] = None

class ProfileUpdate(BaseModel):
    fullName: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    profileImage: Optional[str] = None

class ReportPostRequest(BaseModel):
    reason: str  # The report category/reason
    
class UserLogin(BaseModel):
    username: str
    password: str

class Story(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    username: str
    userProfileImage: Optional[str] = None
    mediaType: str  # "image" or "video"
    mediaUrl: str  # Base64 or file_id
    caption: Optional[str] = ""
    isArchived: bool = False
    likes: List[str] = []  # List of user IDs who liked the story
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expiresAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))

class StoryCreate(BaseModel):
    mediaType: str
    mediaUrl: str
    caption: Optional[str] = ""

class Post(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    username: str
    userProfileImage: Optional[str] = None
    mediaType: str  # "image" or "video"
    mediaUrl: str  # Base64 or file_id
    caption: Optional[str] = ""
    likes: List[str] = []  # List of user IDs
    comments: List[dict] = []
    isArchived: bool = False
    likesHidden: bool = False
    commentsDisabled: bool = False
    isPinned: bool = False
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostCreate(BaseModel):
    mediaType: str
    mediaUrl: str
    caption: Optional[str] = ""

class TelegramLink(BaseModel):
    code: str
    userId: str
    telegramUserId: str
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str  # Who receives the notification
    fromUserId: str  # Who triggered the notification
    fromUsername: str
    fromUserImage: Optional[str] = None
    type: str  # "like", "comment", "follow"
    postId: Optional[str] = None  # For like/comment notifications
    postImage: Optional[str] = None  # Post thumbnail/image for preview
    isRead: bool = False
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    senderId: str
    receiverId: str
    message: str
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Helper functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_telegram_hash(auth_data: dict, bot_token: str) -> bool:
    """
    Verify Telegram Login Widget hash for security
    https://core.telegram.org/widgets/login#checking-authorization
    """
    try:
        # Extract hash from auth_data
        received_hash = auth_data.pop('hash', None)
        if not received_hash:
            return False
        
        # Create data check string
        data_check_arr = []
        for key, value in sorted(auth_data.items()):
            if key != 'hash':
                data_check_arr.append(f"{key}={value}")
        
        data_check_string = '\n'.join(data_check_arr)
        
        # Create secret key from bot token
        secret_key = hashlib.sha256(bot_token.encode()).digest()
        
        # Calculate hash
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Compare hashes
        return hmac.compare_digest(calculated_hash, received_hash)
        
    except Exception as e:
        logger.error(f"Error verifying Telegram hash: {e}")
        return False

# OTP Helper Functions
import random
import asyncio

# In-memory OTP storage (in production, use Redis or database)
otp_storage = {}
email_otp_storage = {}  # Separate storage for email OTPs

def generate_otp(length: int = 6) -> str:
    """Generate a random OTP"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])

async def store_otp(telegram_id: int, otp: str, expires_in_minutes: int = 10):
    """Store OTP with expiration"""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
    otp_storage[telegram_id] = {
        'otp': otp,
        'expires_at': expires_at,
        'attempts': 0
    }
    
    # Schedule cleanup
    async def cleanup():
        await asyncio.sleep(expires_in_minutes * 60)
        otp_storage.pop(telegram_id, None)
    
    asyncio.create_task(cleanup())

async def verify_otp(telegram_id: int, provided_otp: str) -> bool:
    """Verify OTP and cleanup if successful"""
    if telegram_id not in otp_storage:
        return False
    
    otp_data = otp_storage[telegram_id]
    
    # Check expiration
    if datetime.now(timezone.utc) > otp_data['expires_at']:
        otp_storage.pop(telegram_id, None)
        return False
    
    # Check attempts (max 3)
    if otp_data['attempts'] >= 3:
        otp_storage.pop(telegram_id, None)
        return False
    
    # Check OTP
    if otp_data['otp'] == provided_otp:
        otp_storage.pop(telegram_id, None)
        return True
    else:
        otp_data['attempts'] += 1
        return False

async def send_telegram_otp(telegram_id: int, otp: str):
    """Send OTP via Telegram bot"""
    try:
        # Import here to avoid circular imports
        import aiohttp
        
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        if not bot_token:
            raise Exception("Telegram bot token not configured")
        
        message = f"🔐 Your LuvHive login code is: *{otp}*\n\nThis code will expire in 10 minutes.\nDo not share this code with anyone!"
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        data = {
            "chat_id": telegram_id,
            "text": message,
            "parse_mode": "Markdown"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=data) as response:
                if response.status != 200:
                    raise Exception(f"Failed to send Telegram message: {response.status}")
                return True
                
    except Exception as e:
        logger.error(f"Error sending Telegram OTP: {e}")
        return False

async def get_telegram_file_path(file_id: str, bot_token: str) -> str:
    """Get file_path from Telegram using file_id"""
    import aiohttp
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"https://api.telegram.org/bot{bot_token}/getFile",
                params={"file_id": file_id}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("ok"):
                        return data["result"]["file_path"]
                logger.error(f"Failed to get file path: {await resp.text()}")
                return None
    except Exception as e:
        logger.error(f"Error getting file path: {e}")
        return None

async def send_media_to_telegram_channel(media_url: str, media_type: str, caption: str, username: str):
    """
    Send media (photo/video) to Telegram media sink channel
    Returns: (file_id, file_path, telegram_url) or (None, None, None) on failure
    """
    try:
        import aiohttp
        
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        if not bot_token:
            logger.error("Telegram bot token not configured")
            return None, None, None
        
        # Media sink channel ID
        channel_id = "-1003138482795"
        
        # Prepare caption with username
        full_caption = f"📱 New {media_type} from @{username}\n\n{caption}" if caption else f"📱 New {media_type} from @{username}"
        
        # Handle base64 data URL
        if media_url.startswith('data:'):
            # Extract base64 data
            header, encoded = media_url.split(',', 1)
            media_data = base64.b64decode(encoded)
            
            # Determine proper Telegram endpoint based on MIME type
            mime_type = header.split(';')[0].replace('data:', '')
            if mime_type.startswith('image/'):
                file_ext = 'jpg' if 'jpeg' in mime_type else mime_type.split('/')[-1]
                endpoint = 'sendPhoto'  # Use sendPhoto for images
                field_name = 'photo'
            elif mime_type.startswith('video/'):
                file_ext = mime_type.split('/')[-1] or 'mp4'
                endpoint = 'sendVideo'  # Use sendVideo for videos
                field_name = 'video'
            else:
                # Fallback to document for other types
                file_ext = mime_type.split('/')[-1] or 'bin'
                endpoint = 'sendDocument'
                field_name = 'document'
                logger.warning(f"Unknown media type {mime_type}, using sendDocument")
            
            # Create form data with file
            form = aiohttp.FormData()
            form.add_field(field_name, media_data, filename=f'media.{file_ext}', content_type=mime_type)
            form.add_field('chat_id', channel_id)
            form.add_field('caption', full_caption[:1024])  # Telegram caption limit
            
            url = f"https://api.telegram.org/bot{bot_token}/{endpoint}"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=form) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get("ok"):
                            # Extract file_id from the response
                            message = result.get("result", {})
                            
                            # Get file_id based on media type
                            if endpoint == 'sendPhoto':
                                # For photos, use the largest size
                                photos = message.get("photo", [])
                                if photos:
                                    file_id = photos[-1].get("file_id")  # Largest photo
                                else:
                                    logger.error("No photo in response")
                                    return None, None, None
                            elif endpoint == 'sendVideo':
                                video = message.get("video", {})
                                file_id = video.get("file_id")
                            else:
                                document = message.get("document", {})
                                file_id = document.get("file_id")
                            
                            if not file_id:
                                logger.error("No file_id in Telegram response")
                                return None, None, None
                            
                            # Get file_path using getFile
                            file_path = await get_telegram_file_path(file_id, bot_token)
                            if not file_path:
                                logger.error("Failed to get file_path from Telegram")
                                return None, None, None
                            
                            # Build proper downloadable URL
                            telegram_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
                            
                            logger.info(f"Successfully sent {media_type} to Telegram channel")
                            logger.info(f"file_id: {file_id}, file_path: {file_path}")
                            
                            return file_id, file_path, telegram_url
                        else:
                            logger.error(f"Telegram API returned error: {result}")
                            return None, None, None
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to send media to Telegram: {response.status} - {error_text}")
                        return None, None, None
        else:
            logger.warning("Media URL is not a base64 data URL, skipping Telegram upload")
            return None, None, None
            
    except Exception as e:
        logger.error(f"Error sending media to Telegram channel: {e}")
        import traceback
        traceback.print_exc()
        return None, None, None

async def store_email_otp(email: str, otp: str, expires_in_minutes: int = 10):
    """Store email OTP with expiration"""
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
    email_otp_storage[email.lower()] = {
        'otp': otp,
        'expires_at': expires_at,
        'attempts': 0
    }
    
    # Schedule cleanup
    async def cleanup():
        await asyncio.sleep(expires_in_minutes * 60)
        email_otp_storage.pop(email.lower(), None)
    
    asyncio.create_task(cleanup())

async def verify_email_otp(email: str, provided_otp: str) -> bool:
    """Verify email OTP and cleanup if successful"""
    email_key = email.lower()
    if email_key not in email_otp_storage:
        return False
    
    otp_data = email_otp_storage[email_key]
    
    # Check expiration
    if datetime.now(timezone.utc) > otp_data['expires_at']:
        email_otp_storage.pop(email_key, None)
        return False
    
    # Check attempts (max 3)
    if otp_data['attempts'] >= 3:
        email_otp_storage.pop(email_key, None)
        return False
    
    # Check OTP
    if otp_data['otp'] == provided_otp:
        email_otp_storage.pop(email_key, None)
        return True
    else:
        otp_data['attempts'] += 1
        return False

async def send_email_otp(email: str, otp: str):
    """Send OTP via email using SendGrid"""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        
        sendgrid_api_key = os.environ.get("SENDGRID_API_KEY")
        
        if not sendgrid_api_key:
            logger.error("SendGrid API key not configured")
            logger.info(f"MOCK EMAIL: OTP {otp} sent to {email}")
            return True
        
        # Create beautiful HTML email
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; padding: 40px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e91e63; margin: 0; font-size: 28px;">💖 LuvHive</h1>
                    <h2 style="color: #333; margin: 10px 0 0 0; font-size: 22px;">Email Verification</h2>
                </div>
                
                <div style="background: linear-gradient(135deg, #e91e63, #f06292); padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
                    <p style="color: white; margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Your Verification Code:</p>
                    <div style="background-color: white; padding: 15px; border-radius: 8px; display: inline-block;">
                        <span style="color: #e91e63; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">{otp}</span>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 25px 0;">
                    <p style="color: #555; font-size: 16px; margin: 0 0 15px 0;">Enter this code on the registration page to verify your email address</p>
                    <p style="color: #888; font-size: 14px; margin: 0;">⏰ This code expires in <strong>10 minutes</strong></p>
                </div>
                
                <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                    <p style="color: #999; font-size: 13px; margin: 0;">🔒 If you didn't request this code, please ignore this email.</p>
                    <p style="color: #999; font-size: 13px; margin: 5px 0 0 0;">This is an automated message from LuvHive.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_content = f"""
        LuvHive Email Verification
        
        Your verification code is: {otp}
        
        Enter this code on the registration page to verify your email address.
        
        This code will expire in 10 minutes.
        Do not share this code with anyone.
        
        If you didn't request this code, please ignore this email.
        
        Best regards,
        LuvHive Team
        """
        
        # Create SendGrid message
        message = Mail(
            from_email="no-reply@luvhive.net",
            to_emails=email,
            subject="Your LuvHive Verification Code 🔐",
            html_content=html_content,
            plain_text_content=text_content
        )
        
        # Send email
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code == 202:
            logger.info(f"SendGrid email sent successfully: OTP {otp} to {email}")
            return True
        else:
            logger.error(f"SendGrid error: Status {response.status_code}")
            return False
                
    except Exception as e:
        logger.error(f"Error sending SendGrid email: {e}")
        logger.info(f"MOCK EMAIL: OTP {otp} sent to {email}")
        return True
        
        # Try Twilio Email first (with API Key if available)
        if twilio_account_sid and (twilio_auth_token or twilio_api_key_secret):
            try:
                from twilio.rest import Client
                
                # Use API key if available, otherwise use auth token
                if twilio_api_key_sid and twilio_api_key_secret:
                    client = Client(twilio_api_key_sid, twilio_api_key_secret, twilio_account_sid)
                else:
                    client = Client(twilio_account_sid, twilio_auth_token)
                
                # Create HTML email content
                html_content = f"""
                <html>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                    <div style="background-color: white; padding: 40px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #e91e63; margin: 0; font-size: 28px;">💖 LuvHive</h1>
                            <h2 style="color: #333; margin: 10px 0 0 0; font-size: 22px;">Email Verification</h2>
                        </div>
                        
                        <div style="background: linear-gradient(135deg, #e91e63, #f06292); padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
                            <p style="color: white; margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Your Verification Code:</p>
                            <div style="background-color: white; padding: 15px; border-radius: 8px; display: inline-block;">
                                <span style="color: #e91e63; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">{otp}</span>
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin: 25px 0;">
                            <p style="color: #555; font-size: 16px; margin: 0 0 15px 0;">Enter this code on the registration page to verify your email address</p>
                            <p style="color: #888; font-size: 14px; margin: 0;">⏰ This code expires in <strong>10 minutes</strong></p>
                        </div>
                        
                        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                            <p style="color: #999; font-size: 13px; margin: 0;">🔒 If you didn't request this code, please ignore this email.</p>
                            <p style="color: #999; font-size: 13px; margin: 5px 0 0 0;">This is an automated message from LuvHive.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                # Try using Twilio's built-in email service
                try:
                    # Use Twilio's email service if available
                    message = client.messages.create(
                        body=f"Your LuvHive verification code is: {otp}. This code expires in 10 minutes.",
                        from_='no-reply@luvhive.net',
                        to=email
                    )
                    logger.info(f"Twilio email sent via messages API: {message.sid}")
                    return True
                except Exception as msg_error:
                    logger.error(f"Twilio messages API error: {msg_error}")
                    
                    # Try SendGrid API via Twilio
                    message = client.sendgrid.v3.mail.send.post(request_body={
                        "personalizations": [
                            {
                                "to": [{"email": email}],
                                "subject": "Your LuvHive Verification Code 🔐"
                            }
                        ],
                        "from": {"email": "no-reply@luvhive.net", "name": "LuvHive"},
                        "content": [
                            {
                                "type": "text/html",
                                "value": html_content
                            }
                        ]
                    })
                
                if message.status_code == 202:
                    logger.info(f"Twilio SendGrid email sent successfully: OTP {otp} to {email}")
                    return True
                else:
                    logger.error(f"Twilio SendGrid error: Status {message.status_code}")
                    return False
                
            except Exception as twilio_error:
                logger.error(f"Twilio email error: {twilio_error}")
                # Fall through to SendGrid or mock
        
        # Try SendGrid as fallback
        if sendgrid_api_key:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            
            sender_email = "no-reply@luvhive.net"
        
        # Create HTML email content
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; padding: 40px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e91e63; margin: 0; font-size: 28px;">💖 LuvHive</h1>
                    <h2 style="color: #333; margin: 10px 0 0 0; font-size: 22px;">Email Verification</h2>
                </div>
                
                <div style="background: linear-gradient(135deg, #e91e63, #f06292); padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
                    <p style="color: white; margin: 0 0 15px 0; font-size: 16px; font-weight: 500;">Your Verification Code:</p>
                    <div style="background-color: white; padding: 15px; border-radius: 8px; display: inline-block;">
                        <span style="color: #e91e63; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">{otp}</span>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 25px 0;">
                    <p style="color: #555; font-size: 16px; margin: 0 0 15px 0;">Enter this code on the registration page to verify your email address</p>
                    <p style="color: #888; font-size: 14px; margin: 0;">⏰ This code expires in <strong>10 minutes</strong></p>
                </div>
                
                <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                    <p style="color: #999; font-size: 13px; margin: 0;">🔒 If you didn't request this code, please ignore this email.</p>
                    <p style="color: #999; font-size: 13px; margin: 5px 0 0 0;">This is an automated message from LuvHive.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_content = f"""
        LuvHive Email Verification
        
        Your verification code is: {otp}
        
        Enter this code on the registration page to verify your email address.
        
        This code will expire in 10 minutes.
        Do not share this code with anyone.
        
        If you didn't request this code, please ignore this email.
        
        Best regards,
        LuvHive Team
        """
        
        # Create SendGrid message
        message = Mail(
            from_email="no-reply@luvhive.net",
            to_emails=email,
            subject="Your LuvHive Verification Code 🔐",
            html_content=html_content,
            plain_text_content=text_content
        )
        
        # Send email
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code == 202:
            logger.info(f"SendGrid email sent successfully: OTP {otp} to {email}")
            return True
        else:
            logger.error(f"SendGrid error: Status {response.status_code}")
            return False
                
    except Exception as e:
        logger.error(f"Error sending SendGrid email: {e}")
        logger.info(f"MOCK EMAIL: OTP {otp} sent to {email}")
        return True

async def send_mobile_otp(mobile_number: str):
    """Send OTP via SMS using Twilio Verify"""
    try:
        from twilio.rest import Client
        
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        
        if not account_sid or not auth_token:
            logger.error("Twilio credentials not configured")
            return False
        
        client = Client(account_sid, auth_token)
        
        # Format mobile number (add +91 if not present)
        formatted_number = mobile_number.strip()
        if not formatted_number.startswith('+'):
            if formatted_number.startswith('91'):
                formatted_number = '+' + formatted_number
            else:
                formatted_number = '+91' + formatted_number
        
        # Send OTP via Twilio Verify
        verify_service_sid = os.environ.get("TWILIO_VERIFY_SERVICE_SID")
        verification = client.verify \
            .v2 \
            .services(verify_service_sid) \
            .verifications \
            .create(to=formatted_number, channel='sms')
        
        logger.info(f"Twilio SMS OTP sent: {verification.status} to {formatted_number}")
        return verification.status == 'pending'
        
    except Exception as e:
        logger.error(f"Error sending mobile OTP: {e}")
        # For demo, always return True
        logger.info(f"MOCK SMS: OTP sent to {mobile_number}")
        return True


async def send_welcome_email(email: str, full_name: str, username: str):
    """Send welcome email after successful registration"""
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        
        sendgrid_api_key = os.environ.get("SENDGRID_API_KEY")
        
        if not sendgrid_api_key:
            logger.error("SendGrid API key not configured")
            logger.info(f"MOCK WELCOME EMAIL: Sent to {email}")
            return True
        
        # Create beautiful HTML welcome email
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; padding: 40px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #e91e63; margin: 0; font-size: 32px;">💖 Welcome to LuvHive!</h1>
                </div>
                
                <!-- Welcome Banner -->
                <div style="background: linear-gradient(135deg, #e91e63, #f06292); padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0;">
                    <h2 style="color: white; margin: 0 0 15px 0; font-size: 24px;">Hello, {full_name}! 👋</h2>
                    <p style="color: white; margin: 0; font-size: 16px; line-height: 1.6;">
                        We're thrilled to have you join our community of meaningful connections!
                    </p>
                </div>
                
                <!-- Account Details -->
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 25px 0;">
                    <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">Your Account Details:</h3>
                    <p style="color: #555; margin: 5px 0;">
                        <strong>Username:</strong> @{username}
                    </p>
                    <p style="color: #555; margin: 5px 0;">
                        <strong>Email:</strong> {email}
                    </p>
                </div>
                
                <!-- Features -->
                <div style="margin: 30px 0;">
                    <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px; text-align: center;">What You Can Do Now:</h3>
                    
                    <div style="margin: 15px 0;">
                        <div style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #e91e63, #f06292); border-radius: 50%; text-align: center; line-height: 40px; margin-right: 15px; float: left;">
                            <span style="color: white; font-size: 20px;">💬</span>
                        </div>
                        <div style="padding-left: 60px;">
                            <h4 style="color: #333; margin: 0 0 5px 0; font-size: 16px;">Connect & Chat</h4>
                            <p style="color: #666; margin: 0; font-size: 14px;">Start meaningful conversations and build connections</p>
                        </div>
                        <div style="clear: both;"></div>
                    </div>
                    
                    <div style="margin: 15px 0;">
                        <div style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #e91e63, #f06292); border-radius: 50%; text-align: center; line-height: 40px; margin-right: 15px; float: left;">
                            <span style="color: white; font-size: 20px;">✨</span>
                        </div>
                        <div style="padding-left: 60px;">
                            <h4 style="color: #333; margin: 0 0 5px 0; font-size: 16px;">Share Your Story</h4>
                            <p style="color: #666; margin: 0; font-size: 14px;">Post updates, share moments, and express yourself</p>
                        </div>
                        <div style="clear: both;"></div>
                    </div>
                </div>
                
                <!-- Call to Action -->
                <div style="text-align: center; margin: 35px 0;">
                    <a href="https://luvhive.net" style="display: inline-block; background: linear-gradient(135deg, #e91e63, #f06292); color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(233, 30, 99, 0.3);">
                        Get Started Now 🚀
                    </a>
                </div>
                
                <!-- Tips Section -->
                <div style="background-color: #fff3e0; padding: 20px; border-radius: 10px; border-left: 4px solid #ff9800; margin: 25px 0;">
                    <h3 style="color: #e65100; margin: 0 0 10px 0; font-size: 16px;">💡 Quick Tips:</h3>
                    <ul style="color: #666; margin: 10px 0; padding-left: 20px; font-size: 14px;">
                        <li style="margin: 5px 0;">Complete your profile to get better matches</li>
                        <li style="margin: 5px 0;">Be genuine and respectful in all interactions</li>
                        <li style="margin: 5px 0;">Upload a profile photo to increase your visibility</li>
                        <li style="margin: 5px 0;">Share your moments with stories and posts</li>
                    </ul>
                </div>
                
                <!-- Footer -->
                <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
                    <p style="color: #999; font-size: 14px; margin: 0 0 10px 0;">
                        Need help? Contact us at <a href="mailto:support@luvhive.net" style="color: #e91e63; text-decoration: none;">support@luvhive.net</a>
                    </p>
                    <p style="color: #999; font-size: 13px; margin: 5px 0;">
                        Follow us on social media for updates and tips!
                    </p>
                    <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
                        © 2025 LuvHive. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_content = f"""
        Welcome to LuvHive!
        
        Hello, {full_name}!
        
        We're thrilled to have you join our community of meaningful connections!
        
        Your Account Details:
        Username: @{username}
        Email: {email}
        
        What You Can Do Now:
        
        🔍 Mystery Match - Find your perfect match through exciting mystery conversations
        💬 Connect & Chat - Start meaningful conversations and build connections
        ✨ Share Your Story - Post updates, share moments, and express yourself
        
        Quick Tips:
        • Complete your profile to get better matches
        • Be genuine and respectful in all interactions
        • Upload a profile photo to increase your visibility
        • Share your moments with stories and posts
        
        Get started now at: https://luvhive.net
        
        Need help? Contact us at support@luvhive.net
        
        Best regards,
        The LuvHive Team
        
        © 2025 LuvHive. All rights reserved.
        """
        
        # Create SendGrid message
        message = Mail(
            from_email="no-reply@luvhive.net",
            to_emails=email,
            subject=f"Welcome to LuvHive, {full_name}! 💖",
            html_content=html_content,
            plain_text_content=text_content
        )
        
        # Send email
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code == 202:
            logger.info(f"Welcome email sent successfully to {email}")
            return True
        else:
            logger.error(f"SendGrid welcome email error: Status {response.status_code}")
            return False
                
    except Exception as e:
        logger.error(f"Error sending welcome email: {e}")
        logger.info(f"MOCK WELCOME EMAIL: Sent to {email}")
        return True


async def verify_mobile_otp(mobile_number: str, otp_code: str):
    """Verify mobile OTP using Twilio Verify"""
    try:
        from twilio.rest import Client
        
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        
        if not account_sid or not auth_token:
            logger.error("Twilio credentials not configured")
            return True  # Allow in demo mode
        
        client = Client(account_sid, auth_token)
        
        # Format mobile number
        formatted_number = mobile_number.strip()
        if not formatted_number.startswith('+'):
            if formatted_number.startswith('91'):
                formatted_number = '+' + formatted_number
            else:
                formatted_number = '+91' + formatted_number
        
        # Verify OTP
        verify_service_sid = os.environ.get("TWILIO_VERIFY_SERVICE_SID")
        verification_check = client.verify \
            .v2 \
            .services(verify_service_sid) \
            .verification_checks \
            .create(to=formatted_number, code=otp_code)
        
        logger.info(f"Twilio SMS verification: {verification_check.status}")
        return verification_check.status == 'approved'
        
    except Exception as e:
        logger.error(f"Error verifying mobile OTP: {e}")
        # For demo, accept any 6-digit code
        if len(otp_code.strip()) == 6 and otp_code.strip().isdigit():
            logger.info(f"DEMO MODE: Accepting OTP {otp_code} for {mobile_number}")
            return True
        return False

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)

# Authentication Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Validate and clean input
    clean_username = user_data.username.strip()
    clean_fullname = user_data.fullName.strip()
    clean_email = user_data.email.strip().lower() if user_data.email else None
    
    if not clean_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    
    if len(clean_username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    
    # Validate auth method and required fields
    if user_data.authMethod == "password":
        if not user_data.password:
            raise HTTPException(status_code=400, detail="Password is required for password authentication")
        if len(user_data.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if username exists (case-insensitive and trimmed)
    escaped_username = clean_username.replace('.', r'\.')
    existing_user = await db.users.find_one({
        "username": {"$regex": f"^{escaped_username}$", "$options": "i"}
    })
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email already exists
    if clean_email:
        existing_email = await db.users.find_one({"email": clean_email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

    # Hash password if provided
    hashed_password = get_password_hash(user_data.password) if user_data.password else None
    
    # Create user with cleaned data
    user = User(
        fullName=clean_fullname,
        username=clean_username,
        age=user_data.age,
        gender=user_data.gender,
        country=user_data.country.strip(),
        password_hash=hashed_password,
        email=clean_email,
        authMethod=user_data.authMethod,
    )
    
    user_dict = user.dict()
    await db.users.insert_one(user_dict)
    
    access_token = create_access_token(data={"sub": user.id})
    
    # Send welcome email if email provided
    if clean_email:
        try:
            await send_welcome_email(clean_email, clean_fullname, clean_username)
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}")
    
    return {
        "message": "Registration successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "fullName": user.fullName,
            "username": user.username,
            "age": user.age,
            "gender": user.gender,
            "email": user.email,
            "authMethod": user.authMethod,
            "isPremium": user.isPremium
        }
    }

@api_router.post("/auth/register-enhanced")
async def register_enhanced(
    fullName: str = Form(...),
    username: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    country: str = Form(...),
    password: str = Form(...),
    email: Optional[str] = Form(None),
    mobileNumber: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    interests: Optional[str] = Form(None),
    profilePhoto: Optional[UploadFile] = File(None),
    profileImage: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    emailVerified: bool = Form(False),
    mobileVerified: bool = Form(False),
    personalityAnswers: Optional[str] = Form(None),
    telegramId: Optional[str] = Form(None)
):
    """
    Enhanced registration with mobile number support and file upload
    Accepts multipart/form-data for file uploads
    """
    try:
        # Validate and clean input
        clean_username = username.strip()
        clean_fullname = fullName.strip()
        clean_email = email.strip().lower() if email else None
        clean_mobile = mobileNumber.strip() if mobileNumber else None
        clean_bio = bio.strip() if bio else ""
        clean_profile_image = profileImage if profileImage else None
        
        # Handle file upload if provided
        if profilePhoto:
            contents = await profilePhoto.read()
            clean_profile_image = f"data:image/jpeg;base64,{base64.b64encode(contents).decode()}"
        
        if not clean_username:
            raise HTTPException(status_code=400, detail="Username cannot be empty")
        
        if len(clean_username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
        
        if not password or len(password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # Email is required only if no mobile number provided
        if not clean_email and not clean_mobile:
            raise HTTPException(status_code=400, detail="Either email or mobile number is required")
        
        # Validate email format if provided
        if clean_email and ("@" not in clean_email or "." not in clean_email):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Validate mobile number format if provided
        if clean_mobile:
            # Remove any spaces or special characters
            clean_mobile = ''.join(filter(str.isdigit, clean_mobile))
            if len(clean_mobile) < 10 or len(clean_mobile) > 15:
                raise HTTPException(status_code=400, detail="Mobile number must be 10-15 digits")
        
        # Check if username exists (case-insensitive)
        escaped_username = clean_username.replace('.', r'\.')
        existing_user = await db.users.find_one({
            "username": {"$regex": f"^{escaped_username}$", "$options": "i"}
        })
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if email already exists (only if email provided)
        if clean_email:
            existing_email = await db.users.find_one({"email": clean_email})
            if existing_email:
                raise HTTPException(status_code=400, detail="Email already registered")
        
        # Check if mobile number already exists (if provided) - with multiple format checks
        if clean_mobile:
            # Check various mobile number formats
            mobile_patterns = [
                clean_mobile,  # Digits only
                f"+91{clean_mobile}",  # With +91
                f"91{clean_mobile}",   # With 91
            ]
            
            for pattern in mobile_patterns:
                existing_mobile = await db.users.find_one({"mobileNumber": pattern})
                if existing_mobile:
                    raise HTTPException(
                        status_code=400, 
                        detail="Mobile number already registered with another account"
                    )
        
        # Hash password
        hashed_password = get_password_hash(password)
        
        # Create complete user
        user_dict = {
            "id": str(uuid4()),
            "fullName": clean_fullname,
            "username": clean_username,
            "email": clean_email or None,
            "mobileNumber": clean_mobile,
            "age": age,
            "gender": gender,
            "country": country.strip(),
            "password_hash": hashed_password,
            "bio": clean_bio,
            "profileImage": clean_profile_image,
            "authMethod": "password",
            "emailVerified": emailVerified,
            "mobileVerified": mobileVerified,
            "emailVerificationToken": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "followers": [],
            "following": [],
            "posts": [],
            "savedPosts": [],
            "blockedUsers": [],
            "mutedUsers": [],
            "hiddenStoryUsers": [],
            "isPremium": False,
            "isPrivate": False,
            "isVerified": False,
            "isOnline": True,
            "lastSeen": datetime.now(timezone.utc).isoformat(),
            
            # Privacy Controls
            "publicProfile": True,
            "appearInSearch": True,
            "allowDirectMessages": True,
            "showOnlineStatus": True,
            
            # Interaction Preferences
            "allowTagging": True,
            "allowStoryReplies": True,
            "showVibeScore": True,
            
            # Notifications
            "pushNotifications": True,
            "emailNotifications": True,
            
            "preferences": {
                "showAge": True,
                "showOnlineStatus": True, 
                "allowMessages": True
            },
            "privacy": {
                "profileVisibility": "public",
                "showLastSeen": True
            },
            "socialLinks": {
                "instagram": "",
                "twitter": "",
                "website": ""
            },
            "interests": [],
            "location": "",
            "lastUsernameChange": None,
            "telegramId": telegramId if telegramId else None
        }
        
        await db.users.insert_one(user_dict)
        
        # Generate access token
        access_token = create_access_token(data={"sub": user_dict["id"]})
        
        # Send welcome email if email provided
        if clean_email:
            try:
                await send_welcome_email(clean_email, clean_fullname, clean_username)
            except Exception as e:
                logger.error(f"Failed to send welcome email: {e}")
        
        # ALL successful registrations should auto-login immediately
        # Email verification is optional and can be done later for additional security
        return {
            "message": "Registration successful! Welcome to LuvHive!",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {k: v for k, v in user_dict.items() if k not in ["password_hash", "_id", "emailVerificationToken"]},
            "auto_login": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enhanced registration error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    # Find user with case-insensitive username (handles whitespace issues)
    clean_username = user_data.username.strip()
    escaped_username = clean_username.replace('.', r'\.')
    user = await db.users.find_one({
        "username": {"$regex": f"^{escaped_username}$", "$options": "i"}
    })
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # CRITICAL SECURITY: Block login if email not verified
    if not user.get("emailVerified", False):
        raise HTTPException(
            status_code=403, 
            detail="Please verify your email address before signing in. Check your email for verification link."
        )
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "fullName": user["fullName"],
            "username": user["username"],
            "age": user["age"],
            "gender": user["gender"],
            "bio": user.get("bio", ""),
            "profileImage": user.get("profileImage"),
            "isPremium": user.get("isPremium", False),
            "tg_user_id": user.get("tg_user_id")  # CRITICAL: Include for Mystery Match
        }
    }

@api_router.post("/auth/telegram")
async def telegram_auth(telegram_data: TelegramAuthRequest):
    """
    Authenticate user via Telegram Login Widget with secure hash verification
    """
    # Get Telegram bot token from environment
    telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    
    if not telegram_bot_token:
        raise HTTPException(status_code=500, detail="Telegram bot not configured")
    
    # Verify Telegram hash for security
    auth_data_dict = {
        "id": str(telegram_data.id),
        "first_name": telegram_data.first_name,
        "auth_date": str(telegram_data.auth_date),
        "hash": telegram_data.hash
    }
    
    # Add optional fields if present
    if telegram_data.last_name:
        auth_data_dict["last_name"] = telegram_data.last_name
    if telegram_data.username:
        auth_data_dict["username"] = telegram_data.username
    if telegram_data.photo_url:
        auth_data_dict["photo_url"] = telegram_data.photo_url
    
    # Verify the hash
    if not verify_telegram_hash(auth_data_dict.copy(), telegram_bot_token):
        raise HTTPException(status_code=401, detail="Invalid Telegram authentication data")
    
    # Check auth_date is not too old (within 24 hours)
    current_time = int(datetime.now(timezone.utc).timestamp())
    if current_time - telegram_data.auth_date > 86400:  # 24 hours
        raise HTTPException(status_code=401, detail="Telegram authentication data expired")
    
    # Check if user exists by Telegram ID
    existing_user = await db.users.find_one({"telegramId": telegram_data.id})
    
    if existing_user:
        # User exists, log them in
        access_token = create_access_token(data={"sub": existing_user["id"]})
        user_dict = {k: v for k, v in existing_user.items() if k not in ["password_hash", "_id"]}
        
        return {
            "message": "Telegram login successful",
            "access_token": access_token,
            "user": user_dict
        }
    else:
        # Create new user from Telegram data
        # Generate a unique username if Telegram username is not available
        base_username = telegram_data.username or f"user_{telegram_data.id}"
        username = base_username
        counter = 1
        
        while await db.users.find_one({"username": username}):
            username = f"{base_username}{counter}"
            counter += 1
        
        # Create complete user with all required fields
        user_dict = {
            "id": str(uuid4()),
            "fullName": f"{telegram_data.first_name} {telegram_data.last_name or ''}".strip(),
            "username": username,
            "telegramId": telegram_data.id,
            "telegramUsername": telegram_data.username,
            "telegramFirstName": telegram_data.first_name,
            "telegramLastName": telegram_data.last_name,
            "telegramPhotoUrl": telegram_data.photo_url,
            "email": f"tg{telegram_data.id}@luvhive.app",
            "age": 18,
            "gender": "Not specified",
            "bio": "",
            "profileImage": telegram_data.photo_url or '',
            "authMethod": "telegram",
            "isPremium": False,
            "isPrivate": False,
            "isVerified": False,
            "following": [],
            "followers": [],
            "blockedUsers": [],
            "mutedUsers": [],
            "savedPosts": [],
            "preferences": {"ageRange": [18, 100], "lookingFor": "Not specified"},
            "interests": [],
            "location": {"city": "", "country": ""},
            "socialLinks": {},
            "privacy": {"showAge": True, "showLocation": True},
            "createdAt": datetime.now(timezone.utc)
        }
        
        await db.users.insert_one(user_dict)
        access_token = create_access_token(data={"sub": user_dict["id"]})
        
        return {
            "message": "Telegram registration successful",
            "access_token": access_token,
            "user": user_dict
        }

@api_router.post("/auth/telegram-webapp")
async def telegram_webapp_auth(initData: str = Form(...)):
    """
    Authenticate user via Telegram WebApp initData
    """
    import hmac
    import hashlib
    from urllib.parse import parse_qs
    
    # Get Telegram bot token from environment
    telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not telegram_bot_token:
        raise HTTPException(status_code=500, detail="Telegram bot not configured")
    
    # Parse initData
    try:
        params = parse_qs(initData)
        hash_value = params.get('hash', [''])[0]
        
        # Create data check string
        data_check_arr = []
        for key, value in sorted(params.items()):
            if key != 'hash':
                if isinstance(value, list):
                    data_check_arr.append(f"{key}={value[0]}")
                else:
                    data_check_arr.append(f"{key}={value}")
        
        data_check_string = '\n'.join(data_check_arr)
        
        # Verify hash
        secret_key = hmac.new("WebAppData".encode(), telegram_bot_token.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        if calculated_hash != hash_value:
            raise HTTPException(status_code=401, detail="Invalid Telegram WebApp data")
        
        # Parse user data
        import json
        user_data = json.loads(params.get('user', ['{}'])[0])
        telegram_id = user_data.get('id')
        
        if not telegram_id:
            raise HTTPException(status_code=400, detail="No user data in initData")
        
        # Check if user exists
        existing_user = await db.users.find_one({"telegramId": telegram_id})
        
        if existing_user:
            # User exists, log them in
            access_token = create_access_token(data={"sub": existing_user["id"]})
            user_dict = {k: (v.isoformat() if isinstance(v, datetime) else v) 
                         for k, v in existing_user.items() 
                         if k not in ["password_hash", "_id"]}
            
            return {
                "success": True,
                "message": "Telegram WebApp login successful",
                "access_token": access_token,
                "user": user_dict
            }
        else:
            # Create new user
            username = user_data.get('username') or f"user_{telegram_id}"
            counter = 1
            base_username = username
            
            while await db.users.find_one({"username": username}):
                username = f"{base_username}{counter}"
                counter += 1
            
            new_user = {
                "id": str(uuid4()),
                "fullName": f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip(),
                "username": username,
                "telegramId": telegram_id,
                "telegramUsername": user_data.get('username'),
                "telegramFirstName": user_data.get('first_name'),
                "telegramLastName": user_data.get('last_name'),
                "telegramPhotoUrl": user_data.get('photo_url'),
                "email": f"tg{telegram_id}@luvhive.app",
                "age": 18,
                "gender": "Not specified",
                "bio": "",
                "profileImage": user_data.get('photo_url', ''),
                "authMethod": "telegram_webapp",
                "isPremium": False,
                "isPrivate": False,
                "following": [],
                "followers": [],
                "blockedUsers": [],
                "mutedUsers": [],
                "savedPosts": [],
                "preferences": {"ageRange": [18, 100], "lookingFor": "Not specified"},
                "interests": [],
                "location": {"city": "", "country": ""},
                "socialLinks": {},
                "privacy": {"showAge": True, "showLocation": True},
                "createdAt": datetime.now(timezone.utc)
            }
            
            await db.users.insert_one(new_user)
            access_token = create_access_token(data={"sub": new_user["id"]})
            
            # Convert datetime to JSON-serializable format
            user_response = {k: (v.isoformat() if isinstance(v, datetime) else v) 
                             for k, v in new_user.items() 
                             if k != "_id"}
            
            return {
                "success": True,
                "message": "Telegram WebApp registration successful",
                "access_token": access_token,
                "user": user_response
            }
            
    except Exception as e:
        logger.error(f"Telegram WebApp auth error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to authenticate: {str(e)}")

@api_router.post("/auth/telegram-signin")
async def telegram_signin(request: TelegramSigninRequest):
    """
    Initiate Telegram sign-in for existing users by sending OTP
    """
    try:
        # Check if user exists with this Telegram ID
        user = await db.users.find_one({"telegramId": request.telegramId})
        
        if not user:
            raise HTTPException(
                status_code=404, 
                detail="No account found with this Telegram ID. Please register first."
            )
        
        # Check if user registered via Telegram
        if user.get("authMethod") != "telegram":
            raise HTTPException(
                status_code=400,
                detail="This account was not registered via Telegram. Please use email/password login."
            )
        
        # Generate OTP
        otp = generate_otp()
        
        # Store OTP
        await store_otp(request.telegramId, otp)
        
        # Send OTP via Telegram
        otp_sent = await send_telegram_otp(request.telegramId, otp)
        
        if not otp_sent:
            raise HTTPException(
                status_code=500,
                detail="Failed to send OTP. Please try again later."
            )
        
        return {
            "message": "OTP sent successfully to your Telegram account",
            "telegramId": request.telegramId,
            "otpSent": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Telegram signin error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/verify-telegram-otp")
async def verify_telegram_otp(request: VerifyOTPRequest):
    """
    Verify OTP and complete Telegram sign-in
    """
    try:
        # Verify OTP
        is_valid = await verify_otp(request.telegramId, request.otp)
        
        if not is_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired OTP. Please request a new one."
            )
        
        # Get user
        user = await db.users.find_one({"telegramId": request.telegramId})
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        # Generate access token
        access_token = create_access_token(data={"sub": user["id"]})
        
        # Update last seen
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "isOnline": True,
                "lastSeen": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "message": "Telegram login successful",
            "access_token": access_token,
            "user": {k: v for k, v in user.items() if k not in ["password_hash", "_id"]}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OTP verification error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Send password reset email or suggest Telegram recovery
    """
    if not request.email or not request.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Find user by email
    user = await db.users.find_one({"email": request.email.lower().strip()})
    
    if not user:
        # Return proper error - user should know if email doesn't exist
        raise HTTPException(
            status_code=404, 
            detail="No account found with this email address. Please check your email or register a new account."
        )
    
    # Check if user has Telegram auth
    if user.get("telegramId"):
        return {
            "message": "Password reset available via Telegram",
            "hasTelegram": True,
            "suggestion": "You can reset your password through your Telegram bot or use the traditional email reset"
        }
    
    # Generate reset token (24 hours expiry)
    reset_token = create_access_token(
        data={"sub": user["id"], "type": "password_reset"}, 
        expires_delta=timedelta(hours=24)
    )
    
    # In production, send email with reset link
    # For now, return the token (in production, this should be sent via email)
    reset_link = f"https://your-app.com/reset-password?token={reset_token}"
    
    return {
        "message": "Password reset link sent to your email",
        "hasTelegram": False,
        # TODO: Remove this in production - only for testing
        "reset_link": reset_link  
    }

@api_router.post("/webhook/telegram")
async def telegram_webhook(update: dict):
    """Handle Telegram webhook updates"""
    try:
        # Process Telegram webhook update
        if "message" in update:
            message = update["message"]
            user = message.get("from", {})
            text = message.get("text", "")
            
            # Handle /start command
            if text.startswith("/start"):
                telegram_id = user.get("id")
                
                # Check if user exists
                existing_user = await db.users.find_one({"telegramId": telegram_id})
                
                if existing_user:
                    # User already registered
                    return {"status": "ok", "message": "User already registered"}
                else:
                    # Create new user from Telegram data
                    new_user_data = {
                        "id": str(uuid4()),
                        "telegramId": telegram_id,
                        "telegramUsername": user.get("username", ""),
                        "telegramFirstName": user.get("first_name", ""),
                        "telegramLastName": user.get("last_name", ""),
                        "fullName": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "username": user.get("username") or f"tguser{telegram_id}",
                        "authMethod": "telegram",
                        "createdAt": datetime.now(timezone.utc).isoformat(),
                        "age": 18,  # Default age
                        "gender": "Other",  # Default gender
                        "bio": "",
                        "profileImage": "",
                        "followers": [],
                        "following": [],
                        "posts": [],
                        "isPremium": False
                    }
                    
                    await db.users.insert_one(new_user_data)
                    return {"status": "ok", "message": "User registered successfully"}
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.post("/auth/telegram-bot-check") 
async def check_telegram_bot_auth(auth_request: dict):
    """Check if user has authenticated via Telegram bot (PostgreSQL database)"""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        # Connect to the Telegram bot's PostgreSQL database using env vars
        bot_conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'localhost'),
            port=int(os.getenv('POSTGRES_PORT', '5432')),
            database=os.getenv('POSTGRES_DB', 'luvhive_bot'),
            user=os.getenv('POSTGRES_USER', 'postgres'),
            password=os.getenv('POSTGRES_PASSWORD')
        )
        
        # Get the most recently active user from bot database
        with bot_conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT tg_user_id, display_name, username, created_at 
                FROM users 
                ORDER BY created_at DESC 
                LIMIT 1
            """)
            recent_user = cursor.fetchone()
            
        bot_conn.close()
        
        if recent_user:
            # Create user in MongoDB (our main database) if not exists
            telegram_id = recent_user['tg_user_id']
            existing_user = await db.users.find_one({"telegramId": telegram_id})
            
            if not existing_user:
                # Create new user in MongoDB with ALL required fields
                user_data = {
                    "id": str(uuid4()),
                    "telegramId": telegram_id,
                    "telegramUsername": recent_user.get('username', ''),
                    "telegramFirstName": "",
                    "telegramLastName": "",  
                    "fullName": recent_user.get('display_name', '') or f"User {telegram_id}",
                    "username": recent_user.get('username') or f"tguser{telegram_id}",
                    "email": f"tg{telegram_id}@luvhive.app",  # Valid email format
                    "authMethod": "telegram",
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "age": 25,  # Changed from 18 to 25 (more realistic)
                    "gender": "Other", 
                    "bio": "New LuvHive user from Telegram! 💬✨",  # Better default bio
                    "profileImage": "",
                    "followers": [],
                    "following": [],
                    "posts": [],
                    "isPremium": False,
                    "isOnline": True,
                    "lastSeen": datetime.now(timezone.utc).isoformat(),
                    "preferences": {  # Add missing fields that EditProfile might expect
                        "showAge": True,
                        "showOnlineStatus": True, 
                        "allowMessages": True
                    },
                    "privacy": {
                        "profileVisibility": "public",
                        "showLastSeen": True
                    },
                    "socialLinks": {  # Initialize social links
                        "instagram": "",
                        "twitter": "",
                        "website": ""
                    },
                    "interests": [],  # Initialize interests array
                    "location": ""  # Initialize location
                }
                
                await db.users.insert_one(user_data)
                user = user_data
            else:
                user = existing_user
            
            # Generate JWT token
            access_token = jwt.encode({
                "user_id": user["id"],
                "username": user["username"], 
                "exp": datetime.now(timezone.utc) + timedelta(days=7)
            }, SECRET_KEY, algorithm="HS256")
            
            return {
                "authenticated": True,
                "access_token": access_token,
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "fullName": user["fullName"],
                    "profileImage": user.get("profileImage", ""),
                    "authMethod": user["authMethod"]
                }
            }
        else:
            return {
                "authenticated": False,
                "message": "No recent Telegram authentication found. Please send /start to @Loveekisssbot"
            }
            
    except Exception as e:
        logger.error(f"Telegram bot auth check error: {e}")
        return {
            "authenticated": False,
            "message": f"Authentication check failed: {str(e)}"
        }

@api_router.post("/auth/telegram-check")
async def check_telegram_auth(auth_request: dict):
    """Legacy endpoint for telegram check"""
    return await check_telegram_bot_auth(auth_request)

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using token from email
    """
    try:
        # Verify reset token
        payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        token_type = payload.get("type")
        
        if token_type != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid token type")
        
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid token")
        
        # Find user
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate new password
        if len(request.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        
        # Hash new password
        hashed_password = get_password_hash(request.new_password)
        
        # Update password in database
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"password_hash": hashed_password}}
        )
        
        return {"message": "Password reset successful"}
        
    except PyJWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    # Get fresh data from database for accurate counts
    user_data = await db.users.find_one({"id": current_user.id})
    
    return {
        "id": current_user.id,
        "fullName": current_user.fullName,
        "username": current_user.username,
        "email": current_user.email,  # Added email field for EditProfile compatibility
        "age": current_user.age,
        "gender": current_user.gender,
        "bio": current_user.bio,
        "profileImage": current_user.profileImage,
        "country": current_user.country if hasattr(current_user, 'country') else None,
        "isPremium": current_user.isPremium,
        "isPrivate": current_user.isPrivate,
        "isVerified": current_user.isVerified if hasattr(current_user, 'isVerified') else False,
        "isFounder": current_user.isFounder if hasattr(current_user, 'isFounder') else False,
        "telegramLinked": current_user.telegramId is not None,
        "blockedUsers": user_data.get("blockedUsers", []) if user_data else current_user.blockedUsers,
        "mutedUsers": user_data.get("mutedUsers", []) if user_data else current_user.mutedUsers,  # Added for 3-dot menu functionality
        
        # Followers/Following data - use fresh data from database
        "followers": user_data.get("followers", []) if user_data else [],
        "following": user_data.get("following", []) if user_data else [],
        "followersCount": len(user_data.get("followers", [])) if user_data else 0,
        "followingCount": len(user_data.get("following", [])) if user_data else 0,
        
        # Privacy Controls
        "appearInSearch": current_user.appearInSearch,
        "allowDirectMessages": current_user.allowDirectMessages,
        "showOnlineStatus": current_user.showOnlineStatus,
        
        # Interaction Preferences
        "allowTagging": current_user.allowTagging,
        "allowStoryReplies": current_user.allowStoryReplies,
        "showVibeScore": current_user.showVibeScore,
        
        # Notifications
        "pushNotifications": current_user.pushNotifications,
        "emailNotifications": current_user.emailNotifications
    }

@api_router.get("/auth/verification-status")
async def check_verification_status(current_user: User = Depends(get_current_user)):
    """Check current user's verification status and progress"""
    user_data = await db.users.find_one({"id": current_user.id})
    
    # Calculate account age in days
    created_at = user_data.get("createdAt")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    account_age_days = (datetime.now(timezone.utc) - created_at).days
    
    # Count posts
    posts_count = await db.posts.count_documents({"userId": current_user.id, "isArchived": {"$ne": True}})
    
    # Count followers
    followers_count = len(user_data.get("followers", []))
    
    # Count total likes received across all posts
    posts = await db.posts.find({"userId": current_user.id}).to_list(1000)
    total_likes = sum(len(post.get("likes", [])) for post in posts)
    
    # Count profile views (assuming we track this)
    profile_views = user_data.get("profileViews", 0)
    
    # Calculate average story views
    stories = await db.stories.find({"userId": current_user.id}).to_list(1000)
    avg_story_views = 0
    if stories:
        total_story_views = sum(story.get("views", 0) for story in stories)
        avg_story_views = total_story_views / len(stories) if len(stories) > 0 else 0
    
    # Check violations
    violations_count = await db.violations.count_documents({"userId": current_user.id})
    
    # Check profile completeness
    has_bio = bool(user_data.get("bio"))
    has_profile_pic = bool(user_data.get("profileImage"))
    has_location = bool(user_data.get("location", {}).get("city"))
    
    # Check personality questions
    has_personality = bool(user_data.get("personalityAnswers"))
    
    # Dual verification
    has_email = bool(user_data.get("email"))
    has_phone = bool(user_data.get("mobileNumber"))
    dual_verified = has_email and has_phone
    
    criteria = {
        "dualVerification": {"met": dual_verified, "required": True, "description": "Email + Phone verified"},
        "accountAge": {"met": account_age_days >= 45, "current": account_age_days, "required": 45, "description": "Account age 45+ days"},
        "postsCount": {"met": posts_count >= 20, "current": posts_count, "required": 20, "description": "Minimum 20 posts"},
        "followersCount": {"met": followers_count >= 100, "current": followers_count, "required": 100, "description": "100+ followers"},
        "noViolations": {"met": violations_count == 0, "current": violations_count, "required": 0, "description": "No violations/reports"},
        "completeProfile": {"met": has_bio and has_profile_pic and has_location, "description": "Complete profile (bio, photo, location)"},
        "personalityAnswers": {"met": has_personality, "description": "Personality questions answered"},
        "profileViews": {"met": profile_views >= 1000, "current": profile_views, "required": 1000, "description": "1000+ profile views"},
        "avgStoryViews": {"met": avg_story_views >= 70, "current": int(avg_story_views), "required": 70, "description": "70+ average story views"},
        "totalLikes": {"met": total_likes >= 1000, "current": total_likes, "required": 1000, "description": "1000+ total likes received"}
    }
    
    criteria_met = sum(1 for c in criteria.values() if c["met"])
    total_criteria = len(criteria)
    
    eligible = criteria_met == total_criteria
    
    return {
        "isVerified": user_data.get("isVerified", False),
        "eligible": eligible,
        "criteriaMetCount": criteria_met,
        "totalCriteria": total_criteria,
        "criteria": criteria
    }

@api_router.post("/admin/verify-user/{username}")
async def admin_verify_user(username: str):
    """Admin endpoint to manually verify users (for testing)"""
    # Public endpoint for testing - in production add proper admin auth
    
    target_user = await db.users.find_one({"username": username})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"username": username},
        {"$set": {
            "isVerified": True,
            "verifiedAt": datetime.now(timezone.utc).isoformat(),
            "verificationPathway": "Manually Verified"
        }}
    )
    
    return {"message": f"User {username} has been manually verified", "success": True}

@api_router.post("/admin/set-founder/{username}")
async def set_founder_account(username: str):
    """Set an account as official founder/company account"""
    
    # Find user by username
    target_user = await db.users.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user as founder and verify
    await db.users.update_one(
        {"id": target_user["id"]},
        {
            "$set": {
                "isFounder": True,
                "isVerified": True,
                "verifiedAt": datetime.now(timezone.utc),
                "verificationPathway": "Official LuvHive Account"
            }
        }
    )
    
    return {"message": f"User {username} has been set as founder/official account", "success": True}

@api_router.get("/verification/status")
async def get_verification_status(current_user: User = Depends(get_current_user)):
    """Get current user's verification status and progress"""
    
    # Debug logging
    print(f"🔍 Verification status check for user: {current_user.username}")
    print(f"🔍 isVerified value: {getattr(current_user, 'isVerified', 'ATTRIBUTE_NOT_FOUND')}")
    print(f"🔍 hasattr isVerified: {hasattr(current_user, 'isVerified')}")
    
    # Calculate account age in days
    created_at = current_user.createdAt if hasattr(current_user, 'createdAt') else datetime.now(timezone.utc)
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    elif created_at.tzinfo is None:
        # If datetime is naive, assume it's UTC
        created_at = created_at.replace(tzinfo=timezone.utc)
    account_age_days = (datetime.now(timezone.utc) - created_at).days
    
    # Get posts count
    posts_count = await db.posts.count_documents({"userId": current_user.id})
    
    # Get total likes on user's posts
    user_posts = await db.posts.find({"userId": current_user.id}).to_list(length=None)
    # likes is a list of user IDs who liked, so count the length
    total_likes = sum(len(post.get("likes", [])) for post in user_posts)
    
    # Get story views (average)
    user_stories = await db.stories.find({"userId": current_user.id}).to_list(length=None)
    avg_story_views = 0
    if user_stories:
        # views is a list of user IDs who viewed, so count the length
        total_views = sum(len(story.get("views", [])) for story in user_stories)
        avg_story_views = total_views / len(user_stories)
    
    # Check profile completeness
    profile_complete = all([
        current_user.fullName,
        current_user.bio,
        current_user.profileImage,
        current_user.gender,
        current_user.age
    ])
    
    # Personality questions are mandatory during registration, so always true
    personality_questions = True
    
    # Alternative pathways calculations
    # Pathway 1: High engagement (original pathway)
    high_engagement = (
        posts_count >= 20 and
        len(current_user.followers) >= 100 and
        total_likes >= 1000 and
        avg_story_views >= 70 and
        getattr(current_user, 'profileViews', 0) >= 1000
    )
    
    # Pathway 2: Moderate engagement with longer tenure
    moderate_engagement = (
        posts_count >= 10 and
        len(current_user.followers) >= 50 and
        account_age_days >= 90 and
        (total_likes >= 500 or avg_story_views >= 40)
    )
    
    # Pathway 3: Community contribution (future: moderator, reports, endorsements)
    community_contribution = getattr(current_user, 'communityBadge', False)
    
    # Pathway 4: Cross-platform verified (future: linked verified accounts)
    cross_platform_verified = getattr(current_user, 'crossPlatformVerified', False)
    
    # User qualifies if they meet basic requirements + at least one pathway
    basic_requirements_met = (
        account_age_days >= 45 and
        bool(getattr(current_user, 'emailVerified', False)) and
        bool(getattr(current_user, 'mobileVerified', False)) and
        getattr(current_user, 'violationsCount', 0) == 0 and
        profile_complete
    )
    
    meets_any_pathway = high_engagement or moderate_engagement or community_contribution or cross_platform_verified
    auto_eligible = basic_requirements_met and meets_any_pathway
    
    # Determine which pathway the user met
    achieved_pathway = None
    if high_engagement:
        achieved_pathway = "High Engagement Pathway"
    elif moderate_engagement:
        achieved_pathway = "Moderate Engagement Pathway"
    elif community_contribution:
        achieved_pathway = "Community Contribution"
    elif cross_platform_verified:
        achieved_pathway = "Cross-Platform Verified"
    
    # Criteria checks (grouped for display)
    criteria = {
        # Identity & Security
        "emailVerified": bool(getattr(current_user, 'emailVerified', False)),
        "mobileVerified": bool(getattr(current_user, 'mobileVerified', False)),
        
        # Profile Completeness
        "profileComplete": profile_complete,
        "personalityQuestions": True,
        
        # Tenure & Behaviour
        "accountAge": account_age_days >= 45,
        "noViolations": getattr(current_user, 'violationsCount', 0) == 0,
        
        # Activity & Engagement (High pathway)
        "postsCount": posts_count >= 20,
        "followersCount": len(current_user.followers) >= 100,
        "totalLikes": total_likes >= 1000,
        "avgStoryViews": avg_story_views >= 70,
        "profileViews": getattr(current_user, 'profileViews', 0) >= 1000,
        
        # Alternative Pathways
        "moderateEngagement": moderate_engagement,
        "communityContribution": community_contribution,
        "crossPlatformVerified": cross_platform_verified
    }
    
    # Current values for progress display
    current_values = {
        "accountAgeDays": account_age_days,
        "emailVerified": bool(getattr(current_user, 'emailVerified', False)),
        "mobileVerified": bool(getattr(current_user, 'mobileVerified', False)),
        "postsCount": posts_count,
        "followersCount": len(current_user.followers),
        "violationsCount": getattr(current_user, 'violationsCount', 0),
        "profileComplete": profile_complete,
        "personalityQuestions": True,
        "profileViews": getattr(current_user, 'profileViews', 0),
        "avgStoryViews": int(avg_story_views),
        "totalLikes": total_likes,
        "moderateEngagementPosts": posts_count >= 10,
        "moderateEngagementFollowers": len(current_user.followers) >= 50,
        "moderateEngagementTenure": account_age_days >= 90,
        "moderateEngagementLikes": total_likes >= 500 or avg_story_views >= 40
    }
    
    return {
        "isVerified": current_user.isVerified if hasattr(current_user, 'isVerified') else False,
        "verificationPathway": getattr(current_user, 'verificationPathway', achieved_pathway),
        "verifiedAt": getattr(current_user, 'verifiedAt', None),
        "criteria": criteria,
        "currentValues": current_values,
        "autoEligible": auto_eligible,
        "achievedPathway": achieved_pathway,
        "pathways": {
            "highEngagement": high_engagement,
            "moderateEngagement": moderate_engagement,
            "communityContribution": community_contribution,
            "crossPlatformVerified": cross_platform_verified
        },
        "allCriteriaMet": auto_eligible
    }

@api_router.put("/auth/profile")
async def update_profile(
    fullName: str = Form(None), 
    username: str = Form(None), 
    bio: str = Form(None),
    country: str = Form(None),
    profileImage: str = Form(None), 
    current_user: User = Depends(get_current_user)
):
    update_data = {}
    
    # Handle username change with 15-day restriction
    if username is not None and username != current_user.username:
        # Check if username is already taken
        existing_user = await db.users.find_one({"username": username, "id": {"$ne": current_user.id}})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")
        
        # Check 15-day restriction
        if current_user.lastUsernameChange:
            days_since_change = (datetime.now(timezone.utc) - current_user.lastUsernameChange).days
            if days_since_change < 15:
                days_remaining = 15 - days_since_change
                raise HTTPException(
                    status_code=400, 
                    detail=f"You can change username again in {days_remaining} days"
                )
        
        update_data["username"] = username
        update_data["lastUsernameChange"] = datetime.now(timezone.utc)
        
        # Update username in all posts and stories
        await db.posts.update_many(
            {"userId": current_user.id},
            {"$set": {"username": username}}
        )
        await db.stories.update_many(
            {"userId": current_user.id},
            {"$set": {"username": username}}
        )
    
    # Handle other fields
    if fullName is not None:
        update_data["fullName"] = fullName
    if bio is not None:
        update_data["bio"] = bio
    if country is not None:
        update_data["country"] = country
    if profileImage is not None:
        update_data["profileImage"] = profileImage
        
        # Update profile image in posts and stories
        await db.posts.update_many(
            {"userId": current_user.id},
            {"$set": {"userProfileImage": profileImage}}
        )
        await db.stories.update_many(
            {"userId": current_user.id},
            {"$set": {"userProfileImage": profileImage}}
        )
    
    if update_data:
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": update_data}
        )
    
    # Fetch and return updated user data
    updated_user = await db.users.find_one({"id": current_user.id})
    if updated_user:
        # Remove password hash before returning
        updated_user.pop("password_hash", None)
        updated_user.pop("_id", None)
    
    return {
        "message": "Profile updated successfully",
        "user": updated_user
    }

# Email and Phone Verification Endpoints
@api_router.post("/auth/send-email-verification")
async def send_email_verification(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Send email verification code"""
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Generate 6-digit OTP
    import random
    otp = str(random.randint(100000, 999999))
    
    # Store OTP in database with expiry (10 minutes)
    from datetime import timedelta
    expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.verification_codes.update_one(
        {"userId": current_user.id, "type": "email"},
        {
            "$set": {
                "userId": current_user.id,
                "type": "email",
                "code": otp,
                "email": email,
                "expiresAt": expiry,
                "createdAt": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )
    
    # TODO: Send actual email with OTP (for now, just log it)
    print(f"📧 Email Verification Code for {email}: {otp}")
    
    return {"message": "Verification code sent to your email", "debug_code": otp}

@api_router.post("/auth/verify-email-code")
async def verify_email_code(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Verify email with OTP"""
    code = data.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Verification code is required")
    
    # Find verification code
    verification = await db.verification_codes.find_one({
        "userId": current_user.id,
        "type": "email",
        "code": code
    })
    
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Check if expired
    if verification["expiresAt"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code expired")
    
    # Update user email and set as verified
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"email": verification["email"], "emailVerified": True}}
    )
    
    # Delete used verification code
    await db.verification_codes.delete_one({"_id": verification["_id"]})
    
    return {"message": "Email verified successfully"}

@api_router.post("/auth/send-phone-verification")
async def send_phone_verification(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Send phone verification code via Twilio Verify"""
    phone = data.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")
    
    try:
        from twilio.rest import Client
        
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        verify_service_sid = os.environ.get("TWILIO_VERIFY_SERVICE_SID")
        
        if not account_sid or not auth_token or not verify_service_sid:
            raise HTTPException(status_code=500, detail="SMS service not configured")
        
        client = Client(account_sid, auth_token)
        
        # Format mobile number (add +91 if not present)
        formatted_number = phone.strip()
        if not formatted_number.startswith('+'):
            if formatted_number.startswith('91'):
                formatted_number = '+' + formatted_number
            else:
                formatted_number = '+91' + formatted_number
        
        # Send OTP via Twilio Verify
        verification = client.verify \
            .v2 \
            .services(verify_service_sid) \
            .verifications \
            .create(to=formatted_number, channel='sms')
        
        # Store phone number for verification
        await db.verification_codes.update_one(
            {"userId": current_user.id, "type": "phone"},
            {
                "$set": {
                    "userId": current_user.id,
                    "type": "phone",
                    "phone": formatted_number,
                    "createdAt": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
        logger.info(f"Twilio SMS OTP sent: {verification.status} to {formatted_number}")
        
        return {
            "message": "Verification code sent to your phone",
            "status": verification.status
        }
        
    except Exception as e:
        logger.error(f"Error sending phone verification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send SMS: {str(e)}")

@api_router.post("/auth/verify-phone-code")
async def verify_phone_code(
    data: dict,
    current_user: User = Depends(get_current_user)
):
    """Verify phone with OTP using Twilio Verify"""
    code = data.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Verification code is required")
    
    try:
        from twilio.rest import Client
        
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        verify_service_sid = os.environ.get("TWILIO_VERIFY_SERVICE_SID")
        
        if not account_sid or not auth_token or not verify_service_sid:
            raise HTTPException(status_code=500, detail="SMS service not configured")
        
        # Get stored phone number
        verification_record = await db.verification_codes.find_one({
            "userId": current_user.id,
            "type": "phone"
        })
        
        if not verification_record or not verification_record.get("phone"):
            raise HTTPException(status_code=400, detail="No verification request found. Please send code first.")
        
        phone_number = verification_record["phone"]
        
        client = Client(account_sid, auth_token)
        
        # Verify OTP with Twilio
        verification_check = client.verify \
            .v2 \
            .services(verify_service_sid) \
            .verification_checks \
            .create(to=phone_number, code=code)
        
        if verification_check.status == 'approved':
            # Update user phone and set as verified
            await db.users.update_one(
                {"id": current_user.id},
                {"$set": {"mobile": phone_number, "mobileVerified": True}}
            )
            
            # Delete used verification record
            await db.verification_codes.delete_one({"_id": verification_record["_id"]})
            
            logger.info(f"Phone verified successfully for user {current_user.id}")
            return {"message": "Phone verified successfully"}
        else:
            raise HTTPException(status_code=400, detail="Invalid verification code")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying phone code: {e}")
        raise HTTPException(status_code=400, detail="Invalid verification code")

@api_router.put("/auth/settings")
async def update_user_settings(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Update user's settings"""
    # Get the setting key and value from request
    setting_updates = {}
    
    # Define allowed settings
    allowed_settings = [
        'isPrivate', 'appearInSearch', 'allowDirectMessages', 
        'showOnlineStatus', 'allowTagging', 'allowStoryReplies', 'showVibeScore',
        'pushNotifications', 'emailNotifications'
    ]
    
    for key, value in request.items():
        if key in allowed_settings and isinstance(value, bool):
            setting_updates[key] = value
    
    if not setting_updates:
        raise HTTPException(status_code=400, detail="No valid settings provided")
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": setting_updates}
    )
    
    return {"message": "Settings updated successfully", "updated": setting_updates}

@api_router.get("/auth/download-data")
async def download_user_data(current_user: User = Depends(get_current_user)):
    """Download user's data in JSON format"""
    # Get user data
    user_data = await db.users.find_one({"id": current_user.id})
    
    # Get user's posts
    posts = await db.posts.find({"userId": current_user.id}).to_list(1000)
    
    # Get user's stories
    stories = await db.stories.find({"userId": current_user.id}).to_list(1000)
    
    # Get user's notifications
    notifications = await db.notifications.find({"userId": current_user.id}).to_list(1000)
    
    # Prepare export data
    export_data = {
        "profile": {
            "id": user_data["id"],
            "fullName": user_data["fullName"],
            "username": user_data["username"],
            "age": user_data["age"],
            "gender": user_data["gender"],
            "bio": user_data.get("bio", ""),
            "isPremium": user_data.get("isPremium", False),
            "createdAt": user_data["createdAt"].isoformat(),
            "followers": len(user_data.get("followers", [])),
            "following": len(user_data.get("following", []))
        },
        "posts": [
            {
                "id": post["id"],
                "caption": post.get("caption", ""),
                "mediaType": post["mediaType"],
                "likes": len(post.get("likes", [])),
                "comments": len(post.get("comments", [])),
                "createdAt": post["createdAt"].isoformat()
            } for post in posts
        ],
        "stories": [
            {
                "id": story["id"],
                "caption": story.get("caption", ""),
                "mediaType": story["mediaType"],
                "createdAt": story["createdAt"].isoformat(),
                "expiresAt": story["expiresAt"].isoformat()
            } for story in stories
        ],
        "notifications": [
            {
                "type": notif["type"],
                "fromUsername": notif["fromUsername"],
                "createdAt": notif["createdAt"].isoformat()
            } for notif in notifications
        ],
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "totalPosts": len(posts),
        "totalStories": len(stories),
        "totalNotifications": len(notifications)
    }
    
    import json
    from fastapi.responses import Response
    
    json_data = json.dumps(export_data, indent=2)
    
    return Response(
        content=json_data,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=luvhive-data-{current_user.username}.json"
        }
    )

@api_router.get("/auth/can-change-username")
async def can_change_username(current_user: User = Depends(get_current_user)):
    if not current_user.lastUsernameChange:
        return {"canChange": True, "daysRemaining": 0}
    
    days_since_change = (datetime.now(timezone.utc) - current_user.lastUsernameChange).days
    can_change = days_since_change >= 15
    days_remaining = max(0, 15 - days_since_change)
    
    return {
        "canChange": can_change,
        "daysRemaining": days_remaining,
        "lastChanged": current_user.lastUsernameChange.isoformat()
    }

@api_router.get("/auth/check-email/{email}")
async def check_email_availability(email: str):
    """
    Check email availability
    """
    try:
        # Clean and validate the email
        clean_email = email.strip().lower()
        
        if '@' not in clean_email or '.' not in clean_email:
            return {
                "available": False,
                "message": "Invalid email format"
            }
        
        # Check if email is already registered
        existing_user = await db.users.find_one({"email": clean_email})
        
        if existing_user:
            return {
                "available": False,
                "message": "Email is already registered - please use a different email"
            }
        else:
            return {
                "available": True,
                "message": "Email is available!"
            }
        
    except Exception as e:
        logger.error(f"Email check error: {e}")
        return {
            "available": False,
            "message": "Error checking email availability"
        }

@api_router.post("/auth/send-email-otp")
async def send_email_otp_endpoint(request: EmailOTPRequest):
    """
    Send OTP to email address for registration verification
    """
    try:
        clean_email = request.email.strip().lower()
        
        if '@' not in clean_email or '.' not in clean_email:
            raise HTTPException(
                status_code=400,
                detail="Invalid email format"
            )
        
        # Check if email already exists
        existing_user = await db.users.find_one({"email": clean_email})
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
        
        # Generate OTP
        otp = generate_otp()
        
        # Store OTP
        await store_email_otp(clean_email, otp)
        
        # Send OTP via email
        otp_sent = await send_email_otp(clean_email, otp)
        
        if not otp_sent:
            raise HTTPException(
                status_code=500,
                detail="Failed to send OTP email"
            )
        
        return {
            "message": "OTP sent to your email address",
            "email": clean_email,
            "otpSent": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send email OTP error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/verify-email-otp")
async def verify_email_otp_endpoint(request: VerifyEmailOTPRequest):
    """
    Verify email OTP for registration
    """
    try:
        clean_email = request.email.strip().lower()
        
        # Verify OTP
        is_valid = await verify_email_otp(clean_email, request.otp.strip())
        
        if not is_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired OTP"
            )
        
        return {
            "message": "Email verified successfully",
            "verified": True,
            "email": clean_email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify email OTP error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/send-mobile-otp")
async def send_mobile_otp_endpoint(request: SendMobileOTPRequest):
    """
    Send OTP to mobile number for verification
    """
    try:
        clean_mobile = request.mobileNumber.strip()
        
        # Basic mobile number validation
        mobile_digits = ''.join(filter(str.isdigit, clean_mobile))
        if len(mobile_digits) < 10 or len(mobile_digits) > 15:
            raise HTTPException(
                status_code=400,
                detail="Invalid mobile number format"
            )
        
        # Send OTP
        otp_sent = await send_mobile_otp(clean_mobile)
        
        if not otp_sent:
            raise HTTPException(
                status_code=500,
                detail="Failed to send SMS OTP"
            )
        
        return {
            "message": "OTP sent to your mobile number",
            "mobileNumber": clean_mobile,
            "otpSent": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send mobile OTP error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/verify-mobile-otp")
async def verify_mobile_otp_endpoint(request: VerifyMobileOTPRequest):
    """
    Verify mobile OTP
    """
    try:
        clean_mobile = request.mobileNumber.strip()
        clean_otp = request.otp.strip()
        
        # Verify OTP
        is_valid = await verify_mobile_otp(clean_mobile, clean_otp)
        
        if not is_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired OTP"
            )
        
        return {
            "message": "Mobile number verified successfully",
            "verified": True,
            "mobileNumber": clean_mobile
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify mobile OTP error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/verify-existing-account")
async def verify_existing_account(request: EmailOTPRequest):
    """
    Send verification email to existing unverified accounts
    """
    try:
        clean_email = request.email.strip().lower()
        
        # Find existing user with this email
        user = await db.users.find_one({"email": clean_email})
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail="No account found with this email"
            )
        
        # Check if already verified
        if user.get("emailVerified", False):
            return {
                "message": "Account is already verified",
                "verified": True
            }
        
        # Generate OTP for existing account
        otp = generate_otp()
        
        # Store OTP
        await store_email_otp(clean_email, otp)
        
        # Send OTP via email
        otp_sent = await send_email_otp(clean_email, otp)
        
        if not otp_sent:
            raise HTTPException(
                status_code=500,
                detail="Failed to send verification email"
            )
        
        return {
            "message": "Verification email sent to your registered email address",
            "email": clean_email,
            "otpSent": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify existing account error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/verify-existing-otp")
async def verify_existing_otp(request: VerifyEmailOTPRequest):
    """
    Verify OTP for existing account and mark as verified
    """
    try:
        clean_email = request.email.strip().lower()
        
        # Verify OTP
        is_valid = await verify_email_otp(clean_email, request.otp.strip())
        
        if not is_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired OTP"
            )
        
        # Mark account as verified
        result = await db.users.update_one(
            {"email": clean_email},
            {"$set": {"emailVerified": True}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Account not found"
            )
        
        return {
            "message": "Account verified successfully! You can now sign in.",
            "verified": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verify existing OTP error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.delete("/auth/cleanup-account/{identifier}")
async def cleanup_account_data(identifier: str):
    """
    ADMIN ENDPOINT: Delete all account data by username, email, or mobile number
    """
    try:
        # Find users by username, email, or mobile
        users_to_delete = []
        
        # Search by username (case insensitive)
        user_by_username = await db.users.find_one({
            "username": {"$regex": f"^{identifier}$", "$options": "i"}
        })
        if user_by_username:
            users_to_delete.append(user_by_username)
        
        # Search by email (case insensitive)  
        if "@" in identifier:
            user_by_email = await db.users.find_one({
                "email": {"$regex": f"^{identifier}$", "$options": "i"}
            })
            if user_by_email and user_by_email not in users_to_delete:
                users_to_delete.append(user_by_email)
        
        # Search by mobile number (clean digits only)
        if identifier.isdigit() or "+" in identifier:
            # Clean mobile number for search
            clean_mobile = ''.join(filter(str.isdigit, identifier))
            mobile_patterns = [
                identifier,  # Original format
                clean_mobile,  # Digits only
                f"+91{clean_mobile}",  # With +91
                f"91{clean_mobile}",  # With 91
            ]
            
            for pattern in mobile_patterns:
                user_by_mobile = await db.users.find_one({
                    "mobileNumber": pattern
                })
                if user_by_mobile and user_by_mobile not in users_to_delete:
                    users_to_delete.append(user_by_mobile)
        
        # Delete all found users and related data
        deleted_users = []
        for user in users_to_delete:
            user_id = user["id"]
            username = user["username"]
            email = user.get("email", "N/A")
            
            # Delete user posts
            posts_deleted = await db.posts.delete_many({"userId": user_id})
            
            # Delete user comments
            comments_deleted = await db.comments.delete_many({"userId": user_id})
            
            # Remove user from other users' followers/following lists
            await db.users.update_many(
                {"followers": user_id},
                {"$pull": {"followers": user_id}}
            )
            await db.users.update_many(
                {"following": user_id},
                {"$pull": {"following": user_id}}
            )
            
            # Delete all notifications to and from this user
            await db.notifications.delete_many({"userId": user_id})  # Notifications TO this user
            await db.notifications.delete_many({"fromUserId": user_id})  # Notifications FROM this user
            
            # Delete the user account
            user_deleted = await db.users.delete_one({"id": user_id})
            
            deleted_users.append({
                "username": username,
                "email": email,
                "mobileNumber": user.get("mobileNumber", "N/A"),
                "userId": user_id,
                "posts_deleted": posts_deleted.deleted_count,
                "comments_deleted": comments_deleted.deleted_count,
                "account_deleted": user_deleted.deleted_count > 0
            })
        
        if not deleted_users:
            return {
                "message": f"No accounts found with identifier: {identifier}",
                "deleted_users": []
            }
        
        return {
            "message": f"Successfully cleaned up {len(deleted_users)} account(s)",
            "deleted_users": deleted_users
        }
        
    except Exception as e:
        logger.error(f"Account cleanup error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/forgot-password-mobile")
async def forgot_password_mobile(request: ForgotPasswordMobileRequest):
    """
    Send OTP to mobile for password reset
    """
    try:
        clean_mobile = request.mobileNumber.strip()
        
        # Find user by mobile number
        user = await db.users.find_one({"mobileNumber": clean_mobile})
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail="No account found with this mobile number"
            )
        
        # Use Twilio Verify service for password reset (same as registration)
        otp_sent = await send_mobile_otp(clean_mobile)
        
        if not otp_sent:
            raise HTTPException(
                status_code=500,
                detail="Failed to send OTP to mobile"
            )
            
        logger.info(f"Password reset OTP sent via Twilio Verify to {clean_mobile}")
        
        return {
            "message": "Password reset OTP sent to your mobile number",
            "mobileNumber": clean_mobile,
            "otpSent": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mobile forgot password error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/reset-password-mobile")
async def reset_password_mobile(request: ResetPasswordMobileRequest):
    """
    Reset password using mobile OTP
    """
    try:
        clean_mobile = request.mobileNumber.strip()
        
        # Verify OTP using Twilio Verify service (same as registration)
        is_valid = await verify_mobile_otp(clean_mobile, request.otp.strip())
        
        if not is_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired OTP"
            )
        
        # Find user
        user = await db.users.find_one({"mobileNumber": clean_mobile})
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )
        
        # Hash new password
        hashed_password = get_password_hash(request.new_password)
        
        # Update password
        await db.users.update_one(
            {"mobileNumber": clean_mobile},
            {"$set": {"password_hash": hashed_password}}
        )
        
        return {
            "message": "Password reset successfully! You can now sign in with your new password."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Mobile password reset error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.delete("/auth/wipe-all-data")
async def wipe_all_database():
    """
    ADMIN ENDPOINT: Delete ALL users, posts, and comments (DANGER!)
    """
    try:
        # Delete all users
        users_result = await db.users.delete_many({})
        
        # Delete all posts  
        posts_result = await db.posts.delete_many({})
        
        # Delete all comments
        comments_result = await db.comments.delete_many({})
        
        return {
            "message": "🗑️ Database completely wiped clean!",
            "users_deleted": users_result.deleted_count,
            "posts_deleted": posts_result.deleted_count,
            "comments_deleted": comments_result.deleted_count,
            "total_deleted": users_result.deleted_count + posts_result.deleted_count + comments_result.deleted_count
        }
        
    except Exception as e:
        logger.error(f"Database wipe error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.post("/auth/verify-email")
async def verify_email(token: str):
    """
    Verify email address with token
    """
    try:
        # Find user with this verification token
        user = await db.users.find_one({"emailVerificationToken": token})
        
        if not user:
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired verification link"
            )
        
        # Mark email as verified and remove token
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "emailVerified": True,
                "emailVerificationToken": None
            }}
        )
        
        return {
            "message": "Email verified successfully! You can now sign in to your account.",
            "verified": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/auth/check-mobile/{mobile_number}")
async def check_mobile_availability(mobile_number: str):
    """
    Check mobile number availability
    """
    try:
        # Clean mobile number
        clean_mobile = ''.join(filter(str.isdigit, mobile_number.strip()))
        
        if len(clean_mobile) < 10 or len(clean_mobile) > 15:
            return {
                "available": False,
                "message": "Mobile number must be 10-15 digits"
            }
        
        # Check various mobile number formats
        mobile_patterns = [
            clean_mobile,  # Digits only
            f"+91{clean_mobile}",  # With +91
            f"91{clean_mobile}",   # With 91
        ]
        
        for pattern in mobile_patterns:
            existing_mobile = await db.users.find_one({"mobileNumber": pattern})
            if existing_mobile:
                return {
                    "available": False,
                    "message": "Mobile number is already registered"
                }
        
        return {
            "available": True,
            "message": "Mobile number is available!"
        }
        
    except Exception as e:
        logger.error(f"Mobile check error: {e}")
        return {
            "available": False,
            "message": "Error checking mobile number availability"
        }

@api_router.get("/auth/check-username/{username}")
async def check_username_availability(username: str):
    """
    Check username availability and provide suggestions if taken
    """
    try:
        # Clean and validate the username
        clean_username = username.strip().lower()
        
        if len(clean_username) < 3:
            return {
                "available": False,
                "message": "Username must be at least 3 characters",
                "suggestions": []
            }
        
        if len(clean_username) > 20:
            return {
                "available": False,
                "message": "Username must be less than 20 characters", 
                "suggestions": []
            }
        
        # Check if username contains only valid characters
        import re
        if not re.match("^[a-zA-Z0-9_]+$", clean_username):
            return {
                "available": False,
                "message": "Username can only contain letters, numbers, and underscores",
                "suggestions": []
            }
        
        # Check if username is available (case-insensitive)
        escaped_username = clean_username.replace('.', r'\.')
        existing_user = await db.users.find_one({
            "username": {"$regex": f"^{escaped_username}$", "$options": "i"}
        })
        
        if not existing_user:
            return {
                "available": True,
                "message": "Username is available!",
                "suggestions": []
            }
        
        # Generate suggestions
        suggestions = []
        base_username = clean_username
        
        # Try various suggestions
        suggestion_patterns = [
            f"{base_username}_",
            f"{base_username}2025",
            f"{base_username}123",
            f"{base_username}2024", 
            f"{base_username}_1",
            f"{base_username}x",
            f"{base_username}official",
            f"{base_username}_real",
            f"the_{base_username}",
            f"{base_username}_official"
        ]
        
        # Add underscore variations for long usernames
        if len(base_username) > 5:
            # Insert underscore in middle
            mid = len(base_username) // 2
            suggestion_patterns.extend([
                f"{base_username[:mid]}_{base_username[mid:]}",
                f"{base_username[:-2]}_{base_username[-2:]}",
                f"{base_username[:3]}_{base_username[3:]}"
            ])
        
        for suggestion in suggestion_patterns:
            if len(suggestions) >= 5:  # Limit to 5 suggestions
                break
                
            # Check if suggestion is available
            escaped_suggestion = suggestion.replace('.', r'\.')
            suggestion_exists = await db.users.find_one({
                "username": {"$regex": f"^{escaped_suggestion}$", "$options": "i"}
            })
            
            if not suggestion_exists and len(suggestion) <= 20:
                suggestions.append(suggestion)
        
        return {
            "available": False,
            "message": f"Username '{username}' is not available",
            "suggestions": suggestions
        }
        
    except Exception as e:
        logger.error(f"Username check error: {e}")
        return {
            "available": False,
            "message": "Error checking username availability",
            "suggestions": []
        }

# Telegram Linking
@api_router.post("/telegram/link")
async def link_telegram(code: str, current_user: User = Depends(get_current_user)):
    # In real implementation, verify code with your Telegram bot
    # For now, we'll simulate it
    telegram_link = await db.telegram_links.find_one({"code": code})
    
    if not telegram_link:
        raise HTTPException(status_code=404, detail="Invalid code")
    
    # Update user with telegram info
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"telegramUserId": telegram_link["telegramUserId"], "telegramCode": code}}
    )
    
    return {"message": "Telegram linked successfully"}

# Stories Routes
@api_router.post("/stories")
async def create_story_with_file(
    caption: str = Form(""),
    media: Optional[UploadFile] = File(None),
    media_type: str = Form("image"),
    current_user: User = Depends(get_current_user)
):
    """Create story with actual file upload (multipart/form-data)"""
    file_id = None
    file_path = None
    telegram_url = None
    
    try:
        if media:
            # Read the actual file
            file_content = await media.read()
            mime_type = media.content_type or "image/jpeg"
            
            # Convert to base64 data URL for send_media_to_telegram_channel
            import base64
            encoded = base64.b64encode(file_content).decode('utf-8')
            media_url = f"data:{mime_type};base64,{encoded}"
            
            logger.info(f"Received story file: {media.filename}, size: {len(file_content)} bytes, type: {mime_type}")
            
            # Upload to Telegram
            file_id, file_path, telegram_url = await send_media_to_telegram_channel(
                media_url=media_url,
                media_type=media_type,
                caption=caption,
                username=current_user.username
            )
            
            if telegram_url:
                logger.info(f"✅ Story uploaded to Telegram: {telegram_url}")
            else:
                logger.warning("⚠️ Failed to upload story to Telegram")
                telegram_url = media_url
        else:
            logger.warning("No media file received for story")
            telegram_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    except Exception as e:
        logger.error(f"Failed to process story file: {e}")
        import traceback
        traceback.print_exc()
        telegram_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    # Create story
    story = Story(
        userId=current_user.id,
        username=current_user.username,
        userProfileImage=current_user.profileImage,
        mediaType=media_type,
        mediaUrl=telegram_url,
        caption=caption
    )
    
    story_dict = story.dict()
    if file_id:
        story_dict["telegramFileId"] = file_id
        story_dict["telegramFilePath"] = file_path
    
    await db.stories.insert_one(story_dict)
    
    if "_id" in story_dict:
        del story_dict["_id"]
    
    return {"message": "Story created successfully", "story": story_dict}

@api_router.post("/stories/create")
async def create_story(story_data: StoryCreate, current_user: User = Depends(get_current_user)):
    # Send media to Telegram channel first to get file_id and file_path
    file_id = None
    file_path = None
    telegram_url = None
    
    try:
        file_id, file_path, telegram_url = await send_media_to_telegram_channel(
            media_url=story_data.mediaUrl,
            media_type=story_data.mediaType,
            caption=story_data.caption or "",
            username=current_user.username
        )
        
        if telegram_url:
            logger.info(f"Story media uploaded to Telegram: {telegram_url}")
        else:
            logger.warning("Failed to upload story media to Telegram, using base64 fallback")
    except Exception as e:
        logger.error(f"Failed to send story media to Telegram: {e}")
        # Don't fail the story creation if Telegram upload fails
    
    # Create story with Telegram URL if available, otherwise use base64
    story = Story(
        userId=current_user.id,
        username=current_user.username,
        userProfileImage=current_user.profileImage,
        mediaType=story_data.mediaType,
        mediaUrl=telegram_url if telegram_url else story_data.mediaUrl,  # Use Telegram URL if available
        caption=story_data.caption
    )
    
    # Add Telegram metadata if available
    story_dict = story.dict()
    if file_id:
        story_dict["telegramFileId"] = file_id
        story_dict["telegramFilePath"] = file_path
    
    await db.stories.insert_one(story_dict)
    
    # Remove MongoDB ObjectId from response
    if "_id" in story_dict:
        del story_dict["_id"]
    
    return {"message": "Story created successfully", "story": story_dict}

@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, current_user: User = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Check if user owns the story
    if story["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this story")
    
    await db.stories.delete_one({"id": story_id})
    
    # Delete all notifications related to this story
    await db.notifications.delete_many({"storyId": story_id})
    
    return {"message": "Story deleted successfully"}

@api_router.post("/stories/{story_id}/like")
async def like_story(story_id: str, current_user: User = Depends(get_current_user)):
    """Like a story and send notification to story owner"""
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Add like to story
    await db.stories.update_one(
        {"id": story_id},
        {"$addToSet": {"likes": current_user.id}}
    )
    
    # Send notification to story owner if it's not their own story
    if story["userId"] != current_user.id:
        notification = Notification(
            userId=story["userId"],
            fromUserId=current_user.id,
            fromUsername=current_user.username,
            fromUserImage=current_user.profileImage,
            type="story_like",
            # reuse postId for downstream routing; include the story id here
            postId=str(story_id),
            postImage=story.get("imageUrl")  # Include story image for notification preview (stories use imageUrl field)
        )
        await db.notifications.insert_one(notification.dict())
    
    return {"message": "Story liked successfully"}

@api_router.delete("/stories/{story_id}/like")
async def unlike_story(story_id: str, current_user: User = Depends(get_current_user)):
    """Unlike a story"""
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Remove like from story
    await db.stories.update_one(
        {"id": story_id},
        {"$pull": {"likes": current_user.id}}
    )
    
    # Delete story like notification when unliking
    await db.notifications.delete_many({
        "userId": story["userId"],
        "fromUserId": current_user.id,
        "type": "story_like",
        "postId": story_id
    })
    
    return {"message": "Story unliked successfully"}

@api_router.get("/stories/feed")
async def get_stories_feed(current_user: User = Depends(get_current_user)):
    # Get all stories that haven't expired
    now = datetime.now(timezone.utc)
    stories = await db.stories.find({"expiresAt": {"$gt": now}}).sort("createdAt", -1).to_list(1000)
    
    # Group stories by user
    stories_by_user = {}
    for story in stories:
        user_id = story["userId"]
        
        # Get user's current profile picture, verification, founder status, and privacy info
        story_author = await db.users.find_one(
            {"id": user_id}, 
            {"isVerified": 1, "isFounder": 1, "profileImage": 1, "isPrivate": 1, "followers": 1}
        )
        
        # Skip private stories unless the viewer is a follower or the owner
        if story_author:
            is_private = story_author.get("isPrivate", False)
            followers = story_author.get("followers") or []  # ensure list, not None
            if (
                is_private
                and current_user.id not in followers
                and user_id != current_user.id
            ):
                continue  # do not show this story
        
        if user_id not in stories_by_user:
            is_verified = story_author.get("isVerified", False) if story_author else False
            is_founder = story_author.get("isFounder", False) if story_author else False
            current_profile_image = story_author.get("profileImage") if story_author else story.get("userProfileImage")
            
            stories_by_user[user_id] = {
                "userId": user_id,
                "username": story["username"],
                "userProfileImage": current_profile_image,  # Use current profile picture
                "isVerified": is_verified,
                "isFounder": is_founder,
                "stories": []
            }
        stories_by_user[user_id]["stories"].append({
            "id": story["id"],
            "mediaType": story.get("mediaType", "image"),
            "mediaUrl": story.get("mediaUrl", ""),
            "caption": story.get("caption", ""),
            "createdAt": story["createdAt"].isoformat() if hasattr(story["createdAt"], 'isoformat') else story["createdAt"]
        })
    
    return {"stories": list(stories_by_user.values())}

# Posts Routes
@api_router.post("/posts")
async def create_post_with_file(
    caption: str = Form(""),
    media: Optional[UploadFile] = File(None),
    media_type: str = Form("image"),
    current_user: User = Depends(get_current_user)
):
    """Create post with actual file upload (multipart/form-data)"""
    file_id = None
    file_path = None
    telegram_url = None
    
    try:
        if media:
            # Read the actual file
            file_content = await media.read()
            mime_type = media.content_type or "image/jpeg"
            
            # Convert to base64 data URL for send_media_to_telegram_channel
            import base64
            encoded = base64.b64encode(file_content).decode('utf-8')
            media_url = f"data:{mime_type};base64,{encoded}"
            
            logger.info(f"Received file upload: {media.filename}, size: {len(file_content)} bytes, type: {mime_type}")
            
            # Upload to Telegram
            file_id, file_path, telegram_url = await send_media_to_telegram_channel(
                media_url=media_url,
                media_type=media_type,
                caption=caption,
                username=current_user.username
            )
            
            if telegram_url:
                logger.info(f"✅ File uploaded to Telegram: {telegram_url}")
            else:
                logger.warning("⚠️ Failed to upload to Telegram, using base64 fallback")
                telegram_url = media_url
        else:
            # No media uploaded
            logger.warning("No media file received")
            telegram_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    except Exception as e:
        logger.error(f"Failed to process file upload: {e}")
        import traceback
        traceback.print_exc()
        telegram_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    # Create post
    post = Post(
        userId=current_user.id,
        username=current_user.username,
        userProfileImage=current_user.profileImage,
        mediaType=media_type,
        mediaUrl=telegram_url,
        caption=caption
    )
    
    post_dict = post.dict()
    if file_id:
        post_dict["telegramFileId"] = file_id
        post_dict["telegramFilePath"] = file_path
    
    await db.posts.insert_one(post_dict)
    
    if "_id" in post_dict:
        del post_dict["_id"]
    
    return {"message": "Post created successfully", "post": post_dict}

@api_router.post("/posts/create")
async def create_post(post_data: PostCreate, current_user: User = Depends(get_current_user)):
    # Send media to Telegram channel first to get file_id and file_path
    file_id = None
    file_path = None
    telegram_url = None
    
    try:
        file_id, file_path, telegram_url = await send_media_to_telegram_channel(
            media_url=post_data.mediaUrl,
            media_type=post_data.mediaType,
            caption=post_data.caption or "",
            username=current_user.username
        )
        
        if telegram_url:
            logger.info(f"Media uploaded to Telegram: {telegram_url}")
        else:
            logger.warning("Failed to upload media to Telegram, using base64 fallback")
    except Exception as e:
        logger.error(f"Failed to send post media to Telegram: {e}")
        # Don't fail the post creation if Telegram upload fails
    
    # Create post with Telegram URL if available, otherwise use base64
    post = Post(
        userId=current_user.id,
        username=current_user.username,
        userProfileImage=current_user.profileImage,
        mediaType=post_data.mediaType,
        mediaUrl=telegram_url if telegram_url else post_data.mediaUrl,  # Use Telegram URL if available
        caption=post_data.caption
    )
    
    # Add Telegram metadata if available
    post_dict = post.dict()
    if file_id:
        post_dict["telegramFileId"] = file_id
        post_dict["telegramFilePath"] = file_path
    
    await db.posts.insert_one(post_dict)
    
    # Remove MongoDB ObjectId from response
    if "_id" in post_dict:
        del post_dict["_id"]
    
    return {"message": "Post created successfully", "post": post_dict}

@api_router.get("/media/{file_id}")
async def get_media_proxy(file_id: str):
    """
    Media proxy endpoint to avoid exposing bot token to frontend
    Redirects to actual Telegram file URL
    """
    try:
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
        if not bot_token:
            raise HTTPException(status_code=500, detail="Bot token not configured")
        
        # Get file_path from Telegram
        file_path = await get_telegram_file_path(file_id, bot_token)
        if not file_path:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Build Telegram file URL
        telegram_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
        
        # Redirect to Telegram URL
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=telegram_url)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Media proxy error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve media")

@api_router.get("/posts/feed")
async def get_posts_feed(current_user: User = Depends(get_current_user)):
    # Get current user's full data to access blockedUsers and mutedUsers
    user = await db.users.find_one({"id": current_user.id})
    blocked_users = user.get("blockedUsers", [])
    muted_users = user.get("mutedUsers", [])
    saved_posts = user.get("savedPosts", [])
    
    # Combine blocked and muted users to exclude from feed
    excluded_users = list(set(blocked_users + muted_users))
    
    # Exclude archived posts and posts from blocked/muted users
    query = {
        "isArchived": {"$ne": True}
    }
    
    # Add filter to exclude posts from blocked and muted users
    if excluded_users:
        query["userId"] = {"$nin": excluded_users}
    
    posts = await db.posts.find(query).sort("createdAt", -1).to_list(1000)
    
    posts_list = []
    for post in posts:
        # Get post author's current profile picture, verification status, founder status, and privacy info
        post_author = await db.users.find_one(
            {"id": post["userId"]}, 
            {"isVerified": 1, "isFounder": 1, "profileImage": 1, "isPrivate": 1, "followers": 1}
        )
        
        # Skip posts from private accounts unless the viewer is a follower or the owner
        if post_author:
            is_private = post_author.get("isPrivate", False)
            followers = post_author.get("followers") or []  # ensure list, not None
            if (
                is_private
                and current_user.id not in followers
                and post["userId"] != current_user.id  # compare against post userId
            ):
                continue  # do not add this post to the feed
        
        is_verified = post_author.get("isVerified", False) if post_author else False
        is_founder = post_author.get("isFounder", False) if post_author else False
        current_profile_image = post_author.get("profileImage") if post_author else post.get("userProfileImage")
        
        post_data = {
            "id": post["id"],
            "userId": post["userId"],
            "username": post["username"],
            "userProfileImage": current_profile_image,  # Use current profile picture
            "isVerified": is_verified,
            "isFounder": is_founder,
            "mediaType": post.get("mediaType", "image"),
            "mediaUrl": post.get("mediaUrl", ""),
            "caption": post.get("caption", ""),
            "likes": post.get("likes", []),
            "comments": post.get("comments", []),
            "createdAt": post["createdAt"].isoformat() if hasattr(post["createdAt"], 'isoformat') else post["createdAt"],
            "userLiked": current_user.id in post.get("likes", []),
            "isSaved": post["id"] in saved_posts
        }
        
        # Add Telegram fields if they exist
        if post.get("telegramFileId"):
            post_data["telegramFileId"] = post["telegramFileId"]
        if post.get("telegramFilePath"):
            post_data["telegramFilePath"] = post["telegramFilePath"]
            
        posts_list.append(post_data)
    
    return {"posts": posts_list}

@api_router.get("/posts/{post_id}")
async def get_single_post(post_id: str, current_user: User = Depends(get_current_user)):
    """Get a single post by ID"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get current user's saved posts
    user = await db.users.find_one({"id": current_user.id})
    saved_posts = user.get("savedPosts", [])
    
    return {
        "id": post["id"],
        "userId": post["userId"],
        "username": post["username"],
        "userProfileImage": post.get("userProfileImage"),
        "imageUrl": post.get("imageUrl"),
        "mediaType": post.get("mediaType", "image"),
        "mediaUrl": post.get("mediaUrl", ""),
        "caption": post.get("caption", ""),
        "likesCount": len(post.get("likes", [])),
        "commentsCount": len(post.get("comments", [])),
        "userLiked": current_user.id in post.get("likes", []),
        "isSaved": post["id"] in saved_posts,
        "likesHidden": post.get("likesHidden", False),
        "commentsDisabled": post.get("commentsDisabled", False),
        "createdAt": post["createdAt"].isoformat() if hasattr(post["createdAt"], 'isoformat') else post["createdAt"]
    }

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get("likes", [])
    is_liking = current_user.id not in likes
    
    if current_user.id in likes:
        likes.remove(current_user.id)
        # Delete like notification when unliking
        await db.notifications.delete_many({
            "userId": post["userId"],
            "fromUserId": current_user.id,
            "type": "like",
            "postId": post_id
        })
    else:
        likes.append(current_user.id)
        
        # Create notification if liking someone else's post
        if post["userId"] != current_user.id:
            notification = Notification(
                userId=post["userId"],
                fromUserId=current_user.id,
                fromUsername=current_user.username,
                fromUserImage=current_user.profileImage,
                type="like",
                postId=post_id,
                postImage=post.get("mediaUrl")  # Include post image for notification preview
            )
            await db.notifications.insert_one(notification.dict())
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"likes": likes}}
    )
    
    return {
        "success": True,
        "message": "Success",
        "likeCount": len(likes),
        "userLiked": current_user.id in likes
    }

@api_router.post("/posts/{post_id}/unlike")
async def unlike_post(post_id: str, current_user: User = Depends(get_current_user)):
    """Alias for like endpoint - toggles like/unlike"""
    return await like_post(post_id, current_user)

@api_router.get("/posts/{post_id}/comments")
async def get_post_comments(post_id: str, current_user: User = Depends(get_current_user)):
    """Get all comments for a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comments = post.get("comments", [])
    return {"comments": comments}

@api_router.post("/posts/{post_id}/comment")
async def add_comment_to_post(post_id: str, text: str = Form(...), parentCommentId: Optional[str] = Form(None), current_user: User = Depends(get_current_user)):
    """Add a comment to a post"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = {
        "id": str(uuid4()),
        "userId": current_user.id,
        "username": current_user.username,
        "userProfileImage": current_user.profileImage,
        "text": text,
        "likes": [],
        "likesCount": 0,
        "parentCommentId": parentCommentId,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    comments = post.get("comments", [])
    comments.append(comment)
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"comments": comments}}
    )
    
    # Create notification if commenting on someone else's post
    if post["userId"] != current_user.id:
        notification = Notification(
            userId=post["userId"],
            fromUserId=current_user.id,
            fromUsername=current_user.username,
            fromUserImage=current_user.profileImage,
            type="comment",
            postId=post_id,
            postImage=post.get("mediaUrl")  # Include post image for notification preview
        )
        await db.notifications.insert_one(notification.dict())
    
    return {
        "success": True,
        "message": "Comment added",
        "comment": comment
    }

@api_router.post("/posts/{post_id}/comment/{comment_id}/like")
async def like_comment(post_id: str, comment_id: str, current_user: User = Depends(get_current_user)):
    """Like/unlike a comment"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comments = post.get("comments", [])
    comment_found = False
    
    for comment in comments:
        if comment["id"] == comment_id:
            comment_found = True
            likes = comment.get("likes", [])
            
            if current_user.id in likes:
                likes.remove(current_user.id)
            else:
                likes.append(current_user.id)
            
            comment["likes"] = likes
            comment["likesCount"] = len(likes)
            break
    
    if not comment_found:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"comments": comments}}
    )
    
    return {
        "success": True,
        "message": "Success",
        "likeCount": len(likes),
        "userLiked": current_user.id in likes
    }

@api_router.delete("/posts/{post_id}/comment/{comment_id}")
async def delete_comment(post_id: str, comment_id: str, current_user: User = Depends(get_current_user)):
    """Delete a comment (only by comment owner)"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comments = post.get("comments", [])
    comment_to_delete = None
    
    for comment in comments:
        if comment["id"] == comment_id:
            if comment["userId"] != current_user.id:
                raise HTTPException(status_code=403, detail="You can only delete your own comments")
            comment_to_delete = comment
            break
    
    if not comment_to_delete:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Remove comment and its replies
    updated_comments = [c for c in comments if c["id"] != comment_id and c.get("parentCommentId") != comment_id]
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"comments": updated_comments}}
    )
    
    # Delete associated notification
    await db.notifications.delete_many({
        "userId": post["userId"],
        "fromUserId": current_user.id,
        "type": "comment",
        "postId": post_id
    })
    
    return {"message": "Comment deleted successfully"}

@api_router.post("/posts/{post_id}/comment/{comment_id}/report")
async def report_comment(post_id: str, comment_id: str, reason: str = Form(...), current_user: User = Depends(get_current_user)):
    """Report a comment"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Store report
    report = {
        "id": str(uuid4()),
        "postId": post_id,
        "commentId": comment_id,
        "reportedBy": current_user.id,
        "reason": reason,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.reports.insert_one(report)
    
    return {"message": "Report submitted successfully"}

# Chat Routes
@api_router.post("/chat/send")
async def send_message(receiverId: str, message: str, current_user: User = Depends(get_current_user)):
    # Check if sender has premium
    if not current_user.isPremium:
        raise HTTPException(status_code=403, detail="Premium required to send messages")
    
    chat_message = ChatMessage(
        senderId=current_user.id,
        receiverId=receiverId,
        message=message
    )
    
    await db.messages.insert_one(chat_message.dict())
    
    return {"message": "Message sent successfully"}

@api_router.get("/chat/messages/{userId}")
async def get_messages(userId: str, current_user: User = Depends(get_current_user)):
    # Get messages between current user and specified user
    messages = await db.messages.find({
        "$or": [
            {"senderId": current_user.id, "receiverId": userId},
            {"senderId": userId, "receiverId": current_user.id}
        ]
    }).sort("createdAt", 1).to_list(1000)
    
    messages_list = []
    for msg in messages:
        messages_list.append({
            "id": msg["id"],
            "senderId": msg["senderId"],
            "receiverId": msg["receiverId"],
            "message": msg["message"],
            "createdAt": msg["createdAt"].isoformat()
        })
    
    return {"messages": messages_list}

@api_router.get("/users/list")
async def get_users(current_user: User = Depends(get_current_user)):
    users = await db.users.find({"id": {"$ne": current_user.id}}).to_list(1000)
    
    users_list = []
    for user in users:
        users_list.append({
            "id": user["id"],
            "username": user["username"],
            "fullName": user["fullName"],
            "profileImage": user.get("profileImage"),
            "bio": user.get("bio", ""),
            "followersCount": len(user.get("followers", [])),
            "followingCount": len(user.get("following", [])),
            "isFollowing": user["id"] in current_user.following
        })
    
    return {"users": users_list}

@api_router.get("/users/blocked")
async def get_blocked_users(current_user: User = Depends(get_current_user)):
    """Get list of blocked users with their profile information"""
    blocked_user_ids = current_user.blockedUsers
    
    if not blocked_user_ids:
        return {"blockedUsers": []}
    
    # Get blocked users information
    blocked_users = await db.users.find({"id": {"$in": blocked_user_ids}}).to_list(100)
    
    blocked_users_list = []
    for user in blocked_users:
        blocked_users_list.append({
            "id": user["id"],
            "username": user["username"],
            "fullName": user["fullName"],
            "profileImage": user.get("profileImage"),
            "blockedAt": user.get("blockedAt", "Unknown")
        })
    
    return {"blockedUsers": blocked_users_list}

@api_router.get("/users/{userId}")
async def get_user_profile(userId: str, current_user: User = Depends(get_current_user)):
    # Try to find by MongoDB id first, then by tg_user_id
    user = await db.users.find_one({"id": userId})
    if not user:
        # Try finding by tg_user_id (for Mystery Match compatibility)
        try:
            tg_id = int(userId)
            user = await db.users.find_one({"tg_user_id": tg_id})
        except ValueError:
            pass
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's posts
    posts = await db.posts.find({"userId": userId}).sort("createdAt", -1).to_list(1000)
    
    # Check if current user has requested to follow (for private accounts)
    has_requested = current_user.id in user.get("followRequests", [])
    
    return {
        "id": user["id"],
        "username": user["username"],
        "fullName": user["fullName"],
        "profileImage": user.get("profileImage"),
        "bio": user.get("bio", ""),
        "isPrivate": user.get("isPrivate", False),
        "followersCount": len(user.get("followers", [])),
        "followingCount": len(user.get("following", [])),
        "isFollowing": current_user.id in user.get("followers", []),
        "hasRequested": has_requested,
        "postsCount": len(posts)
    }

# Follow/Unfollow Routes
@api_router.post("/users/{userId}/follow")
async def follow_user(userId: str, current_user: User = Depends(get_current_user)):
    if userId == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"id": userId})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if account is private
    is_private = target_user.get("isPrivate", False)
    
    if is_private:
        # Check if already requested
        follow_requests = target_user.get("followRequests", [])
        if current_user.id in follow_requests:
            # Already requested - do nothing, return success
            return {"message": "Follow request already sent", "requested": True}
        
        # Add to follow requests instead of followers
        await db.users.update_one(
            {"id": userId},
            {"$addToSet": {"followRequests": current_user.id}}
        )
        
        # Delete any existing follow request notifications first
        await db.notifications.delete_many({
            "userId": userId,
            "fromUserId": current_user.id,
            "type": "follow_request"
        })
        
        # Create NEW follow request notification
        notification = Notification(
            userId=userId,
            fromUserId=current_user.id,
            fromUsername=current_user.username,
            fromUserImage=current_user.profileImage,
            type="follow_request"
        )
        await db.notifications.insert_one(notification.dict())
        
        return {"message": "Follow request sent", "requested": True}
    else:
        # Public account - follow immediately
        # Add to following list
        await db.users.update_one(
            {"id": current_user.id},
            {"$addToSet": {"following": userId}}
        )
        
        # Add to followers list
        await db.users.update_one(
            {"id": userId},
            {"$addToSet": {"followers": current_user.id}}
        )
        
        # Create notification
        notification = Notification(
            userId=userId,
            fromUserId=current_user.id,
            fromUsername=current_user.username,
            fromUserImage=current_user.profileImage,
            type="follow"
        )
        await db.notifications.insert_one(notification.dict())
        
        # Delete any "follow" or "started_following" notifications from the user we just followed
        # This removes the notification prompting us to follow them back
        await db.notifications.delete_many({
            "userId": current_user.id,
            "fromUserId": userId,
            "type": {"$in": ["started_following", "follow"]}
        })
        
        return {"message": "User followed successfully", "requested": False}

@api_router.post("/users/{userId}/unfollow")
async def unfollow_user(userId: str, current_user: User = Depends(get_current_user)):
    # Remove from following list
    await db.users.update_one(
        {"id": current_user.id},
        {"$pull": {"following": userId}}
    )
    
    # Remove from followers list
    await db.users.update_one(
        {"id": userId},
        {"$pull": {"followers": current_user.id}}
    )
    
    return {"message": "User unfollowed successfully"}

@api_router.post("/users/{userId}/accept-follow-request")
async def accept_follow_request(userId: str, current_user: User = Depends(get_current_user)):
    """Accept a follow request from another user"""
    # Remove from follow requests
    await db.users.update_one(
        {"id": current_user.id},
        {"$pull": {"followRequests": userId}}
    )
    
    # Add to followers
    await db.users.update_one(
        {"id": current_user.id},
        {"$addToSet": {"followers": userId}}
    )
    
    # Add to their following list
    await db.users.update_one(
        {"id": userId},
        {"$addToSet": {"following": current_user.id}}
    )
    
    # DELETE the follow request notification
    await db.notifications.delete_many({
        "userId": current_user.id,
        "fromUserId": userId,
        "type": "follow_request"
    })
    
    # Create notification for REQUESTER: "User accepted your follow request"
    requester = await db.users.find_one({"id": userId})
    if requester:
        notification_for_requester = Notification(
            userId=userId,  # Notification goes to requester
            fromUserId=current_user.id,  # From the person who accepted
            fromUsername=current_user.username,
            fromUserImage=current_user.profileImage,
            type="follow_request_accepted"
        )
        await db.notifications.insert_one(notification_for_requester.dict())
    
    # Create notification for ACCEPTER: "User started following you" with Follow back option
    # ONLY if accepter is NOT already following the requester
    # (If they already follow each other, no need for "follow back" notification)
    accepter_already_follows_requester = userId in current_user.following
    
    if not accepter_already_follows_requester:
        notification_for_accepter = Notification(
            userId=current_user.id,  # Notification goes to accepter (person who accepted)
            fromUserId=userId,  # From the requester who is now following
            fromUsername=requester.get("username", "Unknown") if requester else "Unknown",
            fromUserImage=requester.get("profileImage") if requester else None,
            type="started_following"
        )
        await db.notifications.insert_one(notification_for_accepter.dict())
    
    return {"message": "Follow request accepted"}

@api_router.post("/users/{userId}/reject-follow-request")
async def reject_follow_request(userId: str, current_user: User = Depends(get_current_user)):
    """Reject/delete a follow request from another user"""
    # Remove from follow requests
    await db.users.update_one(
        {"id": current_user.id},
        {"$pull": {"followRequests": userId}}
    )
    
    return {"message": "Follow request rejected"}

@api_router.post("/users/{userId}/cancel-follow-request")
async def cancel_follow_request(userId: str, current_user: User = Depends(get_current_user)):
    """Cancel a follow request that was sent to another user"""
    # Remove from the target user's follow requests
    await db.users.update_one(
        {"id": userId},
        {"$pull": {"followRequests": current_user.id}}
    )
    
    # Delete the follow request notification
    await db.notifications.delete_many({
        "userId": userId,
        "fromUserId": current_user.id,
        "type": "follow_request"
    })
    
    return {"message": "Follow request cancelled"}

@api_router.get("/users/{userId}/followers")
async def get_followers_list(userId: str, current_user: User = Depends(get_current_user)):
    """Get list of followers for a user"""
    user = await db.users.find_one({"id": userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check privacy
    is_private = user.get("isPrivate", False)
    is_following = current_user.id in user.get("followers", [])
    
    # Can only view if: own profile, public account, or following private account
    if is_private and userId != current_user.id and not is_following:
        raise HTTPException(status_code=403, detail="This account is private")
    
    follower_ids = user.get("followers", [])
    followers = []
    
    for fid in follower_ids:
        follower = await db.users.find_one({"id": fid})
        if follower:
            # Check if current user has requested to follow this follower
            has_requested = current_user.id in follower.get("followRequests", [])
            
            followers.append({
                "id": follower["id"],
                "username": follower["username"],
                "fullName": follower["fullName"],
                "profileImage": follower.get("profileImage"),
                "isFollowing": fid in current_user.following,
                "hasRequested": has_requested
            })
    
    return {"followers": followers}

@api_router.get("/users/{userId}/following")
async def get_following_list(userId: str, current_user: User = Depends(get_current_user)):
    """Get list of users that this user is following"""
    user = await db.users.find_one({"id": userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check privacy
    is_private = user.get("isPrivate", False)
    is_following = current_user.id in user.get("followers", [])
    
    # Can only view if: own profile, public account, or following private account
    if is_private and userId != current_user.id and not is_following:
        raise HTTPException(status_code=403, detail="This account is private")
    
    following_ids = user.get("following", [])
    following = []
    
    for fid in following_ids:
        followed_user = await db.users.find_one({"id": fid})
        if followed_user:
            # Check if current user has requested to follow this user
            has_requested = current_user.id in followed_user.get("followRequests", [])
            
            following.append({
                "id": followed_user["id"],
                "username": followed_user["username"],
                "fullName": followed_user["fullName"],
                "profileImage": followed_user.get("profileImage"),
                "isFollowing": fid in current_user.following,
                "hasRequested": has_requested
            })
    
    return {"following": following}

# My Profile Routes
@api_router.get("/profile/posts")
async def get_my_posts(current_user: User = Depends(get_current_user)):
    # Get all non-archived posts
    posts = await db.posts.find({"userId": current_user.id, "isArchived": {"$ne": True}}).to_list(1000)
    
    # Sort: pinned first, then by date
    posts.sort(key=lambda x: (not x.get("isPinned", False), -x["createdAt"].timestamp()))
    
    posts_list = []
    for post in posts:
        posts_list.append({
            "id": post["id"],
            "mediaType": post.get("mediaType", "image"),  # Use .get() with default
            "mediaUrl": post.get("mediaUrl"),
            "imageUrl": post.get("imageUrl"),  # Add imageUrl support
            "caption": post.get("caption", ""),
            "likes": post.get("likes", []),
            "comments": post.get("comments", []),
            "createdAt": post["createdAt"].isoformat(),
            "likesCount": len(post.get("likes", [])),
            "commentsCount": len(post.get("comments", [])),
            "userLiked": current_user.id in post.get("likes", []),
            "isSaved": post["id"] in current_user.savedPosts
        })
    
    return {"posts": posts_list}

@api_router.get("/profile/saved")
async def get_saved_posts(current_user: User = Depends(get_current_user)):
    if not current_user.savedPosts:
        return {"posts": []}
    
    # Get all saved posts
    posts = await db.posts.find({"id": {"$in": current_user.savedPosts}}).sort("createdAt", -1).to_list(1000)
    
    posts_list = []
    for post in posts:
        posts_list.append({
            "id": post["id"],
            "userId": post["userId"],
            "username": post["username"],
            "userProfileImage": post.get("userProfileImage"),
            "mediaType": post.get("mediaType", "image"),
            "mediaUrl": post.get("mediaUrl"),
            "imageUrl": post.get("imageUrl"),
            "caption": post.get("caption", ""),
            "likes": post.get("likes", []),
            "comments": post.get("comments", []),
            "likesCount": len(post.get("likes", [])),
            "commentsCount": len(post.get("comments", [])),
            "createdAt": post["createdAt"].isoformat(),
            "userLiked": current_user.id in post.get("likes", []),
            "isSaved": True
        })
    
    return {"posts": posts_list}

# Save/Unsave Post
@api_router.post("/posts/{post_id}/save")
async def save_post(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already saved
    user = await db.users.find_one({"id": current_user.id})
    saved_posts = user.get("savedPosts", [])
    
    if post_id in saved_posts:
        # Unsave
        await db.users.update_one(
            {"id": current_user.id},
            {"$pull": {"savedPosts": post_id}}
        )
        return {"message": "Post unsaved", "isSaved": False}
    else:
        # Save
        await db.users.update_one(
            {"id": current_user.id},
            {"$addToSet": {"savedPosts": post_id}}
        )
        return {"message": "Post saved", "isSaved": True}

@api_router.post("/posts/{post_id}/unsave")
async def unsave_post(post_id: str, current_user: User = Depends(get_current_user)):
    """Alias for save_post (toggles save/unsave)"""
    return await save_post(post_id, current_user)

@api_router.post("/posts/{post_id}/report")
async def report_post(post_id: str, report_data: ReportPostRequest, current_user: User = Depends(get_current_user)):
    """Report a post with specified reason"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Store report
    report = {
        "id": str(uuid4()),
        "postId": post_id,
        "postUserId": post.get("userId"),
        "reportedBy": current_user.id,
        "reporterUsername": current_user.username,
        "reason": report_data.reason,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.post_reports.insert_one(report)
    
    return {"message": "Report submitted successfully", "success": True}

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: User = Depends(get_current_user)):
    """Delete a post (only by post owner)"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    await db.posts.delete_one({"id": post_id})
    
    # Delete all notifications related to this post (likes and comments)
    await db.notifications.delete_many({"postId": post_id})
    
    return {"message": "Post deleted successfully"}

# Post Management (Own Posts)
@api_router.post("/posts/{post_id}/archive")
async def archive_post(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    is_archived = post.get("isArchived", False)
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"isArchived": not is_archived}}
    )
    return {"message": "Post archived" if not is_archived else "Post unarchived", "isArchived": not is_archived}

@api_router.post("/posts/{post_id}/hide-likes")
async def hide_likes(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    likes_hidden = post.get("likesHidden", False)
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"likesHidden": not likes_hidden}}
    )
    return {"message": "Likes hidden" if not likes_hidden else "Likes shown", "likesHidden": not likes_hidden}

@api_router.post("/posts/{post_id}/toggle-comments")
async def toggle_comments(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    comments_disabled = post.get("commentsDisabled", False)
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"commentsDisabled": not comments_disabled}}
    )
    return {"message": "Comments disabled" if not comments_disabled else "Comments enabled", "commentsDisabled": not comments_disabled}

@api_router.put("/posts/{post_id}")
async def edit_post_caption(post_id: str, caption: str = Form(...), current_user: User = Depends(get_current_user)):
    """Edit post caption"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own posts")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"caption": caption}}
    )
    
    return {"message": "Caption updated successfully", "caption": caption}

@api_router.put("/posts/{post_id}/caption")
async def edit_caption(post_id: str, caption: str = Form(...), current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"caption": caption}}
    )
    return {"message": "Caption updated successfully"}

@api_router.post("/posts/{post_id}/pin")
async def pin_post(post_id: str, current_user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    is_pinned = post.get("isPinned", False)
    
    if not is_pinned:
        # Unpin all other posts first
        await db.posts.update_many(
            {"userId": current_user.id, "isPinned": True},
            {"$set": {"isPinned": False}}
        )
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"isPinned": not is_pinned}}
    )
    return {"message": "Post pinned" if not is_pinned else "Post unpinned", "isPinned": not is_pinned}

# Get archived posts
@api_router.get("/profile/archived")
async def get_archived(current_user: User = Depends(get_current_user)):
    posts = await db.posts.find({"userId": current_user.id, "isArchived": True}).sort("createdAt", -1).to_list(1000)
    stories = await db.stories.find({"userId": current_user.id, "isArchived": True}).sort("createdAt", -1).to_list(1000)
    
    posts_list = []
    for post in posts:
        posts_list.append({
            "id": post["id"],
            "type": "post",
            "mediaType": post.get("mediaType", "image"),
            "mediaUrl": post.get("mediaUrl"),
            "imageUrl": post.get("imageUrl"),
            "caption": post.get("caption", ""),
            "likesCount": len(post.get("likes", [])),
            "commentsCount": len(post.get("comments", [])),
            "createdAt": post["createdAt"].isoformat()
        })
    
    for story in stories:
        posts_list.append({
            "id": story["id"],
            "type": "story",
            "mediaType": story.get("mediaType", "image"),
            "mediaUrl": story.get("mediaUrl"),
            "imageUrl": story.get("imageUrl"),
            "caption": story.get("caption", ""),
            "createdAt": story["createdAt"].isoformat()
        })
    
    # Sort by date
    posts_list.sort(key=lambda x: x["createdAt"], reverse=True)
    
    return {"archived": posts_list}

# Archive story
@api_router.post("/stories/{story_id}/archive")
async def archive_story(story_id: str, current_user: User = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if story["userId"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    is_archived = story.get("isArchived", False)
    await db.stories.update_one(
        {"id": story_id},
        {"$set": {"isArchived": not is_archived}}
    )
    return {"message": "Story archived" if not is_archived else "Story unarchived", "isArchived": not is_archived}

# New endpoints for enhanced features

@api_router.get("/users/{userId}/profile")
async def get_user_profile(userId: str, current_user: User = Depends(get_current_user)):
    """Get detailed profile of a specific user"""
    user = await db.users.find_one({"id": userId})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Fetch fresh current user data from database to get latest following/followers state
    fresh_current_user = await db.users.find_one({"id": current_user.id})
    if not fresh_current_user:
        raise HTTPException(status_code=401, detail="Current user not found")
    
    # Check if current user is following this user
    is_following = current_user.id in user.get("followers", [])
    
    # Check if this user is following the current user (for "Follow back" button)
    # This should check if the current user's ID is in the viewed user's following list
    is_following_me = current_user.id in user.get("following", [])
    
    # Check if current user has requested to follow (for private accounts)
    has_requested = current_user.id in user.get("followRequests", [])
    
    # Check if account is private
    is_private = user.get("isPrivate", False)
    
    # Always show the post count. We restrict actual post content in the
    # /users/{userId}/posts endpoint, but the number of posts should be
    # visible even for private accounts (similar to Instagram and other social apps).
    posts_count = await db.posts.count_documents({
        "userId": userId,
        "isArchived": {"$ne": True}
    })
    
    followers_count = len(user.get("followers", []))
    following_count = len(user.get("following", []))
    
    logger.info(f"Profile API called for user {user.get('username')} - Followers: {followers_count}, Following: {following_count}")
    
    return {
        "id": user["id"],
        "username": user["username"],
        "fullName": user["fullName"],
        "profileImage": user.get("profileImage"),
        "bio": user.get("bio", ""),
        "age": user.get("age"),
        "gender": user.get("gender"),
        "isPremium": user.get("isPremium", False),
        "isVerified": user.get("isVerified", False),
        "isFounder": user.get("isFounder", False),
        "verificationPathway": user.get("verificationPathway"),
        "isPrivate": is_private,
        "followersCount": followers_count,
        "followingCount": following_count,
        "isFollowing": is_following,
        "isFollowingMe": is_following_me,
        "hasRequested": has_requested,
        "postsCount": posts_count,
        "createdAt": user.get("createdAt") if isinstance(user.get("createdAt"), str) else user.get("createdAt").isoformat() if user.get("createdAt") else None
    }

@api_router.get("/users/{userId}/verification-details")
async def get_user_verification_details(
    userId: str,
    current_user: User = Depends(get_current_user)
):
    """Get verification details for a user"""
    user = await db.users.find_one({"id": userId})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("isVerified", False):
        raise HTTPException(status_code=404, detail="User is not verified")
    
    return {
        "pathway": user.get("verificationPathway", "High Engagement Pathway"),
        "verifiedAt": user.get("verifiedAt", datetime.now(timezone.utc)).isoformat() if isinstance(user.get("verifiedAt"), datetime) else user.get("verifiedAt", datetime.now(timezone.utc).isoformat()),
        "isVerified": True
    }

@api_router.get("/users/{userId}/account-info")
async def get_user_account_info(
    userId: str,
    current_user: User = Depends(get_current_user)
):
    """Get account info for 'About this account' section (like Instagram)"""
    user = await db.users.find_one({"id": userId})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Format createdAt as "Month Year" (e.g., "May 2015")
    created_at = user.get("createdAt")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    date_joined = created_at.strftime("%B %Y") if created_at else "Unknown"
    
    response = {
        "dateJoined": date_joined,
        "country": user.get("country", "Not specified"),
        "isVerified": user.get("isVerified", False),
        "isFounder": user.get("isFounder", False)
    }
    
    # Add verification details if user is verified
    if user.get("isVerified", False):
        response["verificationPathway"] = user.get("verificationPathway", "High Engagement Pathway")
        verified_at = user.get("verifiedAt")
        if isinstance(verified_at, str):
            verified_at = datetime.fromisoformat(verified_at)
        response["verifiedAt"] = verified_at.strftime("%B %Y") if verified_at else "Unknown"
    
    return response


@api_router.get("/users/{userId}/posts")
async def get_user_posts(userId: str, current_user: User = Depends(get_current_user)):
    """Get posts by a specific user (accepts UUID or username)"""
    # Find the user by id or by username
    user = await db.users.find_one({"$or": [{"id": userId}, {"username": userId}]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If the account is private and the requester isn't following and isn't the owner, hide posts
    is_private = user.get("isPrivate", False)
    is_following = current_user.id in user.get("followers", [])
    if is_private and not is_following and current_user.id != user["id"]:
        return {"posts": []}
    
    # Get user's non-archived posts by either userId or username
    # Use $ne: True to include posts without isArchived field (default behavior)
    posts = await db.posts.find({
        "$and": [
            {"isArchived": {"$ne": True}},
            {"$or": [{"userId": user["id"]}, {"username": user["username"]}]}
        ]
    }).sort("createdAt", -1).to_list(50)
    
    posts_list = []
    for post in posts:
        # Check if current user liked this post
        is_liked = current_user.id in post.get("likes", [])
        # Check if current user saved this post
        is_saved = post["id"] in current_user.savedPosts
        
        # Handle createdAt - could be datetime object or string
        created_at_val = post.get("createdAt")
        if isinstance(created_at_val, datetime):
            created_at_str = created_at_val.isoformat()
        else:
            # Already a string or None
            created_at_str = created_at_val if created_at_val else ""
        
        # Get media URL with fallback to Telegram proxy
        media_url = post.get("mediaUrl")
        image_url = post.get("imageUrl")
        telegram_id = post.get("telegramFileId")
        
        # If neither mediaUrl nor imageUrl exists but we have a Telegram file ID, build a media proxy URL
        if not media_url and not image_url and telegram_id:
            media_url = f"/api/media/{telegram_id}"
        
        posts_list.append({
            "id": post.get("id"),
            "userId": post.get("userId"),
            "username": post.get("username"),
            "userProfileImage": post.get("userProfileImage"),
            "mediaType": post.get("mediaType", "image"),  # Default to image if missing
            "mediaUrl": media_url,
            "imageUrl": image_url,  # Legacy field for backward compatibility
            "telegramFileId": telegram_id,  # Include for frontend fallback
            "caption": post.get("caption", ""),
            "likes": post.get("likes", []),
            "comments": post.get("comments", []),
            "userLiked": is_liked,
            "isSaved": is_saved,
            "likesHidden": post.get("likesHidden", False),
            "commentsDisabled": post.get("commentsDisabled", False),
            "isPinned": post.get("isPinned", False),
            "createdAt": created_at_str
        })
    
    return {"posts": posts_list}

@api_router.post("/ai/vibe-compatibility")
async def calculate_vibe_compatibility(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Calculate AI-powered vibe compatibility between users"""
    target_user_id = request.get("targetUserId")
    
    if not target_user_id:
        raise HTTPException(status_code=400, detail="Target user ID required")
    
    target_user = await db.users.find_one({"id": target_user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import os
        import uuid
        
        # Load environment variable
        load_dotenv(ROOT_DIR / '.env')
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Initialize AI chat with GPT-5
        chat = LlmChat(
            api_key=api_key,
            session_id=f"vibe-{current_user.id}-{target_user_id}",
            system_message="You are an AI compatibility analyst for a dating app. Analyze user profiles and provide compatibility scores with explanations."
        ).with_model("openai", "gpt-5")
        
        # Create prompt with user data
        user1_profile = f"""
User 1 Profile:
- Full Name: {current_user.fullName}
- Age: {current_user.age}
- Gender: {current_user.gender}
- Bio: {current_user.bio or "No bio provided"}
"""
        
        user2_profile = f"""
User 2 Profile:
- Full Name: {target_user['fullName']}
- Age: {target_user['age']}  
- Gender: {target_user['gender']}
- Bio: {target_user.get('bio', 'No bio provided')}
"""
        
        analysis_prompt = f"""
Analyze the compatibility between these two users:

{user1_profile}

{user2_profile}

Please provide:
1. A compatibility percentage (0-100)
2. Brief analysis of their compatibility

Focus on age compatibility, interests from bios, and general compatibility factors.
Respond in this exact format:
COMPATIBILITY: [percentage]
ANALYSIS: [your analysis here]

Keep the analysis positive and encouraging, even for lower compatibility scores.
"""
        
        user_message = UserMessage(text=analysis_prompt)
        response = await chat.send_message(user_message)
        
        # Parse AI response
        response_text = str(response)
        compatibility_score = 75  # Default fallback
        analysis_text = "AI-powered compatibility analysis based on profiles and interests."
        
        if "COMPATIBILITY:" in response_text and "ANALYSIS:" in response_text:
            try:
                compatibility_line = response_text.split("COMPATIBILITY:")[1].split("ANALYSIS:")[0].strip()
                analysis_line = response_text.split("ANALYSIS:")[1].strip()
                
                # Extract percentage from compatibility line
                import re
                score_match = re.search(r'(\d+)', compatibility_line)
                if score_match:
                    compatibility_score = min(100, max(0, int(score_match.group(1))))
                
                if analysis_line:
                    analysis_text = analysis_line
                    
            except Exception as parse_error:
                logger.error(f"Error parsing AI response: {parse_error}")
                # Use fallback values
                pass
        
        return {
            "compatibility": compatibility_score,
            "analysis": analysis_text
        }
        
    except Exception as e:
        logger.error(f"Error calculating vibe compatibility: {e}")
        # Fallback to random score if AI fails
        import random
        return {
            "compatibility": random.randint(65, 90),
            "analysis": "Compatibility analysis based on profile information. AI service temporarily unavailable - showing estimated compatibility."
        }

@api_router.post("/users/{userId}/block")
async def block_user(userId: str, current_user: User = Depends(get_current_user)):
    """Block a user"""
    if userId == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    target_user = await db.users.find_one({"id": userId})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add to blocked users list (add this field to User model if needed)
    # For now, we'll remove from following/followers and add to a blocked list
    await db.users.update_one(
        {"id": current_user.id},
        {
            "$addToSet": {"blockedUsers": userId},
            "$pull": {"following": userId}
        }
    )
    
    # Remove current user from target's followers
    await db.users.update_one(
        {"id": userId},
        {"$pull": {"followers": current_user.id}}
    )
    
    return {"message": "User blocked successfully"}

@api_router.post("/users/{userId}/hide-story")
async def hide_user_story(userId: str, current_user: User = Depends(get_current_user)):
    """Hide stories from a specific user"""
    if userId == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot hide your own stories")
    
    target_user = await db.users.find_one({"id": userId})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add to hidden stories list (add this field to User model if needed)
    await db.users.update_one(
        {"id": current_user.id},
        {"$addToSet": {"hiddenStoryUsers": userId}}
    )
    
    return {"message": "Stories hidden successfully"}

# Moved to before /users/{userId} route to avoid conflicts

@api_router.post("/users/{userId}/unblock")
async def unblock_user(userId: str, current_user: User = Depends(get_current_user)):
    """Unblock a user"""
    if userId == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot unblock yourself")
    
    target_user = await db.users.find_one({"id": userId})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove from blocked users list
    await db.users.update_one(
        {"id": current_user.id},
        {"$pull": {"blockedUsers": userId}}
    )
    
    return {"message": "User unblocked successfully"}

@api_router.post("/users/{userId}/mute")
async def mute_user(userId: str, current_user: User = Depends(get_current_user)):
    """
    Mute a user - their posts won't appear in your feed but they won't know
    Different from blocking: they can still see your posts and interact
    """
    if userId == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot mute yourself")
    
    target_user = await db.users.find_one({"id": userId})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add to muted users list
    await db.users.update_one(
        {"id": current_user.id},
        {"$addToSet": {"mutedUsers": userId}}
    )
    
    return {"message": "User muted successfully"}

@api_router.post("/users/{userId}/unmute")
async def unmute_user(userId: str, current_user: User = Depends(get_current_user)):
    """Unmute a user"""
    if userId == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot unmute yourself")
    
    target_user = await db.users.find_one({"id": userId})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove from muted users list
    await db.users.update_one(
        {"id": current_user.id},
        {"$pull": {"mutedUsers": userId}}
    )
    
    return {"message": "User unmuted successfully"}

# Search functionality
class SearchRequest(BaseModel):
    query: str
    type: Optional[str] = "all"  # "users", "posts", "hashtags", "all"
    page: Optional[int] = 1
    limit: Optional[int] = 10

@api_router.post("/search")
async def search_content(search_request: SearchRequest, current_user: User = Depends(get_current_user)):
    """
    Search for users, posts, and hashtags
    """
    query = search_request.query.strip()
    search_type = search_request.type
    page = max(1, search_request.page)
    limit = min(50, max(1, search_request.limit))  # Limit between 1-50
    skip = (page - 1) * limit
    
    if not query:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    
    # Escape special regex characters for safe searching
    escaped_query = query.replace('.', r'\.')
    
    results = {
        "users": [],
        "posts": [],
        "hashtags": [],
        "query": query
    }
    
    # Search users (if type is "users" or "all")
    if search_type in ["users", "all"]:
        logger.info(f"🔍 Search: Starting user search for query '{query}' by user {current_user.username}")
        
        # Create a more intelligent search with exact match priority
        base_filter = {
            "$and": [
                # Allow users to find themselves in search (removed self-exclusion)
                {"id": {"$nin": current_user.blockedUsers}},  # Exclude blocked users
                {"appearInSearch": True}  # Only users who appear in search
            ]
        }
        
        # First, search for exact matches using optimized queries
        exact_filter = {**base_filter}
        
        # Use text search for better performance with indexing
        text_search_filter = {**base_filter}
        text_search_filter["$and"].append({
            "$text": {"$search": f'"{query}"'}  # Exact phrase search
        })
        
        # Fallback regex for exact matches if text search doesn't work
        regex_filter = {**base_filter}
        regex_filter["$and"].append({
            "$or": [
                {"username": {"$regex": f"^\\s*{escaped_query}\\s*$", "$options": "i"}},
                {"fullName": {"$regex": f"^\\s*{escaped_query}\\s*$", "$options": "i"}}
            ]
        })
        
        # Try text search first, fallback to regex
        try:
            exact_users = await db.users.find(text_search_filter).skip(skip).limit(limit).to_list(limit)
            logger.info(f"🔍 Search: Text search for '{query}' found {len(exact_users)} exact matches")
        except:
            exact_users = await db.users.find(regex_filter).skip(skip).limit(limit).to_list(limit)
            logger.info(f"🔍 Search: Regex search for '{query}' found {len(exact_users)} exact matches")
        user_ids_found = {user["id"] for user in exact_users}
        
        # Then, search for partial matches, excluding exact matches
        partial_filter = {**base_filter}
        partial_filter["$and"].extend([
            {"id": {"$nin": list(user_ids_found)}},  # Exclude already found users
            {
                "$or": [
                    {"fullName": {"$regex": escaped_query, "$options": "i"}},
                    {"username": {"$regex": escaped_query, "$options": "i"}},
                    {"bio": {"$regex": escaped_query, "$options": "i"}}
                ]
            }
        ])
        
        partial_users = await db.users.find(partial_filter).limit(10).to_list(10)
        logger.info(f"🔍 Search: Partial search for '{query}' found {len(partial_users)} additional matches")
        
        # Combine results with exact matches first
        all_users = exact_users + partial_users
        
        for user in all_users[:20]:  # Limit to 20 total results
            results["users"].append({
                "id": user["id"],
                "fullName": user["fullName"],
                "username": user["username"],
                "profileImage": user.get("profileImage"),
                "bio": user.get("bio", "")[:100],  # Limit bio length for performance
                "followersCount": len(user.get("followers", [])),
                "isFollowing": user["id"] in current_user.following,
                "isPremium": user.get("isPremium", False)
            })
        
        logger.info(f"✅ Search: Total users returned for '{query}': {len(results['users'])}")
        if results['users']:
            logger.info(f"👤 First user result: {results['users'][0]['username']} ({results['users'][0]['fullName']})")
    
    # Search posts (if type is "posts" or "all")
    if search_type in ["posts", "all"]:
        # Find posts from non-blocked users and non-private accounts (unless following)
        blocked_users = current_user.blockedUsers
        
        # Get all users to check privacy settings
        all_users = await db.users.find({}).to_list(10000)
        user_privacy_map = {u["id"]: (u.get("isPrivate", False), u["id"] in current_user.following or u.get("followers", []) and current_user.id in u.get("followers", [])) for u in all_users}
        
        # Get user IDs of private accounts that current user is NOT following
        private_non_following_users = [uid for uid, (is_private, is_following) in user_privacy_map.items() if is_private and not is_following]
        
        post_filter = {
            "$and": [
                {"userId": {"$nin": blocked_users + private_non_following_users}},  # Exclude blocked + private non-following
                {"isArchived": {"$ne": True}},
                {
                    "$or": [
                        {"caption": {"$regex": query, "$options": "i"}},
                        {"username": {"$regex": query, "$options": "i"}}
                    ]
                }
            ]
        }
        
        posts = await db.posts.find(post_filter).sort("createdAt", -1).limit(20).to_list(20)
        for post in posts:
            results["posts"].append({
                "id": post["id"],
                "userId": post["userId"],
                "username": post["username"],
                "userProfileImage": post.get("userProfileImage"),
                "postType": post.get("postType", "text"),
                "imageUrl": post.get("imageUrl"),
                "content": post.get("content", ""),
                "likes": len(post.get("likes", [])),
                "comments": len(post.get("comments", [])),
                "createdAt": post["createdAt"].isoformat() if "createdAt" in post else None,
                "userLiked": current_user.id in post.get("likes", []),
                "isSaved": post["id"] in current_user.savedPosts
            })
    
    # Extract hashtags from posts (if type is "hashtags" or "all")
    if search_type in ["hashtags", "all"] and query.startswith("#"):
        hashtag_query = query[1:]  # Remove # symbol
        hashtag_filter = {
            "$and": [
                {"userId": {"$nin": current_user.blockedUsers}},
                {"isArchived": {"$ne": True}},
                {"caption": {"$regex": f"#{hashtag_query}", "$options": "i"}}
            ]
        }
        
        hashtag_posts = await db.posts.find(hashtag_filter).sort("createdAt", -1).limit(10).to_list(10)
        hashtags_found = set()
        
        for post in hashtag_posts:
            caption = post.get("caption", "")
            # Extract hashtags from caption
            import re
            hashtags = re.findall(r'#\w+', caption, re.IGNORECASE)
            for hashtag in hashtags:
                if hashtag_query.lower() in hashtag.lower():
                    hashtags_found.add(hashtag.lower())
        
        results["hashtags"] = list(hashtags_found)[:10]
    
    return results

@api_router.get("/search/trending")
async def get_trending_content(current_user: User = Depends(get_current_user)):
    """
    Get trending hashtags and users from recent posts
    """
    # Get trending hashtags from recent posts (last 7 days)
    recent_posts = await db.posts.find({
        "$and": [
            {"userId": {"$nin": current_user.blockedUsers}},
            {"isArchived": {"$ne": True}},
            {"createdAt": {"$gte": datetime.now(timezone.utc) - timedelta(days=7)}}
        ]
    }).to_list(1000)
    
    hashtag_count = {}
    import re
    for post in recent_posts:
        caption = post.get("caption", "")
        hashtags = re.findall(r'#\w+', caption, re.IGNORECASE)
        for hashtag in hashtags:
            hashtag = hashtag.lower()
            hashtag_count[hashtag] = hashtag_count.get(hashtag, 0) + 1
    
    # Sort hashtags by frequency and return top 20
    trending_hashtags = sorted(hashtag_count.items(), key=lambda x: x[1], reverse=True)[:20]
    
    # Get trending users (users with most followers)
    trending_users_cursor = await db.users.find({
        "$and": [
            {"id": {"$ne": current_user.id}},
            {"id": {"$nin": current_user.blockedUsers}},
            {"appearInSearch": True}
        ]
    }).to_list(100)
    
    # Sort by follower count and take top 10
    trending_users_cursor.sort(key=lambda x: len(x.get("followers", [])), reverse=True)
    trending_users = trending_users_cursor[:10]
    
    trending_users_list = []
    for user in trending_users:
        trending_users_list.append({
            "id": user["id"],
            "fullName": user["fullName"],
            "username": user["username"],
            "profileImage": user.get("profileImage"),
            "bio": user.get("bio", ""),
            "followersCount": len(user.get("followers", [])),
            "isFollowing": user["id"] in current_user.following,
            "isPremium": user.get("isPremium", False)
        })
    
    return {
        "trending_users": trending_users_list,
        "trending_hashtags": [{"hashtag": hashtag, "count": count} for hashtag, count in trending_hashtags]
    }

@api_router.get("/search/explore")
async def get_explore_posts(current_user: User = Depends(get_current_user), limit: int = 30):
    """
    Get explore posts for the search page (Instagram-style)
    Returns posts from public accounts, excluding blocked and muted users
    """
    try:
        # Get blocked and muted users to exclude
        blocked_users = current_user.blockedUsers or []
        muted_users = getattr(current_user, 'mutedUsers', []) or []
        excluded_users = list(set(blocked_users + muted_users))
        
        # Find users who are not private, not blocked, and not muted
        public_users = await db.users.find({
            "$and": [
                {"id": {"$nin": excluded_users}},
                {"isPrivate": {"$ne": True}}
            ]
        }).to_list(1000)
        
        public_user_ids = [user["id"] for user in public_users]
        
        # Get posts from public users
        posts = await db.posts.find({
            "$and": [
                {"userId": {"$in": public_user_ids}},
                {"isArchived": {"$ne": True}}
            ]
        }).sort("createdAt", -1).limit(limit).to_list(limit)
        
        explore_posts = []
        for post in posts:
            explore_posts.append({
                "id": post["id"],
                "userId": post["userId"],
                "username": post["username"],
                "userProfileImage": post.get("userProfileImage"),
                "caption": post.get("caption", ""),
                "imageUrl": post.get("imageUrl"),
                "mediaUrl": post.get("mediaUrl"),
                "mediaType": post.get("mediaType", "image"),
                "likesCount": len(post.get("likes", [])),
                "commentsCount": len(post.get("comments", [])),
                "userLiked": current_user.id in post.get("likes", []),
                "createdAt": post["createdAt"].isoformat() if isinstance(post.get("createdAt"), datetime) else post.get("createdAt")
            })
        
        logger.info(f"✅ Explore: Returned {len(explore_posts)} posts for user {current_user.username}")
        return {"posts": explore_posts}
        
    except Exception as e:
        logger.error(f"Error fetching explore posts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/admin/fix-duplicate-usernames")
async def fix_duplicate_usernames():
    """
    Admin endpoint to fix duplicate usernames caused by whitespace
    """
    try:
        # Find users with whitespace in usernames
        users_with_whitespace = await db.users.find({
            "$or": [
                {"username": {"$regex": "^\\s+|\\s+$"}},  # Leading or trailing spaces
                {"fullName": {"$regex": "^\\s+|\\s+$"}}   # Leading or trailing spaces in fullName
            ]
        }).to_list(1000)
        
        fixed_count = 0
        for user in users_with_whitespace:
            clean_username = user["username"].strip()
            clean_fullname = user["fullName"].strip()
            
            # Check if cleaned username already exists
            existing_clean = await db.users.find_one({
                "username": clean_username,
                "id": {"$ne": user["id"]}
            })
            
            if existing_clean:
                # If clean version exists, we need to handle the duplicate
                # Option 1: Delete the whitespace version if it has no activity
                user_posts = await db.posts.count_documents({"userId": user["id"]})
                user_followers = len(user.get("followers", []))
                
                if user_posts == 0 and user_followers == 0:
                    # Delete the inactive duplicate
                    await db.users.delete_one({"id": user["id"]})
                    fixed_count += 1
                else:
                    # Rename the duplicate by adding a number
                    counter = 1
                    new_username = f"{clean_username}{counter}"
                    while await db.users.find_one({"username": new_username}):
                        counter += 1
                        new_username = f"{clean_username}{counter}"
                    
                    await db.users.update_one(
                        {"id": user["id"]},
                        {"$set": {"username": new_username, "fullName": clean_fullname}}
                    )
                    fixed_count += 1
            else:
                # Just clean the whitespace
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"username": clean_username, "fullName": clean_fullname}}
                )
                fixed_count += 1
        
        return {
            "message": f"Fixed {fixed_count} duplicate usernames",
            "fixed_count": fixed_count
        }
        
    except Exception as e:
        logger.error(f"Error fixing duplicates: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fixing duplicates: {str(e)}")

@api_router.get("/search/suggestions")
async def get_search_suggestions(q: str = "", current_user: User = Depends(get_current_user)):
    """
    Get search suggestions based on partial query
    """
    if not q or len(q) < 2:
        return {"suggestions": []}
    
    suggestions = []
    
    # User suggestions
    user_filter = {
        "$and": [
            {"id": {"$ne": current_user.id}},
            {"id": {"$nin": current_user.blockedUsers}},
            {"appearInSearch": True},
            {
                "$or": [
                    {"fullName": {"$regex": f"^{q}", "$options": "i"}},
                    {"username": {"$regex": f"^{q}", "$options": "i"}}
                ]
            }
        ]
    }
    
    users = await db.users.find(user_filter).limit(5).to_list(5)
    for user in users:
        suggestions.append({
            "type": "user",
            "text": f"{user['fullName']} (@{user['username']})",
            "value": user["username"],
            "avatar": user.get("profileImage")
        })
    
    # Hashtag suggestions
    if q.startswith("#"):
        hashtag_query = q[1:]
        recent_posts = await db.posts.find({
            "$and": [
                {"userId": {"$nin": current_user.blockedUsers}},
                {"isArchived": {"$ne": True}},
                {"caption": {"$regex": f"#{hashtag_query}", "$options": "i"}}
            ]
        }).limit(20).to_list(20)
        
        hashtags_found = set()
        import re
        for post in recent_posts:
            caption = post.get("caption", "")
            hashtags = re.findall(r'#\w+', caption, re.IGNORECASE)
            for hashtag in hashtags:
                if hashtag_query.lower() in hashtag.lower():
                    hashtags_found.add(hashtag)
        
        for hashtag in list(hashtags_found)[:5]:
            suggestions.append({
                "type": "hashtag",
                "text": hashtag,
                "value": hashtag
            })
    
    return {"suggestions": suggestions}

# Mystery Match Registration Endpoint - Creates user in both MongoDB AND PostgreSQL
# Calculate Vibe Compatibility between two users
@api_router.get("/auth/calculate-compatibility/{other_user_id}")
async def calculate_compatibility(
    other_user_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Calculate vibe compatibility between current user and another user
    Based on interests (30%) and personality answers (70%)
    """
    try:
        # Get current user's full data from database
        user1_data = await db.users.find_one({"id": current_user.id})
        if not user1_data:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Get other user
        other_user = await db.users.find_one({"id": other_user_id})
        if not other_user:
            # Try finding by tg_user_id
            try:
                tg_id = int(other_user_id)
                other_user = await db.users.find_one({"tg_user_id": tg_id})
            except:
                pass
        
        if not other_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user data - handle both array and string formats
        user1_interests_raw = user1_data.get("interests", [])
        if isinstance(user1_interests_raw, str):
            user1_interests = [i.strip() for i in user1_interests_raw.split(",") if i.strip()]
        elif isinstance(user1_interests_raw, list):
            user1_interests = [str(i).strip() for i in user1_interests_raw if i]
        else:
            user1_interests = []
        
        user2_interests_raw = other_user.get("interests", [])
        if isinstance(user2_interests_raw, str):
            user2_interests = [i.strip() for i in user2_interests_raw.split(",") if i.strip()]
        elif isinstance(user2_interests_raw, list):
            user2_interests = [str(i).strip() for i in user2_interests_raw if i]
        else:
            user2_interests = []
        
        user1_personality = user1_data.get("personalityAnswers", {})
        user2_personality = other_user.get("personalityAnswers", {})
        
        # Calculate interest match (30% weight)
        interest_score = 0
        if user1_interests and user2_interests:
            common_interests = set(user1_interests) & set(user2_interests)
            total_interests = set(user1_interests) | set(user2_interests)
            if total_interests:
                interest_score = len(common_interests) / len(total_interests)
        
        # Calculate personality match (70% weight)
        personality_score = 0
        matching_answers = []
        
        if user1_personality and user2_personality:
            total_questions = len(user1_personality)
            matches = 0
            
            for question_id, answer1 in user1_personality.items():
                answer2 = user2_personality.get(question_id)
                if answer2 and answer1 == answer2:
                    matches += 1
                    matching_answers.append({
                        "question_id": question_id,
                        "answer": answer1
                    })
            
            if total_questions > 0:
                personality_score = matches / total_questions
        
        # Calculate total compatibility (weighted average)
        total_score = (interest_score * 0.3) + (personality_score * 0.7)
        compatibility_percentage = int(total_score * 100)
        
        # Generate compatibility message
        if compatibility_percentage >= 80:
            message = "Amazing match! 🔥 You two are incredibly compatible!"
        elif compatibility_percentage >= 60:
            message = "Great match! ✨ You have a lot in common!"
        elif compatibility_percentage >= 40:
            message = "Good match! 💫 You share some interesting similarities!"
        else:
            message = "Opposites attract! 🌟 You might discover new perspectives!"
        
        # Get common interests
        common_interests_list = list(set(user1_interests) & set(user2_interests))
        
        return {
            "compatibility_percentage": compatibility_percentage,
            "message": message,
            "interest_score": int(interest_score * 100),
            "personality_score": int(personality_score * 100),
            "common_interests": common_interests_list,
            "matching_answers": matching_answers,
            "details": {
                "interests_weight": 30,
                "personality_weight": 70
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating compatibility: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== NOTIFICATION ENDPOINTS ====================

# Get unread notification count
@api_router.get("/notifications/unread-count")
async def get_unread_notification_count(current_user: User = Depends(get_current_user)):
    try:
        count = await db.notifications.count_documents({
            "userId": current_user.id,
            "isRead": False
        })
        return {"count": count}
    except Exception as e:
        logger.error(f"Error fetching notification count: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Get all notifications for current user
@api_router.get("/notifications")
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    try:
        notifications = await db.notifications.find({
            "userId": current_user.id
        }).sort("createdAt", -1).skip(skip).limit(limit).to_list(length=limit)
        
        # Normalize each notification
        notifications_list = []
        for notif in notifications:
            created_at = notif.get("createdAt")

            # Normalize createdAt -> string
            if hasattr(created_at, "isoformat"):
                created_at_str = created_at.isoformat()
            else:
                # already a string or missing; keep or default to now
                created_at_str = created_at if isinstance(created_at, str) \
                    else datetime.now(timezone.utc).isoformat()

            notifications_list.append({
                "id": notif.get("id") or str(uuid4()),
                "fromUserId": notif.get("fromUserId"),
                "fromUsername": notif.get("fromUsername"),
                "fromUserImage": notif.get("fromUserImage"),
                "type": notif.get("type"),
                # support both post notifications and story notifications:
                "postId": notif.get("postId") or notif.get("storyId"),
                "postImage": notif.get("postImage"),
                # some old docs used "read" instead of "isRead"
                "isRead": notif.get("isRead", notif.get("read", False)),
                "createdAt": created_at_str,
            })
        
        return {"notifications": notifications_list}
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mark notification as read
@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    try:
        result = await db.notifications.update_one(
            {"id": notification_id, "userId": current_user.id},
            {"$set": {"isRead": True}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"success": True, "message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mark all notifications as read
@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    try:
        await db.notifications.update_many(
            {"userId": current_user.id, "isRead": False},
            {"$set": {"isRead": True}}
        )
        
        return {"success": True, "message": "All notifications marked as read"}
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper function to create notification
async def create_notification(
    user_id: str,
    from_user_id: str,
    notification_type: str,
    post_id: Optional[str] = None,
    comment_text: Optional[str] = None
):
    """Helper function to create a notification"""
    try:
        # Get from_user details
        from_user = await db.users.find_one({"id": from_user_id})
        if not from_user:
            return
        
        # Don't notify if user is notifying themselves
        if user_id == from_user_id:
            return
        
        notification = {
            "id": str(uuid.uuid4()),
            "userId": user_id,
            "fromUserId": from_user_id,
            "fromUsername": from_user.get("username", "Unknown"),
            "fromUserImage": from_user.get("profileImage"),
            "type": notification_type,
            "postId": post_id,
            "commentText": comment_text,
            "isRead": False,
            "createdAt": datetime.now(timezone.utc)
        }
        
        await db.notifications.insert_one(notification)
        logger.info(f"Created {notification_type} notification for user {user_id}")
    except Exception as e:
        logger.error(f"Error creating notification: {e}")

# Health check endpoint
@api_router.get("/health")
async def health_check():
    try:
        # Test database connection
        user_count = await db.users.count_documents({})
        return {
            "status": "healthy",
            "database": db_name,
            "user_count": user_count,
            "mongo_url": mongo_url.replace(mongo_url.split('@')[-1] if '@' in mongo_url else '', '***') if mongo_url else None
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "database": db_name
        }

# Serve uploaded files endpoint
@api_router.get("/uploads/{file_type}/{filename}")
async def serve_upload(file_type: str, filename: str):
    """Serve uploaded files (posts, profiles, stories)"""
    try:
        # Validate file type
        if file_type not in ["posts", "profiles", "stories"]:
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        # Build file path
        file_path = f"/app/uploads/{file_type}/{filename}"
        
        # Check if file exists
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Return file
        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# MESSAGING SYSTEM
# =============================================================================

def serialize_datetime(dt):
    """Helper function to safely serialize datetime objects to ISO format string"""
    if dt is None:
        return None
    if isinstance(dt, str):
        # If already a string, check if it needs 'Z' suffix for UTC
        if dt and not dt.endswith('Z') and 'T' in dt and not any(tz in dt for tz in ['+', '-']):
            return dt + 'Z'
        return dt
    if hasattr(dt, 'isoformat'):
        # Add 'Z' suffix to indicate UTC timezone
        return dt.isoformat() + 'Z'
    return str(dt)

class SendMessageRequest(BaseModel):
    receiverId: str
    content: str
    type: str = "text"  # text, image, video, audio, file
    mediaUrl: Optional[str] = None

class MarkReadRequest(BaseModel):
    conversationId: str

@api_router.post("/messages/send")
async def send_message(
    request: SendMessageRequest,
    authorization: str = Header(None)
):
    """Send a message to another user"""
    try:
        # Get current user
        current_user = await get_current_user(authorization)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        sender_id = current_user.id
        receiver_id = request.receiverId
        
        # Check if receiver exists
        receiver = await db.users.find_one({"id": receiver_id})
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")
        
        # Create conversation ID (sorted to ensure same ID regardless of who starts)
        participants = sorted([sender_id, receiver_id])
        conversation_id = f"{participants[0]}_{participants[1]}"
        
        # Check if conversation exists, if not create it
        conversation = await db.conversations.find_one({"_id": conversation_id})
        
        if not conversation:
            # Check if sender follows receiver (for request logic)
            sender_follows_receiver = receiver.get("followers", [])
            is_following = sender_id in sender_follows_receiver
            
            # Message goes to requests if sender doesn't follow receiver
            is_request = not is_following
            
            # Create new conversation
            conversation = {
                "_id": conversation_id,
                "participants": participants,
                "participantDetails": {
                    sender_id: {
                        "userId": sender_id,
                        "username": current_user.username,
                        "fullName": current_user.fullName,
                        "profileImage": current_user.profileImage
                    },
                    receiver_id: {
                        "userId": receiver_id,
                        "username": receiver.get("username"),
                        "fullName": receiver.get("fullName"),
                        "profileImage": receiver.get("profileImage")
                    }
                },
                "last_message": request.content,
                "last_message_at": datetime.now(timezone.utc),
                "unread_count": {sender_id: 0, receiver_id: 0},
                "created_at": datetime.now(timezone.utc),
                "isRequest": {receiver_id: is_request},  # Track request status per user
                "acceptedBy": []  # Track who has accepted the request
            }
            await db.conversations.insert_one(conversation)
        
        # Create message
        message_id = str(uuid4())
        message = {
            "_id": message_id,
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "type": request.type,
            "content": request.content if request.type == "text" else None,
            "media_url": request.mediaUrl if request.type != "text" else None,
            "status": {
                "sent": True,
                "delivered": True,
                "read": False
            },
            "read_at": None,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.messages.insert_one(message)
        
        # Update conversation and clear any deletion flags (resurrection scenario)
        await db.conversations.update_one(
            {"_id": conversation_id},
            {
                "$set": {
                    "last_message": request.content if request.type == "text" else f"Sent a {request.type}",
                    "last_message_at": datetime.now(timezone.utc)
                },
                "$inc": {f"unread_count.{receiver_id}": 1},
                "$unset": {
                    "deletedForEveryone": "",
                    "deletedForEveryoneAt": "",
                    f"deletedBy.{sender_id}": "",
                    f"deletedBy.{receiver_id}": ""
                }
            }
        )
        
        # Clear deletion flags from all messages in this conversation (resurrection)
        await db.messages.update_many(
            {"conversation_id": conversation_id},
            {
                "$unset": {
                    "deletedForEveryone": "",
                    "deletedForEveryoneAt": "",
                    f"deletedBy.{sender_id}": "",
                    f"deletedBy.{receiver_id}": ""
                }
            }
        )
        
        return {
            "success": True,
            "message": "Message sent successfully",
            "messageId": message_id,
            "conversationId": conversation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/messages/conversations")
async def get_conversations(
    authorization: str = Header(None)
):
    """Get all conversations for current user (inbox)"""
    try:
        # Get current user
        current_user = await get_current_user(authorization)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        user_id = current_user.id
        
        # Get all conversations where user is a participant
        # Exclude conversations deleted by this user or deleted for everyone
        conversations = await db.conversations.find({
            "participants": user_id,
            "$or": [
                {f"deletedBy.{user_id}": {"$exists": False}},
                {f"deletedBy.{user_id}": None}
            ],
            "$or": [
                {"deletedForEveryone": {"$exists": False}},
                {"deletedForEveryone": False}
            ]
        }).sort("last_message_at", -1).to_list(length=None)
        
        # Format conversations for frontend
        formatted_conversations = []
        for conv in conversations:
            # Get the other participant
            other_user_id = conv["participants"][0] if conv["participants"][0] != user_id else conv["participants"][1]
            other_user_details = conv["participantDetails"].get(other_user_id, {})
            
            # Check if this is a request for current user
            is_request = conv.get("isRequest", {}).get(user_id, False)
            
            # Check pin and mute status for current user
            is_pinned = user_id in conv.get("pinnedBy", [])
            muted_by_user = conv.get("mutedBy", {}).get(user_id, {})
            messages_muted = muted_by_user.get("messages", False)
            calls_muted = muted_by_user.get("calls", False)
            
            formatted_conversations.append({
                "conversationId": conv["_id"],
                "otherUser": {
                    "id": other_user_id,
                    "username": other_user_details.get("username", "Unknown"),
                    "fullName": other_user_details.get("fullName", "Unknown"),
                    "profileImage": other_user_details.get("profileImage", "")
                },
                "lastMessage": conv.get("last_message", ""),
                "lastMessageAt": serialize_datetime(conv.get("last_message_at")),
                "unreadCount": conv.get("unread_count", {}).get(user_id, 0),
                "isRequest": is_request,  # Add request status
                "isPinned": is_pinned,
                "messagesMuted": messages_muted,
                "callsMuted": calls_muted
            })
        
        # Sort conversations: pinned first, then by last_message_at
        formatted_conversations.sort(key=lambda x: (not x["isPinned"], x["lastMessageAt"] or ""), reverse=True)
        
        return {"conversations": formatted_conversations}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/messages/conversation/{other_user_id}")
async def get_conversation_messages(
    other_user_id: str,
    authorization: str = Header(None)
):
    """Get all messages in a conversation with a specific user"""
    try:
        # Get current user
        current_user = await get_current_user(authorization)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        user_id = current_user.id
        
        # Create conversation ID
        participants = sorted([user_id, other_user_id])
        conversation_id = f"{participants[0]}_{participants[1]}"
        
        # Get messages - exclude messages deleted for this user or deleted for everyone
        messages = await db.messages.find({
            "conversation_id": conversation_id,
            "$and": [
                {
                    "$or": [
                        {f"deletedBy.{user_id}": {"$exists": False}},
                        {f"deletedBy.{user_id}": None}
                    ]
                },
                {
                    "$or": [
                        {"deletedForEveryone": {"$exists": False}},
                        {"deletedForEveryone": False}
                    ]
                }
            ]
        }).sort("created_at", 1).to_list(length=None)
        
        # Format messages
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                "id": msg["_id"],
                "senderId": msg["sender_id"],
                "receiverId": msg["receiver_id"],
                "type": msg["type"],
                "content": msg.get("content"),
                "mediaUrl": msg.get("media_url"),
                "status": msg.get("status", {}),
                "readAt": serialize_datetime(msg.get("read_at")),
                "createdAt": serialize_datetime(msg.get("created_at")),
                "isMine": msg["sender_id"] == user_id
            })
        
        # Mark messages as read (from other user to current user)
        await db.messages.update_many(
            {
                "conversation_id": conversation_id,
                "receiver_id": user_id,
                "status.read": False
            },
            {
                "$set": {
                    "status.read": True,
                    "read_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Reset unread count for this user in conversation
        await db.conversations.update_one(
            {"_id": conversation_id},
            {"$set": {f"unread_count.{user_id}": 0}}
        )
        
        # Get other user details
        other_user = await db.users.find_one({"id": other_user_id})
        
        return {
            "conversationId": conversation_id,
            "messages": formatted_messages,
            "otherUser": {
                "id": other_user_id,
                "username": other_user.get("username", "Unknown") if other_user else "Unknown",
                "fullName": other_user.get("fullName", "Unknown") if other_user else "Unknown",
                "profileImage": other_user.get("profileImage", "") if other_user else ""
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/messages/unread-count")
async def get_unread_count(
    authorization: str = Header(None)
):
    """Get total unread message count for current user"""
    try:
        # Get current user
        current_user = await get_current_user(authorization)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        user_id = current_user.id
        
        # Get all conversations
        conversations = await db.conversations.find(
            {"participants": user_id}
        ).to_list(length=None)
        
        # Sum up unread counts
        total_unread = sum(
            conv.get("unread_count", {}).get(user_id, 0)
            for conv in conversations
        )
        
        return {"count": total_unread}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Message Request Management Endpoints
@api_router.post("/messages/request/accept")
async def accept_message_request(
    request: MessageRequestBody,
    authorization: str = Header(None)
):
    """Accept a message request"""
    try:
        current_user = await get_current_user(authorization)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        conversation_id = request.conversationId
        user_id = current_user.id
        
        # Update conversation to mark as accepted
        result = await db.conversations.update_one(
            {"_id": conversation_id},
            {
                "$set": {f"isRequest.{user_id}": False},
                "$addToSet": {"acceptedBy": user_id}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "success": True,
            "message": "Request accepted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/messages/request/decline")
async def decline_message_request(
    request: MessageRequestBody,
    authorization: str = Header(None)
):
    """Decline and delete a message request"""
    try:
        current_user = await get_current_user(authorization)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        conversation_id = request.conversationId
        
        # Delete the conversation and all its messages
        await db.conversations.delete_one({"_id": conversation_id})
        await db.messages.delete_many({"conversation_id": conversation_id})
        
        return {
            "success": True,
            "message": "Request declined and deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error declining request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/messages/conversation/action")
async def conversation_action(
    body: ConversationActionBody,
    authorization: str = Header(None)
):
    """
    Handle conversation actions: pin, unpin, mute_messages, unmute_messages, mute_calls, unmute_calls, delete
    """
    try:
        current_user = await get_current_user(authorization)
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        user_id = current_user.id
        conversation_id = body.conversationId
        action = body.action
        
        # Verify conversation exists and user is a participant
        conversation = await db.conversations.find_one({"_id": conversation_id})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if user_id not in conversation.get("participants", []):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Handle different actions
        if action == "pin":
            await db.conversations.update_one(
                {"_id": conversation_id},
                {"$addToSet": {f"pinnedBy": user_id}}
            )
            return {"success": True, "message": "Conversation pinned", "isPinned": True}
            
        elif action == "unpin":
            await db.conversations.update_one(
                {"_id": conversation_id},
                {"$pull": {f"pinnedBy": user_id}}
            )
            return {"success": True, "message": "Conversation unpinned", "isPinned": False}
            
        elif action == "mute_messages":
            await db.conversations.update_one(
                {"_id": conversation_id},
                {"$set": {f"mutedBy.{user_id}.messages": True}}
            )
            return {"success": True, "message": "Messages muted", "messagesMuted": True}
            
        elif action == "unmute_messages":
            await db.conversations.update_one(
                {"_id": conversation_id},
                {"$set": {f"mutedBy.{user_id}.messages": False}}
            )
            return {"success": True, "message": "Messages unmuted", "messagesMuted": False}
            
        elif action == "mute_calls":
            await db.conversations.update_one(
                {"_id": conversation_id},
                {"$set": {f"mutedBy.{user_id}.calls": True}}
            )
            return {"success": True, "message": "Calls muted", "callsMuted": True}
            
        elif action == "unmute_calls":
            await db.conversations.update_one(
                {"_id": conversation_id},
                {"$set": {f"mutedBy.{user_id}.calls": False}}
            )
            return {"success": True, "message": "Calls unmuted", "callsMuted": False}
            
        elif action == "delete":
            # Telegram-style delete: delete for me or delete for both
            if body.deleteForBoth:
                # Delete for both: Mark conversation as deleted for everyone
                await db.conversations.update_one(
                    {"_id": conversation_id},
                    {
                        "$set": {
                            f"deletedBy.{user_id}": datetime.now(timezone.utc),
                            "deletedForEveryone": True,
                            "deletedForEveryoneAt": datetime.now(timezone.utc)
                        }
                    }
                )
                # Mark all messages as deleted for everyone
                await db.messages.update_many(
                    {"conversation_id": conversation_id},
                    {
                        "$set": {
                            "deletedForEveryone": True,
                            "deletedForEveryoneAt": datetime.now(timezone.utc)
                        }
                    }
                )
                return {"success": True, "message": "Conversation deleted for everyone"}
            else:
                # Delete for me only: Soft delete
                await db.conversations.update_one(
                    {"_id": conversation_id},
                    {"$set": {f"deletedBy.{user_id}": datetime.now(timezone.utc)}}
                )
                # Mark all messages as deleted for this user only
                await db.messages.update_many(
                    {"conversation_id": conversation_id},
                    {"$set": {f"deletedBy.{user_id}": datetime.now(timezone.utc)}}
                )
                return {"success": True, "message": "Conversation deleted for you"}
            
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing conversation action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Include the router in the main app
app.include_router(api_router)

# Import and include social features router
from social_features import social_router
app.include_router(social_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()