-- Petty cash exception (flag + reason above the ₦50,000 cap) and conversion of a
-- rejected requisition into a new one of another form type.
-- NOT APPLIED: review, then apply to the live project only with explicit approval.

ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS exception_reason text,
  ADD COLUMN IF NOT EXISTS converted_from_id uuid REFERENCES public.requisitions (id);

COMMENT ON COLUMN public.requisitions.exception_reason IS
  'Why a petty cash voucher above the cap was raised. Null when within the cap.';
COMMENT ON COLUMN public.requisitions.converted_from_id IS
  'The rejected requisition this one was converted from (new form type, new number).';

CREATE OR REPLACE FUNCTION public.requisition_create(p_requisition jsonb, p_stages jsonb)
 RETURNS requisitions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req public.requisitions;
BEGIN
  IF jsonb_typeof(p_stages) <> 'array' OR jsonb_array_length(p_stages) = 0 THEN
    RAISE EXCEPTION 'requisition_stages_required';
  END IF;

  INSERT INTO public.requisitions (
    user_id, form_type, department, project_name, purpose, site_location,
    amount, original_amount, amount_in_words, line_items, beneficiary_details, attachments,
    funding_category_id, funding_category_name, help_desk_ticket_id, requester_signature_path, status,
    exception_reason, converted_from_id
  )
  VALUES (
    (p_requisition->>'user_id')::uuid,
    p_requisition->>'form_type',
    p_requisition->>'department',
    nullif(btrim(p_requisition->>'project_name'), ''),
    nullif(btrim(p_requisition->>'purpose'), ''),
    nullif(btrim(p_requisition->>'site_location'), ''),
    (p_requisition->>'amount')::numeric,
    (p_requisition->>'amount')::numeric,
    p_requisition->>'amount_in_words',
    coalesce(p_requisition->'line_items', '[]'::jsonb),
    coalesce(p_requisition->'beneficiary_details', '[]'::jsonb),
    coalesce(p_requisition->'attachments', '[]'::jsonb),
    nullif(p_requisition->>'funding_category_id', '')::uuid,
    nullif(p_requisition->>'funding_category_name', ''),
    nullif(p_requisition->>'help_desk_ticket_id', '')::uuid,
    nullif(p_requisition->>'requester_signature_path', ''),
    'pending',
    nullif(btrim(p_requisition->>'exception_reason'), ''),
    nullif(p_requisition->>'converted_from_id', '')::uuid
  )
  RETURNING * INTO v_req;

  INSERT INTO public.requisition_stages (
    requisition_id, position, stage_code, role_key, role_label, assignee_id, state, state_note
  )
  SELECT
    v_req.id,
    (s->>'position')::smallint,
    s->>'stage_code',
    s->>'role_key',
    s->>'role_label',
    nullif(s->>'assignee_id', '')::uuid,
    coalesce(s->>'state', 'pending'),
    nullif(s->>'state_note', '')
  FROM jsonb_array_elements(p_stages) AS s;

  IF NOT EXISTS (
    SELECT 1 FROM public.requisition_stages
    WHERE requisition_id = v_req.id AND state = 'pending'
      AND (v_req.form_type <> 'payment_request' OR stage_code <> 'approved')
  ) THEN
    UPDATE public.requisitions SET status = 'awaiting_payment' WHERE id = v_req.id RETURNING * INTO v_req;
  END IF;

  RETURN v_req;
END;
$function$;
