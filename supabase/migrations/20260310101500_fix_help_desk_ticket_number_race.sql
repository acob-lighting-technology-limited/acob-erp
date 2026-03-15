-- Fix help desk ticket number generation race condition by switching from MAX+1 to a sequence.

CREATE SEQUENCE IF NOT EXISTS public.help_desk_ticket_number_seq;

DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(ticket_number, '^HD-', ''))::bigint), 0)
  INTO v_max
  FROM public.help_desk_tickets
  WHERE ticket_number ~ '^HD-[0-9]+$';

  IF v_max > 0 THEN
    PERFORM setval('public.help_desk_ticket_number_seq', v_max, true);
  ELSE
    PERFORM setval('public.help_desk_ticket_number_seq', 1, false);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_help_desk_ticket_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_number bigint;
BEGIN
  next_number := nextval('public.help_desk_ticket_number_seq');
  RETURN 'HD-' || lpad(next_number::text, 6, '0');
END;
$$;
