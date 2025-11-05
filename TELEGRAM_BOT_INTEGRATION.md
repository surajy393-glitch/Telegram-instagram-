# 🤖 Telegram Bot Integration Guide

## Quick Setup for Your Telegram Bot

### Step 1: Update Bot URL in Webapp

Replace `your_bot_username` with your actual Telegram bot username in these files:

**File 1:** `/app/frontend/src/pages/ProfilePage.js` (Line ~136)
```javascript
// Find this line:
onClick={() => window.open("https://t.me/your_bot_username", "_blank")}

// Change to:
onClick={() => window.open("https://t.me/YOUR_ACTUAL_BOT_USERNAME", "_blank")}
```

**File 2:** `/app/frontend/src/pages/ChatPage.js` (Line ~160)
```javascript
// Find this line:
onClick={() => window.open("https://t.me/your_bot_username", "_blank")}

// Change to:
onClick={() => window.open("https://t.me/YOUR_ACTUAL_BOT_USERNAME", "_blank")}
```

### Step 2: Add Account Linking in Your Telegram Bot

Add this code to your Telegram bot to generate link codes:

```python
from telegram import Update
from telegram.ext import ContextTypes, CommandHandler
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime

# MongoDB connection (same as webapp)
mongo_client = AsyncIOMotorClient("mongodb://localhost:27017")
db = mongo_client["luvhive_database"]

async def link_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate link code for webapp"""
    user_id = update.effective_user.id
    
    # Generate 8-character code
    link_code = str(uuid.uuid4())[:8].upper()
    
    # Save to database
    await db.telegram_links.insert_one({
        "code": link_code,
        "telegramUserId": str(user_id),
        "createdAt": datetime.utcnow()
    })
    
    # Send to user
    await update.message.reply_text(
        f"🔗 *Link Your Webapp Account*\n\n"
        f"Your link code: `{link_code}`\n\n"
        f"1. Go to https://chatfix-luvhive.preview.emergentagent.com\n"
        f"2. Login to your account\n"
        f"3. Go to Profile page\n"
        f"4. Enter this code to link your Telegram account\n\n"
        f"This code is valid for 24 hours.",
        parse_mode="Markdown"
    )

# Add to your bot
application.add_handler(CommandHandler("link", link_account))
```

### Step 3: Add Premium Purchase Handler

Add this to handle premium purchases:

```python
async def buy_premium(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle premium purchase"""
    user_id = str(update.effective_user.id)
    
    # Your payment logic here (Stripe, Razorpay, etc.)
    # After successful payment:
    
    # Update user as premium in database
    result = await db.users.update_one(
        {"telegramUserId": user_id},
        {"$set": {"isPremium": True}}
    )
    
    if result.modified_count > 0:
        await update.message.reply_text(
            "✨ *Premium Activated!*\n\n"
            "You can now:\n"
            "✅ Send unlimited messages\n"
            "✅ Access exclusive features\n"
            "✅ Get priority support\n\n"
            "Go to the webapp to start chatting!",
            parse_mode="Markdown"
        )
    else:
        await update.message.reply_text(
            "⚠️ Please link your webapp account first using /link"
        )

# Add to your bot
application.add_handler(CommandHandler("premium", buy_premium))
```

### Step 4: Media Upload Handler (for Stories/Posts)

To use Telegram as CDN for media storage:

```python
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Store photo and return file_id"""
    photo = update.message.photo[-1]  # Get highest resolution
    file_id = photo.file_id
    
    # Optionally forward to storage channel
    STORAGE_CHANNEL_ID = -1001234567890  # Your private channel
    await update.message.forward(STORAGE_CHANNEL_ID)
    
    # Return file_id to user (they use this in webapp)
    await update.message.reply_text(
        f"📸 Photo saved!\n\n"
        f"File ID: `{file_id}`\n\n"
        f"Use this in the webapp to create posts/stories.",
        parse_mode="Markdown"
    )

async def handle_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Store video and return file_id"""
    video = update.message.video
    file_id = video.file_id
    
    # Forward to storage channel
    STORAGE_CHANNEL_ID = -1001234567890
    await update.message.forward(STORAGE_CHANNEL_ID)
    
    await update.message.reply_text(
        f"🎥 Video saved!\n\n"
        f"File ID: `{file_id}`\n\n"
        f"Use this in the webapp to create posts/stories.",
        parse_mode="Markdown"
    )

# Add handlers
application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
application.add_handler(MessageHandler(filters.VIDEO, handle_video))
```

### Step 5: Welcome Message with Webapp Link

```python
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Welcome message"""
    await update.message.reply_text(
        "🎭 *Welcome to LuvHive Bot!*\n\n"
        "Your anonymous dating & social companion\n\n"
        "🌐 *Webapp:* https://chatfix-luvhive.preview.emergentagent.com\n\n"
        "📋 *Commands:*\n"
        "/link - Link your webapp account\n"
        "/premium - Upgrade to premium\n"
        "/help - Get help\n\n"
        "First time? Register on the webapp!",
        parse_mode="Markdown"
    )

application.add_handler(CommandHandler("start", start))
```

### Step 6: Sync Premium Status from Bot to Webapp

When user purchases premium in bot, update webapp database:

```python
# After successful payment
await db.users.update_one(
    {"telegramUserId": str(telegram_user_id)},
    {"$set": {"isPremium": True}}
)
```

When premium expires:

```python
await db.users.update_one(
    {"telegramUserId": str(telegram_user_id)},
    {"$set": {"isPremium": False}}
)
```

## 🔄 Complete User Flow

### Registration Flow:
1. User visits webapp → Registers with username/password
2. User opens Telegram bot → `/link` command
3. Bot generates unique code (e.g., "A1B2C3D4")
4. User enters code in webapp profile page
5. Accounts are linked ✅

### Premium Purchase Flow:
1. User tries to chat in webapp
2. Popup appears: "Buy Premium from Bot to Use Chat Service"
3. User clicks "Open Telegram Bot"
4. User sends `/premium` in bot
5. User completes payment
6. Bot updates database → `isPremium: true`
7. User can now chat in webapp ✅

### Media Upload Flow (Optional):
1. User uploads photo/video in Telegram bot
2. Bot stores in channel and returns `file_id`
3. User uses `file_id` when creating story/post in webapp
4. Webapp fetches from Telegram CDN using `file_id`
5. Zero storage cost for you! ✅

## 📊 Database Schema

Make sure your bot connects to the same MongoDB database:

```python
# Use same connection as webapp
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "luvhive_database"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections used:
# - users (main user data)
# - telegram_links (linking codes)
# - stories (24h stories)
# - posts (permanent posts)
# - messages (chat messages)
```

## 🚀 Testing the Integration

1. **Test Account Linking:**
   - Register in webapp with username "testuser"
   - Run `/link` in bot
   - Enter code in webapp profile
   - Check "Telegram Connected" appears

2. **Test Premium Flow:**
   - Try to send message in webapp
   - See premium popup
   - Run `/premium` in bot
   - After payment, try chatting again
   - Should work now!

3. **Test Media Upload:**
   - Send photo to bot
   - Get `file_id`
   - Use in webapp story/post
   - Media should display

## ⚠️ Important Notes

1. **Database Connection:** Bot and webapp MUST use same MongoDB database
2. **User Matching:** Link happens via `telegramUserId` field
3. **File Storage:** Use Telegram CDN for 100k+ users (free, unlimited)
4. **Security:** Keep bot token secure, use environment variables

## 💡 Tips

- Set up a private Telegram channel for media storage
- Use `/link` code expiry (24 hours recommended)
- Send notifications from bot when someone likes/messages
- Add `/unlink` command to disconnect accounts
- Implement premium subscription auto-renewal

## 🆘 Troubleshooting

**Issue:** Code doesn't work in webapp
- Check MongoDB connection in both bot and webapp
- Verify code in `telegram_links` collection
- Check spelling of collection names

**Issue:** Premium not activating
- Ensure user is linked (has `telegramUserId`)
- Check database update query
- Verify collection name is "users"

**Issue:** Can't see other users in webapp
- Need at least 2 registered accounts
- Check API endpoint `/api/users/list`
- Verify authentication token

---

**Need help?** Check logs:
```bash
# Webapp backend logs
tail -f /var/log/supervisor/backend.err.log

# MongoDB logs
sudo journalctl -u mongodb -f
```

🎉 **Your LuvHive webapp is now connected to your Telegram bot!**
