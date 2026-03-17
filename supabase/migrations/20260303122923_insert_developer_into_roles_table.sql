INSERT INTO public.roles (id, name, description, permissions, is_system) 
VALUES (
  gen_random_uuid(), 
  'developer', 
  'System developer and maintainer access', 
  ARRAY['users.view','users.manage','roles.manage','hr.view','hr.manage','finance.view','finance.manage','inventory.view','inventory.manage','purchasing.view','purchasing.manage','settings.manage','reports.view'], 
  true
) ON CONFLICT (name) DO UPDATE SET 
  permissions = ARRAY['users.view','users.manage','roles.manage','hr.view','hr.manage','finance.view','finance.manage','inventory.view','inventory.manage','purchasing.view','purchasing.manage','settings.manage','reports.view'],
  description = 'System developer and maintainer access';;
