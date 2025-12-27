#!/bin/bash

# Starlink Payment Management System Migration Script
# This script applies the Starlink system migration to your Supabase database

echo "🛰️  Applying Starlink Payment Management System Migration..."
echo ""
echo "This will create:"
echo "  - starlink_sites table"
echo "  - starlink_payments table"
echo "  - starlink_documents table"
echo "  - RLS policies for admin/super_admin access"
echo "  - Helper functions for dashboard stats and reminders"
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
    echo "     supabase/migrations/032_create_starlink_system.sql"
    echo "  4. Run the SQL"
    echo ""
    echo "Option 2: Supabase CLI (if configured)"
    echo "  npx supabase db push"
    echo ""
    echo "After migration, you can:"
    echo "  - Navigate to /admin/starlink to access the dashboard"
    echo "  - Import your Excel data using the 'Import Excel Data' button"
    echo "  - Add new sites manually"
    echo "  - Upload payment documents"
    echo ""
fi

echo "✅ Done!"
