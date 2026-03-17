begin;

-- Tighten department_payments lead access to own department only.
drop policy if exists "Department payments insert policy" on public.department_payments;
create policy "Department payments insert policy"
on public.department_payments
for insert
to authenticated
with check (
  has_role('admin')
  or (
    has_role('lead')
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.department_id = department_payments.department_id
    )
  )
);

drop policy if exists "Department payments update policy" on public.department_payments;
create policy "Department payments update policy"
on public.department_payments
for update
to authenticated
using (
  has_role('admin')
  or (
    has_role('lead')
    and created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.department_id = department_payments.department_id
    )
  )
)
with check (
  has_role('admin')
  or (
    has_role('lead')
    and created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.department_id = department_payments.department_id
    )
  )
);

-- Tighten payment_documents lead access to own department payment rows only.
drop policy if exists "Payment documents select policy" on public.payment_documents;
create policy "Payment documents select policy"
on public.payment_documents
for select
to authenticated
using (
  has_role('admin')
  or (
    has_role('lead')
    and exists (
      select 1
      from public.department_payments dp
      join public.profiles p on p.id = auth.uid()
      where dp.id = payment_documents.payment_id
        and p.department_id = dp.department_id
    )
  )
  or uploaded_by = auth.uid()
);

drop policy if exists "Payment documents insert policy" on public.payment_documents;
create policy "Payment documents insert policy"
on public.payment_documents
for insert
to authenticated
with check (
  has_role('admin')
  or (
    has_role('lead')
    and exists (
      select 1
      from public.department_payments dp
      join public.profiles p on p.id = auth.uid()
      where dp.id = payment_documents.payment_id
        and p.department_id = dp.department_id
    )
  )
);

commit;;
