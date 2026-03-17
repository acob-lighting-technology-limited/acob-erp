DO $$
DECLARE
  canonical_permissions text[] := ARRAY[
    'users.view',
    'users.manage',
    'roles.manage',
    'hr.view',
    'hr.manage',
    'finance.view',
    'finance.manage',
    'inventory.view',
    'inventory.manage',
    'purchasing.view',
    'purchasing.manage',
    'settings.manage',
    'reports.view'
  ];
  super_admin_permissions text[];
BEGIN
  INSERT INTO public.roles (name, description, permissions, is_system)
  VALUES ('super_admin', 'Full system access', canonical_permissions, true)
  ON CONFLICT (name) DO UPDATE
    SET permissions = EXCLUDED.permissions,
        is_system = true,
        updated_at = now();

  SELECT permissions
  INTO super_admin_permissions
  FROM public.roles
  WHERE name = 'super_admin';

  INSERT INTO public.roles (name, description, permissions, is_system)
  VALUES (
    'developer',
    'Developer-level access (matches Super Admin)',
    COALESCE(super_admin_permissions, canonical_permissions),
    true
  )
  ON CONFLICT (name) DO UPDATE
    SET permissions = EXCLUDED.permissions,
        description = EXCLUDED.description,
        is_system = true,
        updated_at = now();
END $$;;
