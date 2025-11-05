#!/usr/bin/env python3
"""
Simple startup script for the Telegram Bot with our LuvHive integration
"""
import os
import sys
import asyncio
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
BOT_TOKEN = "7616389435:AAG9ZfKU-Ebib32NmVtchBBVh4gkxJ0BGN8"
MEDIA_SINK_CHAT_ID = "-1003149424510"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "luvhive_database"
JWT_SECRET = "QlaolWgCBGayKjOvqKtma7bBjJDKT3q3SI9_nQYyHt0"

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

class TelegramBot:
    def __init__(self):
        self.application = Application.builder().token(BOT_TOKEN).build()
        self.setup_handlers()
    
    def setup_handlers(self):
        """Setup bot command handlers"""
        # Command handlers
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("help", self.help_command))
        self.application.add_handler(CommandHandler("auth", self.auth_command))
        
        # Message handlers
        self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        user = update.effective_user
        logger.info(f"User {user.id} ({user.username}) started the bot")
        
        welcome_text = f"""
🌹 Welcome to LuvHive! 🌹

Hi {user.first_name}! 

I'm your LuvHive bot. I can help you:
• 🔐 Authenticate with your LuvHive account
• 💬 Receive notifications 
• 🎮 Access exclusive features

Use /auth to link your account or visit our web app:
https://luvhive-login-fix.preview.emergentagent.com

Need help? Use /help
        """
        
        await update.message.reply_text(welcome_text)
    
    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        help_text = """
🆘 LuvHive Bot Help

**Available Commands:**
/start - Welcome message and setup
/auth - Link your LuvHive account
/help - Show this help message

**How to authenticate:**
1. Use /auth command
2. I'll generate a secure link
3. Login through the web app
4. Your account will be linked!

**Need more help?**
Visit: https://luvhive-login-fix.preview.emergentagent.com
        """
        
        await update.message.reply_text(help_text)
    
    async def auth_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle authentication"""
        user = update.effective_user
        
        # Check if user already exists in database
        existing_user = await db.users.find_one({"telegramId": user.id})
        
        if existing_user:
            await update.message.reply_text(
                f"✅ You're already registered as {existing_user.get('username', 'User')}!\n\n"
                f"Visit your profile: https://luvhive-login-fix.preview.emergentagent.com"
            )
            return
        
        # Create authentication token
        auth_payload = {
            "telegram_id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "username": user.username,
            "timestamp": datetime.utcnow().isoformat(),
            "exp": datetime.utcnow() + timedelta(hours=1)
        }
        
        auth_token = jwt.encode(auth_payload, JWT_SECRET, algorithm="HS256")
        
        auth_url = f"https://luvhive-login-fix.preview.emergentagent.com/auth/telegram?token={auth_token}"
        
        auth_text = f"""
🔐 **Telegram Authentication**

Click the link below to securely link your Telegram account:
{auth_url}

⏰ This link expires in 1 hour
🔒 Your data is encrypted and secure

After clicking:
1. You'll be automatically logged in
2. Complete your profile if needed
3. Start using LuvHive!
        """
        
        await update.message.reply_text(auth_text)
        logger.info(f"Generated auth token for user {user.id}")
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle regular text messages"""
        user = update.effective_user
        message_text = update.message.text
        
        logger.info(f"Message from {user.id}: {message_text}")
        
        # Check if user is authenticated
        existing_user = await db.users.find_one({"telegramId": user.id})
        
        if existing_user:
            response = f"Hi {existing_user.get('fullName', user.first_name)}! 👋\n\n"
            response += "I received your message. Visit the LuvHive web app to chat with other users!\n\n"
            response += "🌐 https://luvhive-login-fix.preview.emergentagent.com"
        else:
            response = "👋 Hi! You're not registered yet.\n\n"
            response += "Use /auth to link your Telegram account with LuvHive!\n\n"
            response += "Or visit: https://luvhive-login-fix.preview.emergentagent.com"
        
        await update.message.reply_text(response)
    
    async def run(self):
        """Start the bot"""
        logger.info("🚀 Starting LuvHive Telegram Bot...")
        logger.info(f"🤖 Bot username: @Loveekisssbot")
        logger.info(f"🌐 Web app: https://luvhive-login-fix.preview.emergentagent.com")
        
        await self.application.run_polling(drop_pending_updates=True)

async def main():
    """Main function"""
    try:
        bot = TelegramBot()
        await bot.run()
    except KeyboardInterrupt:
        logger.info("🛑 Bot stopped by user")
    except Exception as e:
        logger.error(f"❌ Bot error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())