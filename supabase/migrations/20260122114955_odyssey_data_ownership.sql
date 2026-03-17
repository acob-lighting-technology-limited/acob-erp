-- ============================================
-- ACOB Data Ownership Migration
-- Extends existing schema for Odyssey API data migration
-- Migration: 005_odyssey_data_ownership.sql
-- ============================================

-- ============================================
-- 1. Extend Existing Tables
-- ============================================

-- Add Odyssey sync fields to meters table
ALTER TABLE meters
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS meter_model TEXT,
ADD COLUMN IF NOT EXISTS firmware_version TEXT,
ADD COLUMN IF NOT EXISTS location JSONB,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS odyssey_meter_id TEXT,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error'));

-- Add index for Odyssey meter ID lookup
CREATE INDEX IF NOT EXISTS idx_meters_odyssey_id ON meters(odyssey_meter_id);

-- Extend token_records table for full Odyssey data
ALTER TABLE token_records
ADD COLUMN IF NOT EXISTS receipt_id TEXT,
ADD COLUMN IF NOT EXISTS tariff_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'local' CHECK (source IN ('local', 'odyssey', 'migrated')),
ADD COLUMN IF NOT EXISTS odyssey_token_id TEXT,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for token queries
CREATE INDEX IF NOT EXISTS idx_token_records_customer_id ON token_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_token_records_generated_at ON token_records(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_records_source ON token_records(source);
CREATE INDEX IF NOT EXISTS idx_token_records_odyssey_id ON token_records(odyssey_token_id);

-- Extend remote_tasks for Odyssey task tracking
ALTER TABLE remote_tasks
ADD COLUMN IF NOT EXISTS task_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS odyssey_task_id TEXT,
ADD COLUMN IF NOT EXISTS estimated_completion TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Add index for task ID lookup
CREATE INDEX IF NOT EXISTS idx_remote_tasks_task_id ON remote_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_remote_tasks_odyssey_id ON remote_tasks(odyssey_task_id);

-- ============================================
-- 2. New Tables for Complete Data Ownership
-- ============================================

-- Meter Readings (Hourly/Daily/Monthly)
CREATE TABLE IF NOT EXISTS meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID REFERENCES meters(id) ON DELETE CASCADE,
    odyssey_meter_id TEXT,
    reading_value DECIMAL(12, 2) NOT NULL,
    reading_type TEXT DEFAULT 'hourly' CHECK (reading_type IN ('hourly', 'daily', 'monthly', 'instantaneous')),
    timestamp TIMESTAMPTZ NOT NULL,
    voltage DECIMAL(8, 2),
    current DECIMAL(8, 2),
    active_power DECIMAL(10, 2),
    reactive_power DECIMAL(10, 2),
    power_factor DECIMAL(4, 2),
    frequency DECIMAL(5, 2),
    consumption DECIMAL(10, 2),
    demand DECIMAL(10, 2),
    -- Three-phase specific fields
    voltage_phase_a DECIMAL(8, 2),
    voltage_phase_b DECIMAL(8, 2),
    voltage_phase_c DECIMAL(8, 2),
    current_phase_a DECIMAL(8, 2),
    current_phase_b DECIMAL(8, 2),
    current_phase_c DECIMAL(8, 2),
    source TEXT DEFAULT 'local' CHECK (source IN ('local', 'odyssey', 'migrated')),
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for meter readings
CREATE INDEX IF NOT EXISTS idx_meter_readings_meter_id ON meter_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_timestamp ON meter_readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_meter_readings_type ON meter_readings(reading_type);
CREATE INDEX IF NOT EXISTS idx_meter_readings_meter_time ON meter_readings(meter_id, timestamp DESC);

-- GPRS Status Monitoring
CREATE TABLE IF NOT EXISTS gprs_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID REFERENCES meters(id) ON DELETE CASCADE,
    odyssey_meter_id TEXT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ,
    signal_strength INTEGER CHECK (signal_strength BETWEEN 0 AND 31),
    connection_type TEXT,
    apn TEXT,
    ip_address INET,
    uptime_percentage DECIMAL(5, 2),
    last_disconnect_reason TEXT,
    heartbeat_interval INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for GPRS status
CREATE INDEX IF NOT EXISTS idx_gprs_status_meter_id ON gprs_status(meter_id);
CREATE INDEX IF NOT EXISTS idx_gprs_status_online ON gprs_status(is_online);
CREATE INDEX IF NOT EXISTS idx_gprs_status_last_seen ON gprs_status(last_seen DESC);

-- Event Notifications
CREATE TABLE IF NOT EXISTS event_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE,
    meter_id UUID REFERENCES meters(id) ON DELETE CASCADE,
    odyssey_meter_id TEXT,
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    metadata JSONB,
    source TEXT DEFAULT 'local',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_meter_id ON event_notifications(meter_id);
CREATE INDEX IF NOT EXISTS idx_events_severity ON event_notifications(severity);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON event_notifications(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_acknowledged ON event_notifications(acknowledged);

-- Data Sync State Tracking
CREATE TABLE IF NOT EXISTS sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type TEXT NOT NULL CHECK (sync_type IN ('tokens', 'readings', 'tasks', 'events', 'gprs_status')),
    last_sync_at TIMESTAMPTZ NOT NULL,
    last_sync_from TIMESTAMPTZ,
    last_sync_to TIMESTAMPTZ,
    records_synced INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sync state
CREATE INDEX IF NOT EXISTS idx_sync_state_type ON sync_state(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_state_last_sync ON sync_state(last_sync_at DESC);

-- ============================================
-- 3. Enable RLS on New Tables
-- ============================================

ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gprs_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meter_readings
CREATE POLICY "Admin full access to meter_readings" ON meter_readings FOR ALL USING (has_role('admin'));
CREATE POLICY "Staff read meter_readings" ON meter_readings FOR SELECT USING (has_role('staff'));

-- RLS Policies for gprs_status
CREATE POLICY "Admin full access to gprs_status" ON gprs_status FOR ALL USING (has_role('admin'));
CREATE POLICY "Staff read gprs_status" ON gprs_status FOR SELECT USING (has_role('staff'));

-- RLS Policies for event_notifications
CREATE POLICY "Admin full access to events" ON event_notifications FOR ALL USING (has_role('admin'));
CREATE POLICY "Staff read events" ON event_notifications FOR SELECT USING (has_role('staff'));
CREATE POLICY "Staff acknowledge events" ON event_notifications FOR UPDATE 
    USING (has_role('staff'))
    WITH CHECK (acknowledged = true AND acknowledged_by = auth.uid());

-- RLS Policies for sync_state
CREATE POLICY "Admin full access to sync_state" ON sync_state FOR ALL USING (has_role('admin'));
CREATE POLICY "Staff read sync_state" ON sync_state FOR SELECT USING (has_role('staff'));

-- ============================================
-- 4. Triggers for Updated Timestamps
-- ============================================

CREATE TRIGGER update_gprs_status_updated_at BEFORE UPDATE ON gprs_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_state_updated_at BEFORE UPDATE ON sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Helper Functions
-- ============================================

-- Function to get last sync timestamp for a type
CREATE OR REPLACE FUNCTION get_last_sync_timestamp(p_sync_type TEXT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    last_sync TIMESTAMPTZ;
BEGIN
    SELECT last_sync_at INTO last_sync
    FROM sync_state
    WHERE sync_type = p_sync_type
    ORDER BY last_sync_at DESC
    LIMIT 1;
    
    RETURN COALESCE(last_sync, '2020-01-01'::TIMESTAMPTZ);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record sync completion
CREATE OR REPLACE FUNCTION record_sync_completion(
    p_sync_type TEXT,
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ,
    p_records_count INTEGER,
    p_status TEXT DEFAULT 'success',
    p_error TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    sync_id UUID;
BEGIN
    INSERT INTO sync_state (
        sync_type,
        last_sync_at,
        last_sync_from,
        last_sync_to,
        records_synced,
        status,
        error_message
    ) VALUES (
        p_sync_type,
        NOW(),
        p_from,
        p_to,
        p_records_count,
        p_status,
        p_error
    )
    RETURNING id INTO sync_id;
    
    RETURN sync_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Views for Reporting
-- ============================================

-- View: Latest meter readings with meter details
CREATE OR REPLACE VIEW v_latest_meter_readings AS
SELECT 
    m.id AS meter_id,
    m.meter_id AS meter_number,
    m.meter_type,
    c.name AS customer_name,
    mr.reading_value,
    mr.timestamp AS reading_time,
    mr.consumption,
    mr.voltage,
    mr.current,
    mr.power_factor,
    mr.source
FROM meters m
LEFT JOIN LATERAL (
    SELECT *
    FROM meter_readings
    WHERE meter_id = m.id
    ORDER BY timestamp DESC
    LIMIT 1
) mr ON true
LEFT JOIN customers c ON m.customer_id = c.id;

-- View: Token statistics by customer
CREATE OR REPLACE VIEW v_customer_token_stats AS
SELECT 
    c.id AS customer_id,
    c.customer_id AS customer_number,
    c.name AS customer_name,
    COUNT(tr.id) AS total_tokens,
    SUM(tr.amount) AS total_amount,
    SUM(tr.units) AS total_units,
    MAX(tr.generated_at) AS last_purchase_date,
    COUNT(CASE WHEN tr.generated_at > NOW() - INTERVAL '30 days' THEN 1 END) AS tokens_last_30_days
FROM customers c
LEFT JOIN token_records tr ON c.id = tr.customer_id
GROUP BY c.id, c.customer_id, c.name;

-- View: Active tasks summary
CREATE OR REPLACE VIEW v_active_tasks_summary AS
SELECT 
    task_type,
    status,
    COUNT(*) AS task_count,
    MIN(created_at) AS oldest_task,
    MAX(created_at) AS newest_task
FROM remote_tasks
WHERE status IN ('pending', 'processing')
GROUP BY task_type, status;;
