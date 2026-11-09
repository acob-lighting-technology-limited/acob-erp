-- Edit grants for the individual HR pages a lead can delegate: Employees, Departments,
-- Lunch Register and Offices & Rooms. Until now the only way to delegate those was the whole
-- of HR ('hr.main'). Widens the allowed route keys; no rows are changed, nobody's access moves.
ALTER TABLE public.admin_edit_grants
  DROP CONSTRAINT IF EXISTS admin_edit_grants_route_key_check;

ALTER TABLE public.admin_edit_grants
  ADD CONSTRAINT admin_edit_grants_route_key_check CHECK (route_key IN (
    'hr.main','hr.employees','hr.departments','hr.lunch','hr.offices',
    'hr.fleet','hr.leave','hr.attendance','hr.pms','hr.pms.cbt.manage','jobdescriptions.main',
    'it.main','security.networkActivity','security.bypassOverride'
  ));
