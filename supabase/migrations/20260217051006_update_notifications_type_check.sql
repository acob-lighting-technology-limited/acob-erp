ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'token_generated', 
  'token_cancelled', 
  'task_completed', 
  'task_failed', 
  'customer_added', 
  'customer_updated', 
  'meter_status_change', 
  'meter_added', 
  'activity_reminder', 
  'crm_contact_added', 
  'opportunity_won', 
  'opportunity_lost', 
  'system_alert', 
  'asset_assigned' -- Added this new type
));;
