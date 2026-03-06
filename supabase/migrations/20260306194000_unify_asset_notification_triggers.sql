-- Keep a single notification path so all asset mail types use bundled routing
-- (assignee + lead/HCS/MD escalation) without legacy duplicates.

drop trigger if exists on_asset_assignment_return on public.asset_assignments;
drop trigger if exists on_asset_status_change on public.assets;
