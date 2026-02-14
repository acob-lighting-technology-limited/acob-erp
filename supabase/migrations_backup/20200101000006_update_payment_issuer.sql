-- Add Issuer fields to department_payments
ALTER TABLE department_payments 
ADD COLUMN IF NOT EXISTS issuer_name TEXT,
ADD COLUMN IF NOT EXISTS issuer_phone_number TEXT,
ADD COLUMN IF NOT EXISTS issuer_address TEXT;

-- Remove invoice_number column as requested
ALTER TABLE department_payments DROP COLUMN IF EXISTS invoice_number;
