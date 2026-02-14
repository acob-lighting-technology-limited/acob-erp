-- Fix Function Security Issues
-- Add search_path to all SECURITY DEFINER functions to prevent privilege escalation

-- Update handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, company_email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    'employee'::user_role
  );
  RETURN NEW;
END;
$$;

-- Update update_asset_issues_updated_at function
CREATE OR REPLACE FUNCTION update_asset_issues_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Update log_audit function
CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  audit_id UUID;
BEGIN
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_old_values, p_new_values)
  RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$;

-- Update create_notification function (if exists)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_category TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_related_entity_type TEXT DEFAULT NULL,
  p_related_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    category,
    title,
    message,
    priority,
    action_url,
    action_label,
    related_entity_type,
    related_entity_id,
    metadata
  ) VALUES (
    p_user_id,
    p_type,
    p_category,
    p_title,
    p_message,
    p_priority,
    p_action_url,
    p_action_label,
    p_related_entity_type,
    p_related_entity_id,
    p_metadata
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- Update assign_asset function (if exists)
CREATE OR REPLACE FUNCTION assign_asset(
  p_asset_id UUID,
  p_assigned_to UUID,
  p_assignment_type TEXT,
  p_assigned_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment_id UUID;
  v_asset_number TEXT;
  v_asset_name TEXT;
BEGIN
  -- Get asset details
  SELECT asset_number, asset_name INTO v_asset_number, v_asset_name
  FROM assets
  WHERE id = p_asset_id;

  -- End any current assignments
  UPDATE asset_assignments
  SET is_current = FALSE,
      returned_at = NOW()
  WHERE asset_id = p_asset_id
    AND is_current = TRUE;

  -- Create new assignment
  INSERT INTO asset_assignments (
    asset_id,
    assigned_to,
    assignment_type,
    assigned_by,
    notes,
    is_current
  ) VALUES (
    p_asset_id,
    p_assigned_to,
    p_assignment_type,
    p_assigned_by,
    p_notes,
    TRUE
  ) RETURNING id INTO v_assignment_id;

  -- Update asset status
  UPDATE assets
  SET status = 'assigned',
      updated_at = NOW()
  WHERE id = p_asset_id;

  -- Create audit log
  PERFORM log_audit(
    'assign',
    'asset',
    p_asset_id,
    NULL,
    jsonb_build_object(
      'assigned_to', p_assigned_to,
      'assignment_type', p_assignment_type,
      'assigned_by', p_assigned_by
    )
  );

  RETURN v_assignment_id;
END;
$$;

-- Update Starlink functions
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION create_starlink_payment_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION get_starlink_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION update_overdue_starlink_payments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
