-- Prefix issued references in place. Preserve counters and bank-returned references.
ALTER TABLE public.requisitions DISABLE TRIGGER trg_requisitions_guard_immutable;
UPDATE public.requisitions
SET requisition_number = 'ACOB/' || requisition_number
WHERE requisition_number NOT LIKE 'ACOB/%';
ALTER TABLE public.requisitions ENABLE TRIGGER trg_requisitions_guard_immutable;

UPDATE public.requisition_payment_schedules
SET schedule_number = 'ACOB/' || schedule_number
WHERE schedule_number NOT LIKE 'ACOB/%';

UPDATE public.requisition_schedule_items
SET transaction_ref = 'ACOB/' || transaction_ref
WHERE transaction_ref NOT LIKE 'ACOB/%';

CREATE OR REPLACE FUNCTION public.format_requisition_number(
  p_form_type text, p_department_code text, p_year integer, p_serial integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT 'ACOB/' || CASE p_form_type WHEN 'petty_cash' THEN 'PC' ELSE 'PR' END
    || '/' || p_department_code
    || '/' || lpad((p_year % 100)::text, 2, '0')
    || '/' || lpad(p_serial::text, greatest(3, length(p_serial::text)), '0')
$$;

REVOKE ALL ON FUNCTION public.format_requisition_number(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- Schedule items derive their transaction reference from the requisition number.
CREATE FUNCTION public.prefix_requisition_schedule_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.schedule_number NOT LIKE 'ACOB/%' THEN
    NEW.schedule_number := 'ACOB/' || NEW.schedule_number;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prefix_requisition_schedule_number() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_prefix_requisition_schedule_number
  BEFORE INSERT ON public.requisition_payment_schedules
  FOR EACH ROW EXECUTE FUNCTION public.prefix_requisition_schedule_number();
