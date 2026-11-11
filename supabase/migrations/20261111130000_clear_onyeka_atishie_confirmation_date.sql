-- Migration: Clear confirmation_date for Onyekachukwu Atishie (ACOB/2026/059)
-- Context: Employee is currently on probation / not yet confirmed.

UPDATE public.profiles
SET
  confirmation_date = NULL,
  updated_at = NOW()
WHERE employee_number = 'ACOB/2026/059';
