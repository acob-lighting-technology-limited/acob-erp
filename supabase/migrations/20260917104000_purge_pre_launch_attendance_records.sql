-- Migration: Purge pre-launch trial attendance records before official company rollout date (2026-06-01)
-- Description: Removes hardware trial / test attendance records logged between April and May 2026,
-- and cleans up referencing attendance_events prior to June 1, 2026.

DELETE FROM public.attendance_events
WHERE event_date < '2026-06-01';

DELETE FROM public.attendance_records
WHERE date < '2026-06-01';
