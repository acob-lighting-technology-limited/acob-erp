-- Migration: Remove legacy 2025 review cycles (Q3 2025 and Q4 2025)
-- Timestamp: 20260917100000

-- Clean up any child records referencing legacy 2025 review cycles
DELETE FROM public.cbt_attempts
WHERE review_cycle_id IN (
  'aaaaaaaa-0001-4000-a000-000000000003',
  'aaaaaaaa-0001-4000-a000-000000000004'
);

DELETE FROM public.cbt_questions
WHERE review_cycle_id IN (
  'aaaaaaaa-0001-4000-a000-000000000003',
  'aaaaaaaa-0001-4000-a000-000000000004'
);

DELETE FROM public.performance_reviews
WHERE review_cycle_id IN (
  'aaaaaaaa-0001-4000-a000-000000000003',
  'aaaaaaaa-0001-4000-a000-000000000004'
);

DELETE FROM public.goals_objectives
WHERE review_cycle_id IN (
  'aaaaaaaa-0001-4000-a000-000000000003',
  'aaaaaaaa-0001-4000-a000-000000000004'
);

-- Delete 2025 review cycles
DELETE FROM public.review_cycles
WHERE id IN (
  'aaaaaaaa-0001-4000-a000-000000000003',
  'aaaaaaaa-0001-4000-a000-000000000004'
) OR (start_date >= '2025-01-01' AND end_date <= '2025-12-31');
