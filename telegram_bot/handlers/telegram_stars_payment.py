"""
Telegram Stars Payment Integration for Mystery Match Premium
"""
import os
from telegram import Update, LabeledPrice, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler, PreCheckoutQueryHandler, MessageHandler, filters
import logging
import registration as reg

logger = logging.getLogger(__name__)

# Telegram Stars pricing (1 Star = ~$0.015 USD)
PREMIUM_1_WEEK = 199  # ₹199 = ~13,000 Stars (approx)
PREMIUM_1_MONTH = 499  # ₹499 = ~33,000 Stars (approx)
EXTEND_MATCH = 50     # 50 Stars to extend 24h

async def cmd_premium(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show premium plans with Telegram Stars payment"""
    uid = update.effective_user.id
    
    if not reg.is_registered(uid):
        await update.message.reply_text("Please register first with /start")
        return
    
    # Check if already premium
    if reg.has_active_premium(uid):
        try:
            with reg._conn() as con, con.cursor() as cur:
                cur.execute("SELECT premium_until FROM users WHERE tg_user_id=%s", (uid,))
                row = cur.fetchone()
                expires = row[0] if row else "Unknown"
        except:
            expires = "Unknown"
        
        await update.message.reply_text(
            f"👑 You're already a Premium user!\n"
            f"✨ Expires: {expires}\n\n"
            f"Premium Benefits:\n"
            f"✅ Choose gender (Girls/Boys)\n"
            f"✅ Unlimited matches\n"
            f"✅ Instant reveals\n"
            f"✅ Advanced filters\n"
            f"✅ Free match extensions"
        )
        return
    
    # Show premium plans
    keyboard = [
        [InlineKeyboardButton("🔥 1 Week - 199 Stars", callback_data="buy_premium_1week")],
        [InlineKeyboardButton("👑 1 Month - 499 Stars", callback_data="buy_premium_1month")],
        [InlineKeyboardButton("❌ Cancel", callback_data="cancel_premium")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    message = """👑 **Mystery Match Premium**

**Premium Benefits:**
✅ **Choose Gender** - Match with girls or boys specifically
✅ **Unlimited Matches** - No daily limit
✅ **Instant Reveals** - See profiles immediately
✅ **Advanced Filters** - Age, city, interests
✅ **Free Extensions** - Extend matches for free
✅ **Priority Support** - Get help faster

**Pricing:**
🔥 **1 Week** - 199 Telegram Stars (~₹199)
👑 **1 Month** - 499 Telegram Stars (~₹499)

Select a plan below:
"""
    
    await update.message.reply_text(
        message,
        parse_mode='Markdown',
        reply_markup=reply_markup
    )

async def handle_premium_purchase(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle premium purchase callback"""
    query = update.callback_query
    await query.answer()
    
    uid = query.from_user.id
    data = query.data
    
    if data == "cancel_premium":
        await query.edit_message_text("❌ Purchase cancelled.")
        return
    
    # Determine plan
    if data == "buy_premium_1week":
        duration_days = 7
        price_stars = PREMIUM_1_WEEK
        plan_name = "1 Week Premium"
    elif data == "buy_premium_1month":
        duration_days = 30
        price_stars = PREMIUM_1_MONTH
        plan_name = "1 Month Premium"
    else:
        return
    
    # Create invoice
    title = f"Mystery Match {plan_name}"
    description = f"Premium access for {duration_days} days with all features unlocked"
    payload = f"premium_{duration_days}d_{uid}"
    
    # Telegram Stars uses XTR currency
    prices = [LabeledPrice(label=plan_name, amount=price_stars)]
    
    try:
        await context.bot.send_invoice(
            chat_id=query.message.chat_id,
            title=title,
            description=description,
            payload=payload,
            provider_token="",  # Empty for Telegram Stars
            currency="XTR",     # Telegram Stars currency code
            prices=prices
        )
    except Exception as e:
        logger.error(f"Error sending invoice: {e}")
        await query.edit_message_text(
            f"❌ Error creating payment. Please try again later.\n"
            f"Error: {str(e)}"
        )

async def precheckout_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle pre-checkout query - verify payment before processing"""
    query = update.pre_checkout_query
    
    # Always approve - we verify on successful payment
    await query.answer(ok=True)

async def successful_payment_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle successful payment - activate premium"""
    payment = update.message.successful_payment
    uid = update.effective_user.id
    
    # Parse payload to get duration
    payload = payment.invoice_payload
    
    try:
        # Extract duration from payload (format: premium_7d_<uid> or premium_30d_<uid> or luvhive_premium_1month)
        # OR from the invoice title if payload doesn't contain duration info
        parts = payload.split('_')
        
        # Log for debugging
        logger.info(f"Payment received - Payload: {payload}, Total Amount: {payment.total_amount} Stars")
        
        # Handle different payload formats
        # New payloads: luvhive_premium_1week, luvhive_premium_1month, luvhive_premium_6months, luvhive_premium_12months
        if 'week' in payload.lower() or '7d' in payload:
            duration_days = 7
        elif '12months' in payload.lower() or '12month' in payload.lower() or 'year' in payload.lower():
            duration_days = 365
        elif '6months' in payload.lower() or '6month' in payload.lower():
            duration_days = 180
        elif 'month' in payload.lower():
            duration_days = 30
        elif len(parts) > 1 and 'd' in parts[1]:
            duration_str = parts[1]
            duration_days = int(duration_str.replace('d', ''))
        else:
            # Fallback: Try to determine from Stars amount
            # 100 Stars = 1 week, 250 Stars = 1 month, 600 Stars = 6 months, 1000 Stars = 12 months
            if payment.total_amount == 100:
                duration_days = 7
                logger.info("Detected 1 week from Stars amount (100)")
            elif payment.total_amount == 250:
                duration_days = 30
                logger.info("Detected 1 month from Stars amount (250)")
            elif payment.total_amount == 600:
                duration_days = 180
                logger.info("Detected 6 months from Stars amount (600)")
            elif payment.total_amount == 1000:
                duration_days = 365
                logger.info("Detected 12 months from Stars amount (1000)")
            else:
                # Default to 30 days
                duration_days = 30
                logger.warning(f"Could not detect duration from payload or amount, defaulting to 30 days")
        
        # Activate premium in PostgreSQL database (bot database)
        import datetime
        with reg._conn() as con, con.cursor() as cur:
            cur.execute("""
                UPDATE users 
                SET is_premium = TRUE,
                    premium_until = NOW() + INTERVAL '%s days'
                WHERE tg_user_id = %s
            """, (duration_days, uid))
            con.commit()
        
        # Also update MongoDB (webapp database) - CRITICAL FOR WEBAPP
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
            client = AsyncIOMotorClient(mongo_url)
            db = client.luvhive_database
            
            # Update by telegramId
            result = await db.users.update_one(
                {"telegramId": str(uid)},
                {"$set": {"isPremium": True}}
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ MongoDB updated: isPremium=True for telegramId={uid}")
            else:
                logger.warning(f"⚠️ MongoDB user not found for telegramId={uid}")
            
            client.close()
        except Exception as mongo_err:
            logger.error(f"MongoDB update failed: {mongo_err}")
            # Continue anyway - at least bot premium is activated
        
        # Store payment record
        with reg._conn() as con, con.cursor() as cur:
            cur.execute("""
                INSERT INTO payments 
                (user_id, amount, currency, status, charge_id, product_type, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
            """, (
                uid,
                payment.total_amount,  # Amount in Stars
                payment.currency,
                'completed',
                payment.telegram_payment_charge_id,
                'premium_subscription',
                f'{{"duration_days": {duration_days}, "expires_at": "NOW() + INTERVAL \'{duration_days} days\'"}}'
            ))
            con.commit()
        
        # Send confirmation with appropriate duration message
        duration_text = (
            "1 week" if duration_days == 7 else
            "1 month" if duration_days == 30 else
            "6 months" if duration_days == 180 else
            "12 months" if duration_days == 365 else
            f"{duration_days} days"
        )
        
        await update.message.reply_text(
            f"🎉 **Payment Successful!**\n\n"
            f"👑 You are now a Premium user for {duration_text}!\n\n"
            f"**Premium Benefits Activated:**\n"
            f"✅ Unlimited chats (webapp)\n"
            f"✅ Photos, videos & voice notes\n"
            f"✅ Choose gender matching (bot)\n"
            f"✅ Age & city filters (bot)\n"
            f"✅ Read receipts & typing indicators\n\n"
            f"🌐 Use premium features: /webapp",
            parse_mode='Markdown'
        )
        
        logger.info(f"Premium activated for user {uid} - {duration_days} days (PostgreSQL + MongoDB)")
        
    except Exception as e:
        logger.error(f"Error processing payment for user {uid}: {e}")
        await update.message.reply_text(
            "⚠️ Payment received but there was an error activating premium.\n"
            "Please contact support with your payment ID."
        )

def register_payment_handlers(app):
    """Register all payment-related handlers"""
    from telegram.ext import CallbackQueryHandler
    
    # Premium command
    app.add_handler(CommandHandler("premium", cmd_premium))
    
    # Premium purchase callbacks
    app.add_handler(CallbackQueryHandler(handle_premium_purchase, pattern="^buy_premium_"))
    app.add_handler(CallbackQueryHandler(handle_premium_purchase, pattern="^cancel_premium$"))
    
    # Payment handlers
    app.add_handler(PreCheckoutQueryHandler(precheckout_callback))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment_callback))
    
    logger.info("✅ Telegram Stars payment handlers registered")
