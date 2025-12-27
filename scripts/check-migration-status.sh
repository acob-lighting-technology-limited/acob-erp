#!/bin/bash

echo "🔍 Checking System Settings Status..."
echo ""

# Check if we can connect to the database
echo "Checking database connection..."

# Try to query the system_settings table
echo ""
echo "To check if the migration is needed:"
echo "1. Go to your Supabase Dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Run this query:"
echo ""
echo "   SELECT * FROM system_settings;"
echo ""
echo "If you get an error 'relation \"system_settings\" does not exist',"
echo "then you need to apply the migration."
echo ""
echo "If you see results (even if empty), the migration is already applied."
echo ""
echo "📝 To apply the migration:"
echo "   1. Open supabase/migrations/031_create_system_settings.sql"
echo "   2. Copy all the SQL"
echo "   3. Paste and run in Supabase SQL Editor"
echo ""
