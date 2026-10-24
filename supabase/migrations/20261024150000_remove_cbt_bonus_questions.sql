-- Remove bonus questions and bonus-specific columns from cbt_questions
DELETE FROM public.cbt_questions WHERE is_bonus = true;

ALTER TABLE public.cbt_questions DROP COLUMN IF EXISTS is_bonus;
ALTER TABLE public.cbt_questions DROP COLUMN IF EXISTS targeted_emails;
