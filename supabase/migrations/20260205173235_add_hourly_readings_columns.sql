-- Add columns for hourly energy data from Odyssey API
ALTER TABLE meter_readings
ADD COLUMN IF NOT EXISTS energy_balance_kwh NUMERIC,
ADD COLUMN IF NOT EXISTS energy_consumption_kwh NUMERIC,
ADD COLUMN IF NOT EXISTS energy_reading_kwh NUMERIC,
ADD COLUMN IF NOT EXISTS time_interval_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS customer_account_id TEXT;

-- Create unique constraint for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_meter_readings_odyssey_unique
ON meter_readings (odyssey_meter_id, timestamp, site_id)
WHERE odyssey_meter_id IS NOT NULL;;
