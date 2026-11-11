-- Payment Requests are paid in batches, the way Accounts actually works:
--
--   Reviewed → Authorized → Verified (Accounts lead)
--   → Accounts' payment officer puts verified requests on a PAYMENT SCHEDULE and
--     downloads the bank's bulk-upload file for the MD
--   → the MD pays at the bank
--   → the officer records, line by line, what was paid (bank receipt) and what was not
--   → the MD signs "Approved" on what was paid
--   → closed.
--
-- So for Payment Requests the MD's Approved stage now comes AFTER payment.
-- Petty Cash is unchanged (Authorized → Approved → paid by its officer).
--
-- New statuses on requisitions:
--   scheduled          on a payment schedule, waiting for the bank
--   awaiting_approval  paid in full, waiting for the MD's Approved signature
-- A line the bank did not pay goes back to the pool and the requisition is
-- tagged (unpaid_at / unpaid_note / unpaid_count) so the requester and signers
-- can follow it up.
--
-- PAYEE REGISTER: everyone ACOB pays, one row per bank account, each with a
-- stable code used as the bank file's Beneficiary Code. A staff member's code is
-- their employee number (matched on the salary account); anyone else gets
-- ACOB-V-0001, ACOB-V-0002…
--
-- Every table here is read and written only through the service-role API
-- routes; clients get no direct access. Safe to re-run.

-- ── Statuses and the unpaid tag ──────────────────────────────────────────────
ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_status_check;
ALTER TABLE public.requisitions ADD CONSTRAINT requisitions_status_check CHECK (
  status IN ('pending', 'awaiting_payment', 'scheduled', 'partly_paid', 'awaiting_approval', 'paid', 'rejected')
);

ALTER TABLE public.requisitions ADD COLUMN IF NOT EXISTS unpaid_at timestamptz;
ALTER TABLE public.requisitions ADD COLUMN IF NOT EXISTS unpaid_note text;
ALTER TABLE public.requisitions ADD COLUMN IF NOT EXISTS unpaid_count integer NOT NULL DEFAULT 0;

-- ── Settings (the account the bank debits) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.requisition_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.requisition_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.requisition_settings FROM anon, authenticated;
DROP POLICY IF EXISTS requisition_settings_no_client_access ON public.requisition_settings;
CREATE POLICY requisition_settings_no_client_access
  ON public.requisition_settings FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ACOB's Zenith account, as on the Accounts schedule. Changeable in Settings.
INSERT INTO public.requisition_settings (key, value)
VALUES ('bank_debit_account', '1015119549')
ON CONFLICT (key) DO NOTHING;

-- ── Payee register ───────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.requisition_payee_vendor_seq;
REVOKE ALL ON SEQUENCE public.requisition_payee_vendor_seq FROM anon, authenticated, PUBLIC;

CREATE TABLE IF NOT EXISTS public.requisition_payees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('staff', 'vendor')),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  account_name text NOT NULL CHECK (length(btrim(account_name)) > 0),
  account_number text NOT NULL CHECK (account_number ~ '^[0-9]{10}$'),
  bank_code text NOT NULL CHECK (bank_code ~ '^[0-9]{3,6}$'),
  bank_name text NOT NULL,
  rc_number text,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_number, bank_code),
  CHECK (length(code) <= 35 AND code !~ '[,;'' ]')
);
ALTER TABLE public.requisition_payees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.requisition_payees FROM anon, authenticated;
DROP POLICY IF EXISTS requisition_payees_no_client_access ON public.requisition_payees;
CREATE POLICY requisition_payees_no_client_access
  ON public.requisition_payees FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Find the payee for an account, adding them if new. Staff are recognised by
-- their salary account and keep their employee number as the code.
CREATE OR REPLACE FUNCTION public.requisition_payee_upsert(
  p_account_number text, p_bank_code text, p_bank_name text, p_account_name text, p_actor_id uuid
)
RETURNS public.requisition_payees
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_payee public.requisition_payees;
  v_profile uuid;
  v_employee_number text;
  v_code text;
BEGIN
  SELECT * INTO v_payee FROM public.requisition_payees
  WHERE account_number = p_account_number AND bank_code = p_bank_code;
  IF FOUND THEN RETURN v_payee; END IF;

  -- A staff member: first their salary account, else exactly one staff member
  -- whose every name appears in the account name the bank confirmed.
  SELECT p.id, nullif(btrim(p.employee_number), '') INTO v_profile, v_employee_number
  FROM public.employee_salaries s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE regexp_replace(coalesce(s.bank_account_number, ''), '\D', '', 'g') = p_account_number
  ORDER BY s.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_profile IS NULL THEN
    WITH account_words AS (
      SELECT array_agg(w) AS words
      FROM regexp_split_to_table(lower(p_account_name), '[^a-z]+') AS w
      WHERE length(w) > 1
    ),
    matches AS (
      SELECT p.id, nullif(btrim(p.employee_number), '') AS employee_number
      FROM public.profiles p, account_words a
      WHERE p.full_name IS NOT NULL
        AND (SELECT array_agg(w) FROM regexp_split_to_table(lower(p.full_name), '[^a-z]+') AS w WHERE length(w) > 1)
            <@ a.words
        AND array_length(
              (SELECT array_agg(w) FROM regexp_split_to_table(lower(p.full_name), '[^a-z]+') AS w WHERE length(w) > 1),
              1) >= 2
    )
    SELECT m.id, m.employee_number INTO v_profile, v_employee_number
    FROM matches m
    WHERE (SELECT count(*) FROM matches) = 1;
  END IF;

  v_code := regexp_replace(coalesce(v_employee_number, ''), '[,;'' ]', '', 'g');
  IF v_code = '' OR length(v_code) > 35
     OR EXISTS (SELECT 1 FROM public.requisition_payees WHERE code = v_code) THEN
    v_code := 'ACOB-V-' || lpad(nextval('public.requisition_payee_vendor_seq')::text, 4, '0');
  END IF;

  INSERT INTO public.requisition_payees (
    code, kind, profile_id, account_name, account_number, bank_code, bank_name, created_by
  )
  VALUES (
    v_code, CASE WHEN v_profile IS NULL THEN 'vendor' ELSE 'staff' END, v_profile,
    btrim(p_account_name), p_account_number, p_bank_code, btrim(p_bank_name), p_actor_id
  )
  ON CONFLICT (account_number, bank_code) DO NOTHING
  RETURNING * INTO v_payee;

  IF v_payee.id IS NULL THEN
    SELECT * INTO v_payee FROM public.requisition_payees
    WHERE account_number = p_account_number AND bank_code = p_bank_code;
  END IF;
  RETURN v_payee;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.requisition_payee_upsert(text, text, text, text, uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_payee_upsert(text, text, text, text, uuid) TO service_role;

-- ── Payment schedules ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.requisition_schedule_counters (
  year integer PRIMARY KEY,
  last_value integer NOT NULL
);
ALTER TABLE public.requisition_schedule_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.requisition_schedule_counters FROM anon, authenticated;
DROP POLICY IF EXISTS requisition_schedule_counters_no_client_access ON public.requisition_schedule_counters;
CREATE POLICY requisition_schedule_counters_no_client_access
  ON public.requisition_schedule_counters FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.requisition_payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'closed')),
  payment_date date NOT NULL,
  debit_account text NOT NULL CHECK (debit_account ~ '^[0-9]{10}$'),
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.requisition_payment_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.requisition_payment_schedules FROM anon, authenticated;
DROP POLICY IF EXISTS requisition_payment_schedules_no_client_access ON public.requisition_payment_schedules;
CREATE POLICY requisition_payment_schedules_no_client_access
  ON public.requisition_payment_schedules FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- One row per beneficiary line paid. Name, account and bank are copied in, so
-- the schedule reads the same later even if the payee register changes.
CREATE TABLE IF NOT EXISTS public.requisition_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.requisition_payment_schedules(id) ON DELETE CASCADE,
  requisition_id uuid NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  beneficiary_index smallint NOT NULL CHECK (beneficiary_index >= 0),
  payee_id uuid NOT NULL REFERENCES public.requisition_payees(id),
  amount numeric NOT NULL CHECK (amount > 0),
  transaction_ref text NOT NULL UNIQUE CHECK (length(transaction_ref) <= 30 AND transaction_ref !~ '[,;'' ]'),
  beneficiary_code text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'paid', 'unpaid')),
  outcome_note text,
  bank_reference text,
  receipt_path text,
  payment_id uuid REFERENCES public.requisition_payments(id) ON DELETE SET NULL,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- A line is on at most one live schedule, and once paid is never scheduled again.
CREATE UNIQUE INDEX IF NOT EXISTS requisition_schedule_items_live_line
  ON public.requisition_schedule_items (requisition_id, beneficiary_index) WHERE outcome <> 'unpaid';
CREATE INDEX IF NOT EXISTS requisition_schedule_items_schedule ON public.requisition_schedule_items (schedule_id);
ALTER TABLE public.requisition_schedule_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.requisition_schedule_items FROM anon, authenticated;
DROP POLICY IF EXISTS requisition_schedule_items_no_client_access ON public.requisition_schedule_items;
CREATE POLICY requisition_schedule_items_no_client_access
  ON public.requisition_schedule_items FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ── Where a Payment Request stands after money moves ────────────────────────
-- Worked out from its schedule lines and payments, so every path agrees.
CREATE OR REPLACE FUNCTION public.requisition_refresh_payment_status(p_requisition_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_req public.requisitions;
  v_status text;
  v_approval_pending boolean;
BEGIN
  SELECT * INTO v_req FROM public.requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND OR v_req.status IN ('pending', 'rejected', 'paid') THEN RETURN v_req.status; END IF;

  v_approval_pending := EXISTS (
    SELECT 1 FROM public.requisition_stages
    WHERE requisition_id = p_requisition_id AND stage_code = 'approved' AND state = 'pending'
  );

  IF v_req.amount_paid >= v_req.amount THEN
    v_status := CASE WHEN v_req.form_type = 'payment_request' AND v_approval_pending
                     THEN 'awaiting_approval' ELSE 'paid' END;
  ELSIF EXISTS (
    SELECT 1 FROM public.requisition_schedule_items
    WHERE requisition_id = p_requisition_id AND outcome = 'pending'
  ) THEN
    v_status := 'scheduled';
  ELSIF v_req.amount_paid > 0 THEN
    v_status := 'partly_paid';
  ELSE
    v_status := 'awaiting_payment';
  END IF;

  UPDATE public.requisitions
  SET status = v_status,
      unpaid_at = CASE WHEN v_status IN ('awaiting_approval', 'paid') THEN NULL ELSE unpaid_at END,
      unpaid_note = CASE WHEN v_status IN ('awaiting_approval', 'paid') THEN NULL ELSE unpaid_note END
  WHERE id = p_requisition_id;
  RETURN v_status;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.requisition_refresh_payment_status(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_refresh_payment_status(uuid) TO service_role;

-- Next schedule number: SCH/26/001.
CREATE OR REPLACE FUNCTION public.requisition_schedule_create(
  p_actor_id uuid, p_payment_date date, p_debit_account text, p_note text
)
RETURNS public.requisition_payment_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_year integer := extract(year FROM (now() AT TIME ZONE 'Africa/Lagos'))::integer;
  v_serial integer;
  v_row public.requisition_payment_schedules;
BEGIN
  IF NOT public.is_requisition_payment_officer(p_actor_id, 'payment_request') THEN
    RAISE EXCEPTION 'not_a_payment_processor';
  END IF;

  INSERT INTO public.requisition_schedule_counters (year, last_value) VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = public.requisition_schedule_counters.last_value + 1
  RETURNING last_value INTO v_serial;

  INSERT INTO public.requisition_payment_schedules (schedule_number, payment_date, debit_account, note, created_by)
  VALUES (
    'SCH/' || lpad((v_year % 100)::text, 2, '0') || '/' || lpad(v_serial::text, 3, '0'),
    p_payment_date, p_debit_account, nullif(btrim(coalesce(p_note, '')), ''), p_actor_id
  )
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.requisition_schedule_create(uuid, date, text, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_schedule_create(uuid, date, text, text) TO service_role;

-- Put one beneficiary line of a verified Payment Request on a draft schedule.
-- The transaction reference is the form number and line (PR/ICT/26/006/1); a
-- line that comes back unpaid and is scheduled again gets -2, -3…
CREATE OR REPLACE FUNCTION public.requisition_schedule_add_item(
  p_schedule_id uuid, p_actor_id uuid, p_requisition_id uuid, p_beneficiary_index integer,
  p_amount numeric, p_payee_id uuid
)
RETURNS public.requisition_schedule_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_schedule public.requisition_payment_schedules;
  v_req public.requisitions;
  v_payee public.requisition_payees;
  v_live numeric;
  v_attempts integer;
  v_ref text;
  v_item public.requisition_schedule_items;
BEGIN
  IF NOT public.is_requisition_payment_officer(p_actor_id, 'payment_request') THEN
    RAISE EXCEPTION 'not_a_payment_processor';
  END IF;

  SELECT * INTO v_schedule FROM public.requisition_payment_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'schedule_not_found'; END IF;
  IF v_schedule.status <> 'draft' THEN RAISE EXCEPTION 'schedule_not_draft'; END IF;

  SELECT * INTO v_req FROM public.requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'requisition_not_found'; END IF;
  IF v_req.form_type <> 'payment_request' THEN RAISE EXCEPTION 'schedule_payment_requests_only'; END IF;
  IF v_req.status NOT IN ('awaiting_payment', 'partly_paid', 'scheduled') THEN
    RAISE EXCEPTION 'requisition_not_payable';
  END IF;
  IF v_req.user_id = p_actor_id THEN RAISE EXCEPTION 'cannot_process_own_requisition'; END IF;
  IF p_beneficiary_index < 0 OR p_beneficiary_index >= jsonb_array_length(v_req.beneficiary_details) THEN
    RAISE EXCEPTION 'schedule_line_invalid';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'payment_amount_invalid'; END IF;

  SELECT coalesce(sum(amount), 0) INTO v_live FROM public.requisition_schedule_items
  WHERE requisition_id = p_requisition_id AND outcome = 'pending';
  IF v_req.amount_paid + v_live + p_amount > v_req.amount THEN
    RAISE EXCEPTION 'payment_exceeds_outstanding';
  END IF;

  SELECT * INTO v_payee FROM public.requisition_payees WHERE id = p_payee_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'payee_not_found'; END IF;

  SELECT count(*) INTO v_attempts FROM public.requisition_schedule_items
  WHERE requisition_id = p_requisition_id AND beneficiary_index = p_beneficiary_index;
  v_ref := v_req.requisition_number || '/' || (p_beneficiary_index + 1)::text
           || CASE WHEN v_attempts > 0 THEN '-' || (v_attempts + 1)::text ELSE '' END;

  INSERT INTO public.requisition_schedule_items (
    schedule_id, requisition_id, beneficiary_index, payee_id, amount, transaction_ref, beneficiary_code,
    account_name, account_number, bank_code, bank_name
  )
  VALUES (
    p_schedule_id, p_requisition_id, p_beneficiary_index, v_payee.id, p_amount, v_ref, v_payee.code,
    v_payee.account_name, v_payee.account_number, v_payee.bank_code, v_payee.bank_name
  )
  RETURNING * INTO v_item;

  UPDATE public.requisitions SET status = 'scheduled' WHERE id = p_requisition_id;
  UPDATE public.requisition_payment_schedules SET updated_at = now() WHERE id = p_schedule_id;
  RETURN v_item;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'schedule_line_already_scheduled';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.requisition_schedule_add_item(uuid, uuid, uuid, integer, numeric, uuid)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_schedule_add_item(uuid, uuid, uuid, integer, numeric, uuid) TO service_role;

-- Take a line off a draft schedule.
CREATE OR REPLACE FUNCTION public.requisition_schedule_remove_item(p_item_id uuid, p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_item public.requisition_schedule_items;
BEGIN
  IF NOT public.is_requisition_payment_officer(p_actor_id, 'payment_request') THEN
    RAISE EXCEPTION 'not_a_payment_processor';
  END IF;
  SELECT i.* INTO v_item FROM public.requisition_schedule_items i
  JOIN public.requisition_payment_schedules s ON s.id = i.schedule_id
  WHERE i.id = p_item_id AND s.status = 'draft'
  FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'schedule_not_draft'; END IF;

  DELETE FROM public.requisition_schedule_items WHERE id = p_item_id;
  PERFORM public.requisition_refresh_payment_status(v_item.requisition_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.requisition_schedule_remove_item(uuid, uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_schedule_remove_item(uuid, uuid) TO service_role;

-- Draft → Sent to MD.
CREATE OR REPLACE FUNCTION public.requisition_schedule_send(p_schedule_id uuid, p_actor_id uuid)
RETURNS public.requisition_payment_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row public.requisition_payment_schedules;
BEGIN
  IF NOT public.is_requisition_payment_officer(p_actor_id, 'payment_request') THEN
    RAISE EXCEPTION 'not_a_payment_processor';
  END IF;
  SELECT * INTO v_row FROM public.requisition_payment_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'schedule_not_found'; END IF;
  IF v_row.status <> 'draft' THEN RAISE EXCEPTION 'schedule_not_draft'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.requisition_schedule_items WHERE schedule_id = p_schedule_id) THEN
    RAISE EXCEPTION 'schedule_empty';
  END IF;

  UPDATE public.requisition_payment_schedules
  SET status = 'sent', sent_by = p_actor_id, sent_at = now(), updated_at = now()
  WHERE id = p_schedule_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.requisition_schedule_send(uuid, uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_schedule_send(uuid, uuid) TO service_role;

-- Record what the bank did with each line of a sent schedule. Paid lines become
-- payments (signed by the officer); unpaid lines go back to the pool and tag the
-- requisition. p_outcomes: [{ item_id, outcome: 'paid'|'unpaid', bank_reference?,
-- receipt_path?, note? }]. The schedule closes once every line has an outcome.
CREATE OR REPLACE FUNCTION public.requisition_schedule_record_outcomes(
  p_schedule_id uuid, p_actor_id uuid, p_paid_on date, p_outcomes jsonb, p_signature_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_schedule public.requisition_payment_schedules;
  v_entry jsonb;
  v_item public.requisition_schedule_items;
  v_outcome text;
  v_payment_id uuid;
  v_touched uuid[] := '{}';
  v_req_id uuid;
  v_paid integer := 0;
  v_unpaid integer := 0;
BEGIN
  IF NOT public.is_requisition_payment_officer(p_actor_id, 'payment_request') THEN
    RAISE EXCEPTION 'not_a_payment_processor';
  END IF;
  IF jsonb_typeof(p_outcomes) <> 'array' OR jsonb_array_length(p_outcomes) = 0 THEN
    RAISE EXCEPTION 'schedule_outcomes_required';
  END IF;

  SELECT * INTO v_schedule FROM public.requisition_payment_schedules WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'schedule_not_found'; END IF;
  IF v_schedule.status <> 'sent' THEN RAISE EXCEPTION 'schedule_not_sent'; END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_outcomes) LOOP
    v_outcome := v_entry->>'outcome';
    IF v_outcome NOT IN ('paid', 'unpaid') THEN RAISE EXCEPTION 'schedule_outcome_invalid'; END IF;

    SELECT * INTO v_item FROM public.requisition_schedule_items
    WHERE id = (v_entry->>'item_id')::uuid AND schedule_id = p_schedule_id AND outcome = 'pending'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'schedule_line_not_pending'; END IF;

    IF EXISTS (SELECT 1 FROM public.requisitions WHERE id = v_item.requisition_id AND user_id = p_actor_id) THEN
      RAISE EXCEPTION 'cannot_process_own_requisition';
    END IF;

    v_payment_id := NULL;
    IF v_outcome = 'paid' THEN
      INSERT INTO public.requisition_payments (
        requisition_id, amount, paid_on, method, reference, receipt_path, note, recorded_by, signature_path
      )
      VALUES (
        v_item.requisition_id, v_item.amount, p_paid_on, 'transfer',
        coalesce(nullif(btrim(coalesce(v_entry->>'bank_reference', '')), ''), v_item.transaction_ref),
        nullif(v_entry->>'receipt_path', ''),
        concat_ws(' · ', 'Schedule ' || v_schedule.schedule_number || ', line to ' || v_item.account_name,
                  nullif(btrim(coalesce(v_entry->>'note', '')), '')),
        p_actor_id, p_signature_path
      )
      RETURNING id INTO v_payment_id;

      UPDATE public.requisitions SET amount_paid = amount_paid + v_item.amount WHERE id = v_item.requisition_id;
      v_paid := v_paid + 1;
    ELSE
      UPDATE public.requisitions
      SET unpaid_at = now(),
          unpaid_note = coalesce(nullif(btrim(coalesce(v_entry->>'note', '')), ''),
                                 'Not paid on schedule ' || v_schedule.schedule_number),
          unpaid_count = unpaid_count + 1
      WHERE id = v_item.requisition_id;
      v_unpaid := v_unpaid + 1;
    END IF;

    UPDATE public.requisition_schedule_items
    SET outcome = v_outcome,
        outcome_note = nullif(btrim(coalesce(v_entry->>'note', '')), ''),
        bank_reference = nullif(btrim(coalesce(v_entry->>'bank_reference', '')), ''),
        receipt_path = nullif(v_entry->>'receipt_path', ''),
        payment_id = v_payment_id,
        recorded_by = p_actor_id,
        recorded_at = now()
    WHERE id = v_item.id;

    IF NOT v_item.requisition_id = ANY (v_touched) THEN
      v_touched := v_touched || v_item.requisition_id;
    END IF;
  END LOOP;

  FOREACH v_req_id IN ARRAY v_touched LOOP
    PERFORM public.requisition_refresh_payment_status(v_req_id);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.requisition_schedule_items WHERE schedule_id = p_schedule_id AND outcome = 'pending'
  ) THEN
    UPDATE public.requisition_payment_schedules SET status = 'closed', closed_at = now(), updated_at = now()
    WHERE id = p_schedule_id;
  ELSE
    UPDATE public.requisition_payment_schedules SET updated_at = now() WHERE id = p_schedule_id;
  END IF;

  RETURN jsonb_build_object('paid', v_paid, 'unpaid', v_unpaid, 'requisition_ids', to_jsonb(v_touched));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.requisition_schedule_record_outcomes(uuid, uuid, date, jsonb, text)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_schedule_record_outcomes(uuid, uuid, date, jsonb, text) TO service_role;

-- ── Signing: for Payment Requests the MD's Approved stage waits for payment ──
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

  -- Payment is due once everything before payment is done: every stage for
  -- Petty Cash, every stage but the MD's Approved for a Payment Request.
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

CREATE OR REPLACE FUNCTION public.requisition_sign(
  p_requisition_id uuid, p_actor_id uuid, p_comments text, p_signature_path text, p_amount_change jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req public.requisitions;
  v_stage public.requisition_stages;
  v_bypassed uuid[];
  v_new_amount numeric;
  v_new_lines jsonb;
  v_new_beneficiaries jsonb;
  v_reason text;
  v_status text;
  v_post_payment boolean;
BEGIN
  SELECT * INTO v_req FROM public.requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'requisition_not_found'; END IF;
  IF v_req.status NOT IN ('pending', 'awaiting_approval') THEN RAISE EXCEPTION 'requisition_not_pending'; END IF;
  IF v_req.user_id = p_actor_id THEN RAISE EXCEPTION 'cannot_sign_own_requisition'; END IF;
  v_post_payment := v_req.status = 'awaiting_approval';

  -- While in approval a Payment Request's Approved stage is not signable; once
  -- paid, only that stage is.
  SELECT * INTO v_stage
  FROM public.requisition_stages
  WHERE requisition_id = p_requisition_id AND state = 'pending' AND assignee_id = p_actor_id
    AND (
      v_req.form_type <> 'payment_request'
      OR (NOT v_post_payment AND stage_code <> 'approved')
      OR (v_post_payment AND stage_code = 'approved')
    )
  ORDER BY position
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_pending_signer'; END IF;

  IF p_amount_change IS NOT NULL THEN
    IF v_post_payment THEN RAISE EXCEPTION 'amount_locked_after_payment'; END IF;
    v_reason := btrim(coalesce(p_amount_change->>'reason', ''));
    v_new_amount := (p_amount_change->>'amount')::numeric;
    v_new_lines := coalesce(p_amount_change->'line_items', v_req.line_items);
    v_new_beneficiaries := coalesce(p_amount_change->'beneficiary_details', v_req.beneficiary_details);

    IF v_reason = '' THEN RAISE EXCEPTION 'amount_change_reason_required'; END IF;
    IF v_new_amount IS NULL OR v_new_amount <= 0 THEN RAISE EXCEPTION 'amount_change_invalid'; END IF;
    IF v_new_amount = v_req.amount THEN RAISE EXCEPTION 'amount_change_unchanged'; END IF;
    IF v_req.form_type = 'petty_cash' AND v_new_amount > 50000 THEN
      RAISE EXCEPTION 'petty_cash_limit_exceeded';
    END IF;

    INSERT INTO public.requisition_amount_changes (
      requisition_id, stage_id, changed_by, old_amount, new_amount,
      old_line_items, new_line_items, old_beneficiaries, new_beneficiaries, reason
    )
    VALUES (
      p_requisition_id, v_stage.id, p_actor_id, v_req.amount, v_new_amount,
      v_req.line_items, v_new_lines, v_req.beneficiary_details, v_new_beneficiaries, v_reason
    );

    UPDATE public.requisitions
    SET amount = v_new_amount,
        amount_in_words = coalesce(p_amount_change->>'amount_in_words', amount_in_words),
        line_items = v_new_lines,
        beneficiary_details = v_new_beneficiaries
    WHERE id = p_requisition_id;
  END IF;

  WITH bypassed AS (
    UPDATE public.requisition_stages
    SET state = 'bypassed', acted_by = p_actor_id, acted_at = now()
    WHERE requisition_id = p_requisition_id AND state = 'pending' AND position < v_stage.position
    RETURNING id
  )
  SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO v_bypassed FROM bypassed;

  UPDATE public.requisition_stages
  SET state = 'signed', acted_by = p_actor_id, acted_at = now(),
      comments = nullif(btrim(coalesce(p_comments, '')), ''),
      signature_path = p_signature_path
  WHERE id = v_stage.id;

  IF v_post_payment THEN
    v_status := 'paid';
  ELSIF EXISTS (
    SELECT 1 FROM public.requisition_stages
    WHERE requisition_id = p_requisition_id AND state = 'pending'
      AND (v_req.form_type <> 'payment_request' OR stage_code <> 'approved')
  ) THEN
    v_status := 'pending';
  ELSE
    v_status := 'awaiting_payment';
  END IF;
  IF v_status <> 'pending' THEN
    UPDATE public.requisitions SET status = v_status WHERE id = p_requisition_id;
  END IF;

  RETURN jsonb_build_object(
    'stage_id', v_stage.id,
    'stage_code', v_stage.stage_code,
    'bypassed_stage_ids', to_jsonb(v_bypassed),
    'status', v_status,
    'amount_changed', p_amount_change IS NOT NULL
  );
END;
$function$;

-- Rejecting stays an in-approval action; for a Payment Request the MD's
-- Approved stage comes after the money has gone, so it cannot reject.
CREATE OR REPLACE FUNCTION public.requisition_reject(p_requisition_id uuid, p_actor_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_req public.requisitions;
  v_stage public.requisition_stages;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF v_reason = '' THEN RAISE EXCEPTION 'rejection_reason_required'; END IF;

  SELECT * INTO v_req FROM public.requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'requisition_not_found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'requisition_not_pending'; END IF;
  IF v_req.user_id = p_actor_id THEN RAISE EXCEPTION 'cannot_sign_own_requisition'; END IF;

  SELECT * INTO v_stage
  FROM public.requisition_stages
  WHERE requisition_id = p_requisition_id AND state = 'pending' AND assignee_id = p_actor_id
    AND (v_req.form_type <> 'payment_request' OR stage_code <> 'approved')
  ORDER BY position
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_pending_signer'; END IF;

  UPDATE public.requisition_stages
  SET state = 'rejected', acted_by = p_actor_id, acted_at = now(), comments = v_reason
  WHERE id = v_stage.id;

  UPDATE public.requisitions
  SET status = 'rejected', rejection_reason = v_reason, rejected_by = p_actor_id, rejected_at = now()
  WHERE id = p_requisition_id;

  RETURN jsonb_build_object('stage_id', v_stage.id, 'stage_code', v_stage.stage_code, 'status', 'rejected');
END;
$function$;

-- Payment Requests are paid through schedules only; one-off recording stays for Petty Cash.
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
  IF v_req.form_type = 'payment_request' THEN RAISE EXCEPTION 'schedule_payment_requests_only'; END IF;
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

-- ── Requisitions already waiting on the MD move to the payment pool ──────────
-- Every Payment Request whose only open stage is the MD's Approved is now
-- "awaiting payment": the MD signs it after it is paid.
UPDATE public.requisitions r
SET status = 'awaiting_payment'
WHERE r.form_type = 'payment_request'
  AND r.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.requisition_stages s
    WHERE s.requisition_id = r.id AND s.state = 'pending' AND s.stage_code <> 'approved'
  );
