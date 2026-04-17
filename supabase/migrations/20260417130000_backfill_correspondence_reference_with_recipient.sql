-- Backfill existing outgoing correspondence references to:
-- ACOB/{DEPT_CODE}/{RECIPIENT_CODE}/{YEAR}/{NNN}

insert into public.correspondence_department_codes (department_name, department_code, is_active)
values ('Business, Growth and Innovation', 'BGI', true)
on conflict (department_name) do update
set department_code = excluded.department_code,
    is_active = true,
    updated_at = now();

alter table public.correspondence_records disable trigger trg_correspondence_before_update;

with source_rows as (
  select
    r.id,
    coalesce(nullif(trim(r.company_code), ''), 'ACOB') as company_code,
    upper(
      coalesce(
        nullif(trim(r.department_code), ''),
        (
          select c.department_code
          from public.correspondence_department_codes c
          where c.department_name = r.department_name
            and c.is_active = true
          limit 1
        ),
        'GEN'
      )
    ) as department_code,
    extract(year from coalesce(r.submitted_at, r.created_at, now()))::int as reference_year,
    coalesce(
      nullif(
        left(
          upper(
            regexp_replace(
              coalesce(
                nullif(trim(r.metadata ->> 'recipient_code'), ''),
                nullif(trim(r.recipient_name), ''),
                'GEN'
              ),
              '[^A-Z0-9]+',
              '',
              'g'
            )
          ),
          8
        ),
        ''
      ),
      'GEN'
    ) as recipient_code,
    coalesce(r.submitted_at, r.created_at, now()) as sort_time
  from public.correspondence_records r
  where r.direction = 'outgoing'
),
ranked as (
  select
    s.*,
    row_number() over (
      partition by s.company_code, s.department_code, s.recipient_code, s.reference_year
      order by s.sort_time asc, s.id asc
    ) as seq_no
  from source_rows s
),
prepared as (
  select
    r.id,
    r.department_code,
    r.recipient_code,
    format(
      '%s/%s/%s/%s/%s',
      r.company_code,
      r.department_code,
      r.recipient_code,
      r.reference_year::text,
      lpad(r.seq_no::text, 3, '0')
    ) as next_reference
  from ranked r
)
update public.correspondence_records cr
set
  department_code = p.department_code,
  reference_number = p.next_reference,
  metadata = coalesce(cr.metadata, '{}'::jsonb) || jsonb_build_object('recipient_code', p.recipient_code),
  updated_at = now()
from prepared p
where cr.id = p.id
  and cr.reference_number is distinct from p.next_reference;

alter table public.correspondence_records enable trigger trg_correspondence_before_update;

delete from public.correspondence_counters
where counter_key like 'outgoing:%';

insert into public.correspondence_counters (counter_key, year, last_number, created_at, updated_at)
select
  format('outgoing:%s:%s', split_part(reference_number, '/', 2), split_part(reference_number, '/', 3)) as counter_key,
  split_part(reference_number, '/', 4)::int as year,
  max(split_part(reference_number, '/', 5)::int) as last_number,
  now(),
  now()
from public.correspondence_records
where direction = 'outgoing'
  and reference_number ~ '^[^/]+/[A-Z0-9]+/[A-Z0-9]+/[0-9]{4}/[0-9]{3}$'
group by 1, 2
on conflict (counter_key, year) do update
set
  last_number = excluded.last_number,
  updated_at = now();

