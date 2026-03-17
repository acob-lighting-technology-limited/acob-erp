
-- Default tariffs
INSERT INTO tariffs (tariff_id, name, category, price_per_kwh, vat_rate, is_active) VALUES
('T001', 'Residential Standard', 'RESIDENTIAL', 45.00, 7.5, true),
('T002', 'Commercial Standard', 'COMMERCIAL', 65.00, 7.5, true),
('T003', 'Productive Use', 'PRODUCTIVE', 55.00, 7.5, true),
('T004', 'Public Facilities', 'PUBLIC', 50.00, 7.5, true)
ON CONFLICT (tariff_id) DO NOTHING;

-- Default gateways
INSERT INTO gateways (gateway_id, name, status, location) VALUES
('GW001', 'Gateway 1 - Zone A', 'online', 'Zone A'),
('GW002', 'Gateway 2 - Zone B', 'online', 'Zone B'),
('GW003', 'Gateway 3 - Zone C', 'offline', 'Zone C')
ON CONFLICT (gateway_id) DO NOTHING;

-- Default CRM pipeline
INSERT INTO crm_pipelines (name, description, stages, is_default, is_active)
VALUES (
  'Sales Pipeline',
  'Default sales pipeline',
  '[
    {"id": "new", "name": "New", "order": 1, "probability": 10, "color": "#94a3b8"},
    {"id": "contacted", "name": "Contacted", "order": 2, "probability": 20, "color": "#60a5fa"},
    {"id": "qualified", "name": "Qualified", "order": 3, "probability": 40, "color": "#a78bfa"},
    {"id": "proposal", "name": "Proposal", "order": 4, "probability": 60, "color": "#f59e0b"},
    {"id": "negotiation", "name": "Negotiation", "order": 5, "probability": 80, "color": "#fb923c"},
    {"id": "closed_won", "name": "Closed Won", "order": 6, "probability": 100, "color": "#22c55e"},
    {"id": "closed_lost", "name": "Closed Lost", "order": 7, "probability": 0, "color": "#ef4444"}
  ]'::jsonb,
  true,
  true
) ON CONFLICT DO NOTHING;

-- Default CRM tags
INSERT INTO crm_tags (name, color, description) VALUES
  ('Hot Lead', '#ef4444', 'High priority lead'),
  ('Qualified', '#22c55e', 'Qualified prospect'),
  ('Follow Up', '#f59e0b', 'Needs follow up'),
  ('VIP', '#8b5cf6', 'VIP customer'),
  ('Partner', '#3b82f6', 'Business partner')
ON CONFLICT (name) DO NOTHING;
;
