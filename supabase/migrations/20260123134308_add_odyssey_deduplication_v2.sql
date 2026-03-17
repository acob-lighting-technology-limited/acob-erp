-- Add unique constraint on odyssey_token_id to prevent future duplicates
-- Also add missing Odyssey API fields for verbatim data storage

-- Add unique constraint (duplicates already removed)
ALTER TABLE token_records
ADD CONSTRAINT token_records_odyssey_token_id_key UNIQUE (odyssey_token_id);

-- Add Odyssey API fields for verbatim storage
ALTER TABLE token_records
ADD COLUMN IF NOT EXISTS odyssey_data JSONB,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NAIRA',
ADD COLUMN IF NOT EXISTS transaction_type TEXT,
ADD COLUMN IF NOT EXISTS odyssey_meter_id TEXT,
ADD COLUMN IF NOT EXISTS odyssey_customer_id TEXT,
ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_token_records_odyssey_meter_id ON token_records(odyssey_meter_id);
CREATE INDEX IF NOT EXISTS idx_token_records_transaction_type ON token_records(transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_records_currency ON token_records(currency);

-- Add comments
COMMENT ON COLUMN token_records.odyssey_data IS 'Full Odyssey API response for verbatim data storage';
COMMENT ON COLUMN token_records.odyssey_token_id IS 'Unique identifier from Odyssey API - prevents duplicates';
COMMENT ON CONSTRAINT token_records_odyssey_token_id_key ON token_records IS 'Prevents duplicate records from Odyssey sync';;
