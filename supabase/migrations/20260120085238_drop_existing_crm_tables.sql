
-- Drop existing CRM tables (cascade to remove dependencies)
DROP TABLE IF EXISTS crm_activities CASCADE;
DROP TABLE IF EXISTS crm_opportunities CASCADE;
DROP TABLE IF EXISTS crm_contacts CASCADE;
DROP TABLE IF EXISTS crm_pipelines CASCADE;
DROP TABLE IF EXISTS crm_tags CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- Drop meter system tables if they exist
DROP TABLE IF EXISTS consumption_data CASCADE;
DROP TABLE IF EXISTS remote_tasks CASCADE;
DROP TABLE IF EXISTS token_records CASCADE;
DROP TABLE IF EXISTS token_sales CASCADE;
DROP TABLE IF EXISTS meters CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS gateways CASCADE;
DROP TABLE IF EXISTS tariffs CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS has_role(TEXT) CASCADE;
DROP function IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS mark_notification_read(UUID) CASCADE;
DROP FUNCTION IF EXISTS mark_all_notifications_read() CASCADE;
DROP FUNCTION IF EXISTS sync_contact_from_customer() CASCADE;
DROP FUNCTION IF EXISTS sync_customer_from_contact() CASCADE;
DROP FUNCTION IF EXISTS notify_token_generated() CASCADE;
DROP FUNCTION IF EXISTS notify_task_completed() CASCADE;
;
