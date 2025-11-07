#!/bin/bash
# Ensure .env has correct values from .env.example before starting
echo "Syncing .env from .env.example..."
if [ -f "/app/frontend/.env.example" ]; then
    # Copy base values from .env.example
    cp /app/frontend/.env.example /app/frontend/.env
    
    # Restore production values from environment or existing .env
    echo "REACT_APP_TELEGRAM_BOT_USERNAME=${REACT_APP_TELEGRAM_BOT_USERNAME:-Loveekisssbot}" >> /app/frontend/.env
    echo "REACT_APP_PREMIUM_INVOICE_SLUG_1WEEK=${REACT_APP_PREMIUM_INVOICE_SLUG_1WEEK:-aySQN1seOVSlAQAAkKoAvgq93PA}" >> /app/frontend/.env
    echo "REACT_APP_PREMIUM_INVOICE_SLUG_1MONTH=${REACT_APP_PREMIUM_INVOICE_SLUG_1MONTH:-3kUQYVseOVSmAQAA0m-tMH9NqQk}" >> /app/frontend/.env
    echo "REACT_APP_PREMIUM_INVOICE_SLUG_6MONTHS=${REACT_APP_PREMIUM_INVOICE_SLUG_6MONTHS:-L0_hnVseOVSnAQAAFLgFTU2YFJA}" >> /app/frontend/.env
    echo "REACT_APP_PREMIUM_INVOICE_SLUG_12MONTHS=${REACT_APP_PREMIUM_INVOICE_SLUG_12MONTHS:-SkA8EVseOVSoAQAA-AGZzB-kumQ}" >> /app/frontend/.env
    # ZEGO removed - using Whereby now
    
    echo ".env file synchronized successfully"
fi

# Start the frontend
exec yarn start
