-- Who records payments is chosen per form: Payment Requests and Petty Cash each
-- have their own payment officers, picked in Admin > Accounts > Requisitions >
-- Settings. Until now the Accounts lead was always allowed (hard-coded) and the
-- list applied to both forms.
--
-- The table keeps its name; each row is now (person, form type). The old list,
-- if it had anyone, becomes a Payment Request officer and is copied to Petty
-- Cash so nobody loses what they could do. The Accounts-lead rule is removed:
-- a person records payments only if they are listed for that form.
--
-- Officers are NOT seeded here: a re-run of this file must never put back
-- someone an admin removed. Add them in Settings.
--
-- Safe to re-run.

ALTER TABLE public.requisition_payment_processors ADD COLUMN IF NOT EXISTS form_type text;

ALTER TABLE public.requisition_payment_processors DROP CONSTRAINT IF EXISTS requisition_payment_processors_pkey;

WITH legacy AS (
  UPDATE public.requisition_payment_processors
  SET form_type = 'payment_request'
  WHERE form_type IS NULL
  RETURNING profile_id, added_by, created_at
)
INSERT INTO public.requisition_payment_processors (profile_id, added_by, created_at, form_type)
SELECT profile_id, added_by, created_at, 'petty_cash' FROM legacy;

ALTER TABLE public.requisition_payment_processors ALTER COLUMN form_type SET NOT NULL;

ALTER TABLE public.requisition_payment_processors DROP CONSTRAINT IF EXISTS requisition_payment_processors_form_type_check;
ALTER TABLE public.requisition_payment_processors
  ADD CONSTRAINT requisition_payment_processors_form_type_check CHECK (form_type IN ('payment_request', 'petty_cash'));

ALTER TABLE public.requisition_payment_processors
  ADD CONSTRAINT requisition_payment_processors_pkey PRIMARY KEY (profile_id, form_type);

-- Is this person a payment officer for this form?
CREATE OR REPLACE FUNCTION public.is_requisition_payment_officer(p_user_id uuid, p_form_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requisition_payment_processors
    WHERE profile_id = p_user_id AND form_type = p_form_type
  )
$$;

-- Is this person a payment officer for either form? (Used for who may see
-- requisitions and who gets the payment queue.)
CREATE OR REPLACE FUNCTION public.is_requisition_payment_processor(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.requisition_payment_processors WHERE profile_id = p_user_id)
$$;

REVOKE ALL ON FUNCTION public.is_requisition_payment_officer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_requisition_payment_officer(uuid, text) TO authenticated, service_role;

-- Recording a payment checks the officer list for THIS requisition's form.
CREATE OR REPLACE FUNCTION public.requisition_record_payment(
  p_requisition_id uuid, p_actor_id uuid, p_amount numeric, p_paid_on date, p_method text,
  p_reference text, p_receipt_path text, p_note text, p_signature_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req public.requisitions;
  v_paid numeric;
  v_status text;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_req FROM public.requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'requisition_not_found'; END IF;
  IF v_req.status NOT IN ('awaiting_payment', 'partly_paid') THEN RAISE EXCEPTION 'requisition_not_payable'; END IF;
  IF v_req.user_id = p_actor_id THEN RAISE EXCEPTION 'cannot_process_own_requisition'; END IF;
  IF NOT public.is_requisition_payment_officer(p_actor_id, v_req.form_type) THEN
    RAISE EXCEPTION 'not_a_payment_processor';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'payment_amount_invalid'; END IF;
  IF p_amount > v_req.amount - v_req.amount_paid THEN RAISE EXCEPTION 'payment_exceeds_outstanding'; END IF;

  INSERT INTO public.requisition_payments (
    requisition_id, amount, paid_on, method, reference, receipt_path, note, recorded_by, signature_path
  )
  VALUES (
    p_requisition_id, p_amount, p_paid_on, p_method,
    nullif(btrim(coalesce(p_reference, '')), ''), p_receipt_path,
    nullif(btrim(coalesce(p_note, '')), ''), p_actor_id, p_signature_path
  )
  RETURNING id INTO v_payment_id;

  v_paid := v_req.amount_paid + p_amount;
  v_status := CASE WHEN v_paid >= v_req.amount THEN 'paid' ELSE 'partly_paid' END;

  UPDATE public.requisitions SET amount_paid = v_paid, status = v_status WHERE id = p_requisition_id;

  RETURN jsonb_build_object('payment_id', v_payment_id, 'amount_paid', v_paid, 'status', v_status);
END;
$function$;
