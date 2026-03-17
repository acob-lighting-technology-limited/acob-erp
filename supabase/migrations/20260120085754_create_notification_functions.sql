
-- Notification functions
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal'
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id, type, title, message, data, action_url, priority
  ) VALUES (
    p_user_id, p_type, p_title, p_message, p_data, p_action_url, p_priority
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE notifications
  SET read = true, read_at = now()
  WHERE id = notification_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE notifications
  SET read = true, read_at = now()
  WHERE user_id = auth.uid() AND read = false;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CRM Integration functions
CREATE OR REPLACE FUNCTION sync_contact_from_customer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.crm_contact_id IS NOT NULL THEN
    UPDATE crm_contacts
    SET
      contact_name = NEW.name,
      phone = COALESCE(NEW.phone, phone),
      email = COALESCE(NEW.email, email),
      updated_at = now()
    WHERE id = NEW.crm_contact_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_customer_from_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.meter_customer_id IS NOT NULL THEN
    UPDATE customers
    SET
      name = NEW.contact_name,
      phone = COALESCE(NEW.phone, phone),
      email = COALESCE(NEW.email, email),
      updated_at = now()
    WHERE id = NEW.meter_customer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
;
