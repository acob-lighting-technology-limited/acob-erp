ALTER TABLE department_payments ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;

UPDATE department_payments 
SET amount_paid = amount 
WHERE payment_type = 'one-time' AND status = 'paid';
;
