-- The requester signs the form when they submit it (Requested by), with their
-- approval PIN, like every other signer. The signature file used is stored on
-- the requisition at that moment, so changing a signature later never changes
-- a form that was already signed.
--
-- Requisitions raised before this have no stored signature (NULL) and keep
-- showing what they showed. Re-running changes nothing.

ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS requester_signature_path text;

COMMENT ON COLUMN public.requisitions.requester_signature_path IS
  'Path in the approval_signatures bucket of the signature the requester stamped at submission. NULL on requisitions raised before 2026-11.';

CREATE OR REPLACE FUNCTION public.requisition_create(p_requisition jsonb, p_stages jsonb)
RETURNS public.requisitions
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
    funding_category_id, funding_category_name, help_desk_ticket_id, requester_signature_path, status
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
    'pending'
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
    SELECT 1 FROM public.requisition_stages WHERE requisition_id = v_req.id AND state = 'pending'
  ) THEN
    UPDATE public.requisitions SET status = 'awaiting_payment' WHERE id = v_req.id RETURNING * INTO v_req;
  END IF;

  RETURN v_req;
END;
$function$;
