-- Migration to ensure payment status constraint is correct
-- This migration is idempotent and safe to run multiple times

DO $$
BEGIN
    -- Step 1: Update all existing 'pending' records to 'due' (if any exist)
    UPDATE department_payments
    SET status = 'due'
    WHERE status = 'pending';

    -- Step 2: Drop the old constraint if it exists
    ALTER TABLE department_payments
    DROP CONSTRAINT IF EXISTS department_payments_status_check;

    -- Step 3: Add the constraint with the correct values
    ALTER TABLE department_payments
    ADD CONSTRAINT department_payments_status_check
    CHECK (status IN ('due', 'paid', 'overdue', 'cancelled'));

    -- Step 4: Update the default value
    ALTER TABLE department_payments
    ALTER COLUMN status SET DEFAULT 'due';
    
    RAISE NOTICE 'Payment status migration completed successfully';
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error during migration: %', SQLERRM;
        RAISE;
END $$;
