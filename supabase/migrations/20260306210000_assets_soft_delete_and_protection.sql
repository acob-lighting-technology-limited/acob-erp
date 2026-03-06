alter table public.assets
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists delete_reason text;

create index if not exists idx_assets_deleted_at on public.assets(deleted_at);

create or replace function public.prevent_asset_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Hard delete is disabled for assets. Archive the asset instead.';
end;
$$;

drop trigger if exists trg_assets_prevent_delete on public.assets;
create trigger trg_assets_prevent_delete
before delete on public.assets
for each row
execute function public.prevent_asset_delete();
