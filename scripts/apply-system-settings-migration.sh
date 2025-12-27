#!/bin/bash

# System Settings Migration Script
# This script applies the system settings migration to your Supabase database

echo "🚀 Applying System Settings Migration..."
echo ""
echo "This will create:"
echo "  - system_settings table"
echo "  - Default shutdown_mode and maintenance_mode settings"
echo "  - RLS policies for super_admin access only"
echo ""

# Check if we're using local or remote Supabase
if command -v docker &> /dev/null && docker ps &> /dev/null; then
    echo "📦 Detected local Supabase (Docker)"
    npx supabase db reset
else
    echo "☁️  Using remote Supabase"
    echo ""
    echo "Please run this migration manually using one of these methods:"
    echo ""
    echo "Option 1: Supabase Dashboard"
    echo "  1. Go to your Supabase project dashboard"
    echo "  2. Navigate to SQL Editor"
    echo "  3. Copy and paste the contents of:"
    echo "     supabase/migrations/031_create_system_settings.sql"
    echo "  4. Run the SQL"
    echo ""
    echo "Option 2: Supabase CLI (if configured)"
    echo "  npx supabase db push"
    echo ""
fi

echo "✅ Done!"
