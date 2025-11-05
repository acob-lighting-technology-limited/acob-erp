# Quick Migration Guide - assign_device Function

## ⚠️ IMPORTANT: Run this migration now!

The `assign_device` function is missing from your database, causing the error:
"Could not find the function public.assign_device(...) in the schema cache"

## Steps to Fix:

### 1. Open Supabase SQL Editor
👉 **Go to:** https://supabase.com/dashboard/project/itqegqxeqkeogwrvlzlj/sql/new

### 2. Copy the SQL Below
Copy the entire SQL block from the file: `supabase/migrations/create_assign_device_function.sql`

### 3. Paste and Run
1. Paste the SQL into the editor
2. Click **"Run"** button or press `Ctrl+Enter`

### 4. Verify (Optional)
After running, verify the function was created:
```sql
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'assign_device';
```

You should see a row with the function details.

---

## Why the CLI failed:
The Supabase CLI cannot be installed globally via npm. It requires:
- Windows: Scoop, Chocolatey, or direct download
- Mac: Homebrew
- Linux: Direct download

For now, using the dashboard is the quickest solution.



