-- Diagnostic query to check the current payment status constraint
-- Run this in your Supabase SQL Editor to see what constraint currently exists

SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'department_payments'::regclass
    AND conname = 'department_payments_status_check';

-- Also check what status values currently exist in the data
SELECT DISTINCT status, COUNT(*) as count
FROM department_payments
GROUP BY status
ORDER BY status;
