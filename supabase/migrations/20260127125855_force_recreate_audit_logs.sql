-- Force recreate Audit Logs to ensure columns are correct
DROP TABLE IF EXISTS public.audit_logs CASCADE;

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    operation TEXT NOT NULL, 
    table_name TEXT,
    record_id TEXT, 
    status TEXT NOT NULL, 
    error_details TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    site_id TEXT 
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON public.audit_logs(operation);

-- Constraints
ALTER TABLE public.gateways DROP CONSTRAINT IF EXISTS gateways_gateway_id_key;
ALTER TABLE public.gateways ADD CONSTRAINT gateways_gateway_id_key UNIQUE (gateway_id);

ALTER TABLE public.meters DROP CONSTRAINT IF EXISTS meters_meter_id_key;
ALTER TABLE public.meters ADD CONSTRAINT meters_meter_id_key UNIQUE (meter_id);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert for sync" ON public.audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated select" ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');
;
