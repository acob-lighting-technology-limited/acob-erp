#!/bin/bash

# Configuration
# Replace these with your actual values or ensure they are set in your environment
FUNCTION_URL="${1:-http://localhost:54321/functions/v1/send-email-notification}"
WEBHOOK_SECRET="${2:-test_secret_123}"
TEST_USER_ID="${3:-REPLACE_WITH_REAL_USER_ID}"

echo "🚀 Testing Email Notification Function..."
echo "📍 URL: $FUNCTION_URL"
echo "👤 User ID: $TEST_USER_ID"

# Construct the payload
PAYLOAD=$(cat <<EOF
{
  "type": "INSERT",
  "table": "notifications",
  "record": {
    "user_id": "$TEST_USER_ID",
    "title": "Test Email Notification",
    "message": "This is a test notification sent from the testing script. If you receive this, the system is working!",
    "type": "system",
    "link_url": "/dashboard"
  },
  "schema": "public",
  "old_record": null
}
EOF
)

# Send the request
curl -X POST "$FUNCTION_URL" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d "$PAYLOAD" \
  -i

echo -e "\n\n✅ Done. Check the function logs and your email (if using a real user ID and API key)."
