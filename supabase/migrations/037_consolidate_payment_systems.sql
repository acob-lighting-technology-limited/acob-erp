-- Consolidate Starlink Payment System into Department Payments (Fixed)
-- Migrates starlink_payments to department_payments system
-- Keeps starlink_sites table for reference but links to department_payments

-- =====================================================
-- 1. CREATE STARLINK PAYMENT CATEGORY
-- =====================================================

INSERT INTO payment_categories (name, description)
VALUES ('Starlink', 'Starlink internet service payments for various sites')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. ADD MISSING COLUMNS TO DEPARTMENT_PAYMENTS
-- =====================================================

-- Add invoice_number column (missing from original schema)
ALTER TABLE department_payments
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Add site reference columns
ALTER TABLE department_payments
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES starlink_sites(id),
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS site_state TEXT,
  ADD COLUMN IF NOT EXISTS site_serial_number TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_department_payments_site_id ON department_payments(site_id);
CREATE INDEX IF NOT EXISTS idx_department_payments_invoice_number ON department_payments(invoice_number);

-- Add comments
COMMENT ON COLUMN department_payments.invoice_number IS 'Invoice number for payment tracking';
COMMENT ON COLUMN department_payments.site_id IS 'Reference to starlink_sites for Starlink payments';
COMMENT ON COLUMN department_payments.site_name IS 'Site name for Starlink payments (denormalized for performance)';
COMMENT ON COLUMN department_payments.site_state IS 'Site state for Starlink payments (denormalized for performance)';
COMMENT ON COLUMN department_payments.site_serial_number IS 'Starlink serial number (denormalized for performance)';

-- =====================================================
-- 3. MIGRATE STARLINK_PAYMENTS TO DEPARTMENT_PAYMENTS
-- =====================================================

DO $$
DECLARE
  v_it_dept_id UUID;
  v_starlink_category TEXT := 'Starlink';
  v_migrated_count INTEGER := 0;
BEGIN
  -- Get IT department ID
  SELECT id INTO v_it_dept_id
  FROM departments
  WHERE name = 'IT and Communications'
  LIMIT 1;

  IF v_it_dept_id IS NULL THEN
    RAISE EXCEPTION 'IT and Communications department not found';
  END IF;

  -- Migrate starlink_payments to department_payments
  INSERT INTO department_payments (
    department_id,
    payment_type,
    category,
    title,
    description,
    amount,
    currency,
    recurrence_period,
    next_payment_due,
    last_payment_date,
    payment_date,
    status,
    invoice_number,
    payment_reference,
    notes,
    created_by,
    created_at,
    updated_at,
    site_id,
    site_name,
    site_state,
    site_serial_number
  )
  SELECT
    v_it_dept_id,
    'recurring'::text,
    v_starlink_category,
    'Starlink - ' || s.site_name || ' (' || s.state || ')',
    'Starlink internet service for ' || s.site_name || ', ' || s.state,
    p.amount,
    p.currency,
    'monthly'::text,
    p.next_payment_due,
    p.payment_date,
    NULL, -- one-time payment_date is NULL for recurring
    CASE 
      WHEN p.payment_status = 'pending' THEN 'pending'
      WHEN p.payment_status = 'paid' THEN 'paid'
      WHEN p.payment_status = 'overdue' THEN 'overdue'
      WHEN p.payment_status = 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END,
    p.invoice_number,
    p.payment_reference,
    CASE
      WHEN p.notes IS NOT NULL THEN p.notes || E'\n\n'
      ELSE ''
    END || 'Migrated from starlink_payments. ' ||
    'Billing period: ' || p.billing_period_start::text || ' to ' || p.billing_period_end::text ||
    CASE 
      WHEN p.reminder_sent THEN E'\nReminder sent: ' || p.reminder_sent_at::text
      ELSE ''
    END ||
    CASE
      WHEN p.requisition_raised THEN E'\nRequisition raised: ' || p.requisition_raised_at::text
      ELSE ''
    END,
    p.created_by,
    p.created_at,
    p.updated_at,
    s.id,
    s.site_name,
    s.state,
    s.serial_number
  FROM starlink_payments p
  JOIN starlink_sites s ON p.site_id = s.id
  WHERE NOT EXISTS (
    -- Avoid duplicate migration
    SELECT 1 FROM department_payments dp
    WHERE dp.site_id = s.id
      AND dp.invoice_number = p.invoice_number
  );

  GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % Starlink payments to department_payments', v_migrated_count;

END $$;

-- =====================================================
-- 4. MARK STARLINK TABLES AS DEPRECATED
-- =====================================================

COMMENT ON TABLE starlink_payments IS 'DEPRECATED: Migrated to department_payments. Kept for historical reference.';
COMMENT ON TABLE starlink_documents IS 'DEPRECATED: Use payment_documents instead. Kept for historical reference.';
COMMENT ON TABLE starlink_sites IS 'Active reference table for Starlink sites. Linked to department_payments via site_id.';

-- =====================================================
-- 5. UPDATE STARLINK_SITES TO TRACK MIGRATION
-- =====================================================

ALTER TABLE starlink_sites
  ADD COLUMN IF NOT EXISTS migrated_to_department_payments BOOLEAN DEFAULT FALSE;

UPDATE starlink_sites
SET migrated_to_department_payments = TRUE
WHERE id IN (
  SELECT DISTINCT site_id
  FROM department_payments
  WHERE site_id IS NOT NULL
);

-- =====================================================
-- 6. CREATE VIEW FOR BACKWARD COMPATIBILITY
-- =====================================================

CREATE OR REPLACE VIEW starlink_payments_view AS
SELECT
  dp.id,
  dp.site_id,
  dp.invoice_number,
  dp.created_at AS billing_period_start,
  dp.updated_at AS billing_period_end,
  dp.next_payment_due,
  dp.amount,
  dp.currency,
  dp.status AS payment_status,
  dp.payment_date,
  dp.payment_reference,
  FALSE AS reminder_sent,
  NULL::timestamptz AS reminder_sent_at,
  FALSE AS requisition_raised,
  NULL::timestamptz AS requisition_raised_at,
  dp.notes,
  dp.created_at,
  dp.updated_at,
  dp.created_by
FROM department_payments dp
WHERE dp.category = 'Starlink'
  AND dp.site_id IS NOT NULL;

COMMENT ON VIEW starlink_payments_view IS 'Backward compatibility view for starlink_payments. Maps to department_payments.';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
