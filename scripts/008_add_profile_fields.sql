-- Add additional profile fields
alter table public.profiles
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_name text,
  add column if not exists date_of_birth date,
  add column if not exists employment_date date;

-- Optional: grant select/update to authenticated users per existing RLS policies




