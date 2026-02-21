-- Make additional_email validation robust to whitespace and avoid false rejects.

alter table public.profiles
  drop constraint if exists profiles_additional_email_format;

alter table public.profiles
  add constraint profiles_additional_email_format
  check (
    additional_email is null
    or btrim(additional_email) = ''
    or btrim(additional_email) ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );
