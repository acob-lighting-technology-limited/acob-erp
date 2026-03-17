
-- Meter System Indexes
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_crm_contact_id ON customers(crm_contact_id);
CREATE INDEX IF NOT EXISTS idx_meters_meter_id ON meters(meter_id);
CREATE INDEX IF NOT EXISTS idx_meters_customer_id ON meters(customer_id);
CREATE INDEX IF NOT EXISTS idx_meters_status ON meters(status);
CREATE INDEX IF NOT EXISTS idx_token_sales_customer_id ON token_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_token_sales_meter_id ON token_sales(meter_id);
CREATE INDEX IF NOT EXISTS idx_token_sales_created_at ON token_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_records_meter_id ON token_records(meter_id);
CREATE INDEX IF NOT EXISTS idx_token_records_token_type ON token_records(token_type);
CREATE INDEX IF NOT EXISTS idx_token_records_created_at ON token_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_tasks_meter_id ON remote_tasks(meter_id);
CREATE INDEX IF NOT EXISTS idx_remote_tasks_status ON remote_tasks(status);
CREATE INDEX IF NOT EXISTS idx_remote_tasks_created_at ON remote_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumption_data_meter_id ON consumption_data(meter_id);
CREATE INDEX IF NOT EXISTS idx_consumption_data_reading_date ON consumption_data(reading_date DESC);

-- CRM Indexes
CREATE INDEX IF NOT EXISTS idx_crm_contacts_assigned_to ON crm_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_type ON crm_contacts(type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts(stage);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON crm_contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON crm_contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_meter_customer_id ON crm_contacts(meter_customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_contact_id ON crm_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_assigned_to ON crm_opportunities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_status ON crm_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON crm_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_created_at ON crm_opportunities(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity_id ON crm_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_assigned_to ON crm_activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_completed ON crm_activities(completed);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(type);

-- Notification Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
;
