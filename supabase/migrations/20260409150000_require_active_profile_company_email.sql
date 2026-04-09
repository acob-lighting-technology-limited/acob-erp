-- Require active employee profiles to have a usable company email.
-- This does not require profiles.company_email to equal auth.users.email.
-- NOT VALID keeps existing legacy rows from blocking the migration while
-- enforcing the rule for new inserts and future updates.

alter table public.profiles
  drop constraint if exists profiles_active_company_email_required;

alter table public.profiles
  add constraint profiles_active_company_email_required
  check (
    coalesce(employment_status::text, 'active') <> 'active'
    or nullif(btrim(coalesce(company_email, '')), '') is not null
  )
  not valid;

alter table public.profiles
  drop constraint if exists profiles_company_email_format;

alter table public.profiles
  add constraint profiles_company_email_format
  check (
    company_email is null
    or btrim(company_email) = ''
    or btrim(company_email) ~* '^[A-Za-z0-9._%+-]+@(org\.)?acoblighting\.com$'
  )
  not valid;
