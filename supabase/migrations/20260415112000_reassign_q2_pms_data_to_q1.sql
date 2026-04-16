do $$
declare
  target_q2_cycle_id uuid;
  target_q1_cycle_id uuid;
begin
  select id
  into target_q2_cycle_id
  from public.review_cycles
  where id = 'aaaaaaaa-0001-4000-a000-000000000001'
     or (
       review_type = 'quarterly'
       and start_date = date '2026-04-01'
       and end_date = date '2026-06-30'
     )
  order by start_date desc, created_at asc
  limit 1;

  if target_q2_cycle_id is null then
    raise exception 'Q2 2026 performance review cycle not found';
  end if;

  select id
  into target_q1_cycle_id
  from public.review_cycles
  where review_type = 'quarterly'
    and start_date = date '2026-01-01'
    and end_date = date '2026-03-31'
  order by start_date asc, created_at asc
  limit 1;

  if target_q1_cycle_id is null then
    insert into public.review_cycles (
      id,
      name,
      start_date,
      end_date,
      review_type,
      status,
      created_at,
      updated_at
    )
    values (
      'aaaaaaaa-0001-4000-a000-000000000000',
      'Q1 2026 Performance Review',
      date '2026-01-01',
      date '2026-03-31',
      'quarterly',
      'closed',
      now(),
      now()
    )
    on conflict (id) do update
    set
      name = excluded.name,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      review_type = excluded.review_type,
      status = excluded.status,
      updated_at = now()
    returning id into target_q1_cycle_id;
  end if;

  update public.goals_objectives
  set review_cycle_id = target_q1_cycle_id
  where review_cycle_id = target_q2_cycle_id;

  update public.performance_reviews
  set
    review_cycle_id = target_q1_cycle_id,
    updated_at = now()
  where review_cycle_id = target_q2_cycle_id;

  update public.peer_feedback
  set
    review_cycle_id = target_q1_cycle_id,
    updated_at = now()
  where review_cycle_id = target_q2_cycle_id;

  update public.cbt_questions
  set
    review_cycle_id = target_q1_cycle_id,
    updated_at = now()
  where review_cycle_id = target_q2_cycle_id;

  update public.cbt_attempts
  set
    review_cycle_id = target_q1_cycle_id,
    updated_at = now()
  where review_cycle_id = target_q2_cycle_id;

  update public.development_plans
  set
    review_cycle_id = target_q1_cycle_id,
    updated_at = now()
  where review_cycle_id = target_q2_cycle_id;

  update public.review_cycles
  set
    name = 'Q1 2026 Performance Review',
    start_date = date '2026-01-01',
    end_date = date '2026-03-31',
    review_type = 'quarterly',
    status = 'closed',
    updated_at = now()
  where id = target_q1_cycle_id;

  update public.review_cycles
  set
    name = 'Q2 2026 Performance Review',
    start_date = date '2026-04-01',
    end_date = date '2026-06-30',
    review_type = 'quarterly',
    status = 'active',
    updated_at = now()
  where id = target_q2_cycle_id;
end
$$;

notify pgrst, 'reload schema';
