
-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tariffs_updated_at BEFORE UPDATE ON tariffs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gateways_updated_at BEFORE UPDATE ON gateways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meters_updated_at BEFORE UPDATE ON meters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User signup trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists to avoid error on creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- CRM sync triggers
CREATE TRIGGER sync_contact_to_customer
  AFTER UPDATE ON crm_contacts
  FOR EACH ROW
  WHEN (OLD.contact_name IS DISTINCT FROM NEW.contact_name OR 
        OLD.phone IS DISTINCT FROM NEW.phone OR 
        OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION sync_customer_from_contact();

-- Notification triggers
CREATE OR REPLACE FUNCTION notify_token_generated()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
BEGIN
  SELECT NEW.generated_by INTO user_id;
  
  PERFORM create_notification(
    user_id,
    'token_generated',
    'Token Generated Successfully',
    format('Token %s generated for meter %s', NEW.token, NEW.meter_id),
    jsonb_build_object(
      'token_id', NEW.id,
      'token', NEW.token,
      'meter_id', NEW.meter_id,
      'amount', NEW.amount,
      'units', NEW.units
    ),
    '/records/credit',
    'normal'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_token_generated
  AFTER INSERT ON token_sales
  FOR EACH ROW
  EXECUTE FUNCTION notify_token_generated();

CREATE OR REPLACE FUNCTION notify_task_completed()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  notification_type TEXT;
  notification_title TEXT;
BEGIN
  IF NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status THEN
    SELECT NEW.created_by INTO user_id;
    
    IF NEW.status = 'completed' THEN
      notification_type := 'task_completed';
      notification_title := 'Task Completed Successfully';
    ELSE
      notification_type := 'task_failed';
      notification_title := 'Task Failed';
    END IF;
    
    PERFORM create_notification(
      user_id,
      notification_type,
      notification_title,
      format('Remote task for meter %s has %s', NEW.meter_id, NEW.status),
      jsonb_build_object(
        'task_id', NEW.id,
        'meter_id', NEW.meter_id,
        'task_type', NEW.task_type,
        'status', NEW.status,
        'error_message', NEW.error_message
      ),
      '/tasks/' || NEW.task_type,
      CASE WHEN NEW.status = 'failed' THEN 'high' ELSE 'normal' END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_task_status_change
  AFTER UPDATE ON remote_tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_completed();
;
