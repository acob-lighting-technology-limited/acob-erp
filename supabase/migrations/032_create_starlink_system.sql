-- Starlink Payment Management System
-- Creates tables and functions for tracking Starlink sites, payments, and documents

-- =====================================================
-- TABLES
-- =====================================================

-- Starlink Sites Table
CREATE TABLE IF NOT EXISTS starlink_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  site_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  serial_number TEXT NOT NULL UNIQUE,
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT starlink_sites_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Starlink Payments Table
CREATE TABLE IF NOT EXISTS starlink_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES starlink_sites(id) ON DELETE CASCADE,
  
  -- Invoice and billing details
  invoice_number TEXT NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  next_payment_due DATE NOT NULL,
  
  -- Payment information
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'NGN',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_date DATE,
  payment_reference TEXT,
  
  -- Reminder tracking
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_sent_at TIMESTAMPTZ,
  requisition_raised BOOLEAN NOT NULL DEFAULT FALSE,
  requisition_raised_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT starlink_payments_dates_check CHECK (billing_period_end > billing_period_start),
  CONSTRAINT starlink_payments_unique_invoice UNIQUE (site_id, invoice_number)
);

-- Starlink Documents Table
CREATE TABLE IF NOT EXISTS starlink_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES starlink_payments(id) ON DELETE CASCADE,
  
  -- Document details
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'receipt', 'requisition', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  
  -- Metadata
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT starlink_documents_file_path_unique UNIQUE (file_path)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_starlink_sites_state ON starlink_sites(state);
CREATE INDEX IF NOT EXISTS idx_starlink_sites_active ON starlink_sites(is_active);
CREATE INDEX IF NOT EXISTS idx_starlink_sites_serial ON starlink_sites(serial_number);

CREATE INDEX IF NOT EXISTS idx_starlink_payments_site ON starlink_payments(site_id);
CREATE INDEX IF NOT EXISTS idx_starlink_payments_status ON starlink_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_starlink_payments_due_date ON starlink_payments(next_payment_due);
CREATE INDEX IF NOT EXISTS idx_starlink_payments_reminder ON starlink_payments(reminder_sent, next_payment_due);

CREATE INDEX IF NOT EXISTS idx_starlink_documents_payment ON starlink_documents(payment_id);
CREATE INDEX IF NOT EXISTS idx_starlink_documents_type ON starlink_documents(document_type);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get upcoming payments (within next 7 days)
CREATE OR REPLACE FUNCTION get_upcoming_starlink_payments(days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
  payment_id UUID,
  site_id UUID,
  site_name TEXT,
  state TEXT,
  next_payment_due DATE,
  days_until_due INTEGER,
  invoice_number TEXT,
  amount DECIMAL,
  reminder_sent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS payment_id,
    s.id AS site_id,
    s.site_name,
    s.state,
    p.next_payment_due,
    (p.next_payment_due - CURRENT_DATE)::INTEGER AS days_until_due,
    p.invoice_number,
    p.amount,
    p.reminder_sent
  FROM starlink_payments p
  JOIN starlink_sites s ON p.site_id = s.id
  WHERE p.payment_status = 'pending'
    AND p.next_payment_due <= CURRENT_DATE + days_ahead
    AND p.next_payment_due >= CURRENT_DATE
    AND s.is_active = TRUE
  ORDER BY p.next_payment_due ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create payment reminders
CREATE OR REPLACE FUNCTION create_starlink_payment_reminders()
RETURNS INTEGER AS $$
DECLARE
  v_payment RECORD;
  v_notification_id UUID;
  v_count INTEGER := 0;
  v_admin_users UUID[];
BEGIN
  -- Get all admin and super_admin users
  SELECT ARRAY_AGG(id) INTO v_admin_users
  FROM profiles
  WHERE role IN ('admin', 'super_admin');
  
  -- Loop through payments due in 7 days that haven't had reminders sent
  FOR v_payment IN 
    SELECT * FROM get_upcoming_starlink_payments(7)
    WHERE reminder_sent = FALSE
      AND days_until_due <= 7
  LOOP
    -- Create notification for each admin user
    FOR i IN 1..COALESCE(array_length(v_admin_users, 1), 0) LOOP
      SELECT create_notification(
        v_admin_users[i],
        'system',
        'system',
        'Starlink Payment Due Soon',
        format('Payment for %s (%s) is due in %s days. Invoice: %s. Please raise requisition.',
          v_payment.site_name,
          v_payment.state,
          v_payment.days_until_due,
          v_payment.invoice_number
        ),
        CASE 
          WHEN v_payment.days_until_due <= 3 THEN 'urgent'
          WHEN v_payment.days_until_due <= 5 THEN 'high'
          ELSE 'normal'
        END,
        format('/admin/starlink/payments?payment_id=%s', v_payment.payment_id),
        NULL,
        'starlink_payment',
        v_payment.payment_id,
        jsonb_build_object(
          'site_name', v_payment.site_name,
          'state', v_payment.state,
          'due_date', v_payment.next_payment_due,
          'amount', v_payment.amount
        )
      ) INTO v_notification_id;
    END LOOP;
    
    -- Mark reminder as sent
    UPDATE starlink_payments
    SET reminder_sent = TRUE,
        reminder_sent_at = NOW()
    WHERE id = v_payment.payment_id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_starlink_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_sites', (SELECT COUNT(*) FROM starlink_sites WHERE is_active = TRUE),
    'active_sites', (SELECT COUNT(*) FROM starlink_sites WHERE is_active = TRUE),
    'total_payments', (SELECT COUNT(*) FROM starlink_payments),
    'pending_payments', (SELECT COUNT(*) FROM starlink_payments WHERE payment_status = 'pending'),
    'overdue_payments', (SELECT COUNT(*) FROM starlink_payments WHERE payment_status = 'overdue'),
    'payments_due_this_week', (
      SELECT COUNT(*) 
      FROM starlink_payments 
      WHERE payment_status = 'pending' 
        AND next_payment_due BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
    ),
    'payments_due_this_month', (
      SELECT COUNT(*) 
      FROM starlink_payments 
      WHERE payment_status = 'pending' 
        AND next_payment_due BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    ),
    'total_amount_pending', (
      SELECT COALESCE(SUM(amount), 0) 
      FROM starlink_payments 
      WHERE payment_status = 'pending'
    ),
    'upcoming_payments', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'site_name', site_name,
          'state', state,
          'due_date', next_payment_due,
          'days_until_due', days_until_due,
          'amount', amount
        )
      )
      FROM get_upcoming_starlink_payments(7)
    )
  ) INTO v_stats;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update payment status to overdue
CREATE OR REPLACE FUNCTION update_overdue_starlink_payments()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE starlink_payments
  SET payment_status = 'overdue',
      updated_at = NOW()
  WHERE payment_status = 'pending'
    AND next_payment_due < CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_starlink_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_starlink_sites_updated_at ON starlink_sites;
CREATE TRIGGER trigger_starlink_sites_updated_at
  BEFORE UPDATE ON starlink_sites
  FOR EACH ROW
  EXECUTE FUNCTION update_starlink_updated_at();

DROP TRIGGER IF EXISTS trigger_starlink_payments_updated_at ON starlink_payments;
CREATE TRIGGER trigger_starlink_payments_updated_at
  BEFORE UPDATE ON starlink_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_starlink_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE starlink_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE starlink_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE starlink_documents ENABLE ROW LEVEL SECURITY;

-- Starlink Sites Policies
CREATE POLICY "Super admins and admins can view starlink sites"
  ON starlink_sites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins and admins can insert starlink sites"
  ON starlink_sites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Super admins and admins can update starlink sites"
  ON starlink_sites FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only super admins can delete starlink sites"
  ON starlink_sites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Starlink Payments Policies
CREATE POLICY "Authenticated users can view starlink payments"
  ON starlink_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'staff')
    )
  );

CREATE POLICY "Admins can manage starlink payments"
  ON starlink_payments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Starlink Documents Policies
CREATE POLICY "Authenticated users can view starlink documents"
  ON starlink_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin', 'staff')
    )
  );

CREATE POLICY "Admins can manage starlink documents"
  ON starlink_documents FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE starlink_sites IS 'Stores information about Starlink installation sites';
COMMENT ON TABLE starlink_payments IS 'Tracks Starlink payment schedules and statuses';
COMMENT ON TABLE starlink_documents IS 'Stores documents related to Starlink payments (invoices, receipts, requisitions)';

COMMENT ON FUNCTION get_upcoming_starlink_payments IS 'Returns payments due within specified days';
COMMENT ON FUNCTION create_starlink_payment_reminders IS 'Creates notifications for upcoming payments and returns count of reminders created';
COMMENT ON FUNCTION get_starlink_dashboard_stats IS 'Returns comprehensive dashboard statistics';
COMMENT ON FUNCTION update_overdue_starlink_payments IS 'Updates payment status to overdue for past due payments';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
