-- Events (/admin/events) shipped with a grantable key, events.main, in
-- lib/admin/policy-v2.ts but was never added here, so ticking "Events" for an
-- admin in Settings → Users would have violated this constraint.
--
-- mddesk.main is deliberately absent: MD's Desk is membership-gated
-- (md_desk_delegates), not granted per admin.
--
-- Keep in sync with GRANTABLE_ADMIN_ROUTES in lib/admin/policy-v2.ts.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_admin_routes_allowed;

ALTER TABLE public.profiles
  ADD CONSTRAINT check_profiles_admin_routes_allowed
  CHECK (
    admin_routes IS NULL
    OR admin_routes <@ ARRAY[
      'hr.main','hr.leave','hr.attendance','hr.pms','hr.fleet','hr.resources','hr.pms.cbt.manage',
      'jobdescriptions.main','accounts.main','finance.main','purchasing.main','payroll.main',
      'assets.main','assets.issues','inventory.main',
      'reports.weekly','reports.other','scorecard.main',
      'portfolios.main','projects.main',
      'tasks.main',
      'communications.main','communications.broadcast','communications.meetings',
      'correspondence.main','documentation.main','events.main','feedback.main',
      'helpdesk.main','notifications.main','tools.main',
      'settings.main','auditlogs.main',
      'security.networkActivity','security.bypassOverride'
    ]::text[]
  );
