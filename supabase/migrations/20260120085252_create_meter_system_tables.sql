
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tariffs Table
CREATE TABLE IF NOT EXISTS tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(20) CHECK (category IN ('RESIDENTIAL', 'COMMERCIAL', 'PRODUCTIVE', 'PUBLIC')),
  price_per_kwh DECIMAL(10, 2) NOT NULL,
  vat_rate DECIMAL(5, 2) DEFAULT 7.5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Gateways Table
CREATE TABLE IF NOT EXISTS gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('online', 'offline')) DEFAULT 'offline',
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  remark TEXT,
  crm_contact_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Meters Table
CREATE TABLE IF NOT EXISTS meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id VARCHAR(20) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  tariff_id UUID REFERENCES tariffs(id),
  gateway_id UUID REFERENCES gateways(id),
  meter_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('online', 'offline')) DEFAULT 'offline',
  install_date DATE,
  last_reading DECIMAL(10, 2),
  last_reading_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'lead', 'staff', 'visitor')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
;
