-- Add secondary email address for notification/export use-cases.
-- This does NOT change auth login email.

alter table public.profiles
  add column if not exists additional_email text;

comment on column public.profiles.additional_email is
  'Optional secondary email for exports and notifications; not used for authentication.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_additional_email_format'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_additional_email_format
      check (
        additional_email is null
        or additional_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
      );
  end if;
end $$;
