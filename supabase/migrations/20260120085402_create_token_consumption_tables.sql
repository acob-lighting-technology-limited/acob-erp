
-- Token Sales Table
CREATE TABLE IF NOT EXISTS token_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  meter_id UUID REFERENCES meters(id),
  token VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  units DECIMAL(10, 2) NOT NULL,
  vat DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  tariff_rate DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Token Records Table
CREATE TABLE IF NOT EXISTS token_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  meter_id UUID REFERENCES meters(id),
  token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('credit', 'clear_tamper', 'clear_credit', 'max_power')),
  token VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2),
  units DECIMAL(10, 2),
  power_limit DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Remote Tasks Table
CREATE TABLE IF NOT EXISTS remote_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID REFERENCES meters(id),
  task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('token', 'control', 'reading')),
  operation VARCHAR(20),
  parameters JSONB,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Consumption Data Table
CREATE TABLE IF NOT EXISTS consumption_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID REFERENCES meters(id),
  reading DECIMAL(10, 2) NOT NULL,
  reading_date TIMESTAMPTZ NOT NULL,
  consumption DECIMAL(10, 2),
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'automatic', 'remote')),
  created_at TIMESTAMPTZ DEFAULT now()
);
;
