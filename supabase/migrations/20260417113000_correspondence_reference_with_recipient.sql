-- Align outgoing correspondence reference format with business rule:
-- ACOB/{DEPT_CODE}/{RECIPIENT_CODE}/{YEAR}/{NNN}

create or replace function public.generate_correspondence_reference(
  p_direction text,
  p_department_code text default null,
  p_recipient_code text default null,
  p_company_code text default 'ACOB',
  p_reference_year integer default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year integer := coalesce(p_reference_year, extract(year from now())::integer);
  v_key text;
  v_prefix text;
  v_next integer;
  v_code text;
  v_recipient_code text;
begin
  if p_direction not in ('incoming', 'outgoing') then
    raise exception 'Invalid direction for correspondence reference: %', p_direction;
  end if;

  if p_direction = 'incoming' then
    v_code := 'IN';
    v_key := 'incoming:IN';
    v_prefix := format('%s/IN/%s/', coalesce(nullif(trim(p_company_code), ''), 'ACOB'), v_year::text);
  else
    if p_department_code is null or trim(p_department_code) = '' then
      raise exception 'Department code is required for outgoing correspondence references';
    end if;

    v_code := upper(trim(p_department_code));
    v_recipient_code := upper(regexp_replace(coalesce(nullif(trim(p_recipient_code), ''), 'GEN'), '[^A-Z0-9]+', '', 'g'));
    if v_recipient_code = '' then
      v_recipient_code := 'GEN';
    end if;

    v_key := format('outgoing:%s:%s', v_code, v_recipient_code);
    v_prefix := format(
      '%s/%s/%s/%s/',
      coalesce(nullif(trim(p_company_code), ''), 'ACOB'),
      v_code,
      v_recipient_code,
      v_year::text
    );
  end if;

  insert into public.correspondence_counters (counter_key, year, last_number)
  values (v_key, v_year, 0)
  on conflict (counter_key, year) do nothing;

  perform 1
  from public.correspondence_counters
  where counter_key = v_key
    and year = v_year
  for update;

  update public.correspondence_counters
  set last_number = last_number + 1,
      updated_at = now()
  where counter_key = v_key
    and year = v_year
  returning last_number into v_next;

  return v_prefix || lpad(v_next::text, 3, '0');
end;
$$;

create or replace function public.generate_correspondence_reference(
  p_direction text,
  p_department_code text default null,
  p_company_code text default 'ACOB',
  p_reference_year integer default null
)
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.generate_correspondence_reference(
    p_direction,
    p_department_code,
    null,
    p_company_code,
    p_reference_year
  );
$$;

create or replace function public.correspondence_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_department_code text;
  v_year integer;
  v_recipient_code text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if new.originator_id is null then
    new.originator_id := auth.uid();
  end if;

  if new.reference_number is not null and btrim(new.reference_number) <> '' and auth.role() <> 'service_role' then
    raise exception 'Reference number is system-generated and cannot be set manually';
  end if;

  new.company_code := coalesce(nullif(trim(new.company_code), ''), 'ACOB');
  v_year := extract(year from coalesce(new.submitted_at, new.created_at, now()))::integer;

  if new.direction = 'incoming' then
    new.department_code := 'IN';
    if new.status is null then
      new.status := 'open';
    end if;
  else
    if new.department_name is null or btrim(new.department_name) = '' then
      raise exception 'department_name is required for outgoing correspondence';
    end if;

    select c.department_code
      into v_department_code
    from public.correspondence_department_codes c
    where c.department_name = new.department_name
      and c.is_active = true
    limit 1;

    if v_department_code is null and new.department_code is not null and btrim(new.department_code) <> '' then
      v_department_code := upper(btrim(new.department_code));
    end if;

    if v_department_code is null then
      raise exception 'No active department code configured for %', new.department_name;
    end if;

    new.department_code := v_department_code;
    v_recipient_code := upper(
      regexp_replace(
        coalesce(
          nullif(trim(coalesce(new.metadata ->> 'recipient_code', '')), ''),
          nullif(trim(coalesce(new.recipient_name, '')), ''),
          'GEN'
        ),
        '[^A-Z0-9]+',
        '',
        'g'
      )
    );
    if v_recipient_code = '' then
      v_recipient_code := 'GEN';
    end if;

    if new.status is null then
      new.status := 'draft';
    end if;
  end if;

  if new.reference_number is null or btrim(new.reference_number) = '' then
    new.reference_number := public.generate_correspondence_reference(
      new.direction,
      new.department_code,
      case when new.direction = 'outgoing' then v_recipient_code else null end,
      new.company_code,
      v_year
    );
  end if;

  return new;
end;
$$;
