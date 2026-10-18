-- Requisitions rebuild: Payment Request + Petty Cash, per-requester approval
-- routes, bypass, amount changes, payments, and approval signing credentials.
-- Plan: docs/REQUISITIONS_PETTY_CASH_PLAN.md
--
-- The live requisitions table was empty when this was written (2026-10-13), so
-- the old fixed-stage columns are dropped instead of migrated. The guard below
-- refuses to run if that is no longer true.
--
-- Also closes the live holes in the old design: every employee could read and
-- UPDATE every requisition (USING (true)), and the document bucket was public.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.requisitions) THEN
    RAISE EXCEPTION 'requisitions is not empty; this migration drops the old stage columns and needs a data migration first';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- requisitions: drop the fixed four-stage columns and the emergency route
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_emergency_justification_required;
DROP INDEX IF EXISTS public.idx_requisitions_is_emergency;
DROP INDEX IF EXISTS public.idx_requisitions_stage;

ALTER TABLE public.requisitions
  DROP COLUMN IF EXISTS current_stage_code,
  DROP COLUMN IF EXISTS reviewed_by,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS reviewed_comments,
  DROP COLUMN IF EXISTS authorized_by,
  DROP COLUMN IF EXISTS authorized_at,
  DROP COLUMN IF EXISTS authorized_comments,
  DROP COLUMN IF EXISTS verified_by,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS verified_comments,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS approved_comments,
  DROP COLUMN IF EXISTS is_emergency,
  DROP COLUMN IF EXISTS emergency_justification,
  DROP COLUMN IF EXISTS bypassed_stages;

-- ─────────────────────────────────────────────────────────────────────────────
-- requisitions: the two forms
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.requisitions
  ADD COLUMN form_type text NOT NULL DEFAULT 'payment_request',
  ADD COLUMN site_location text,
  ADD COLUMN line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- What the requester asked for. `amount` is the current figure after any
  -- signer's change; this never moves.
  ADD COLUMN original_amount numeric(12, 2) NOT NULL,
  ADD COLUMN amount_paid numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN help_desk_ticket_id uuid REFERENCES public.help_desk_tickets(id) ON DELETE SET NULL;

ALTER TABLE public.requisitions
  ALTER COLUMN project_name DROP NOT NULL,
  ALTER COLUMN purpose DROP NOT NULL,
  ALTER COLUMN requisition_number DROP DEFAULT;

DROP SEQUENCE IF EXISTS public.requisition_number_seq;

ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_status_check;

-- Sum of the `amount` field across petty-cash line items.
CREATE OR REPLACE FUNCTION public.requisition_line_items_total(p_items jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(sum((item->>'amount')::numeric), 0)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END) AS item
$$;

REVOKE EXECUTE ON FUNCTION public.requisition_line_items_total(jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_line_items_total(jsonb) TO authenticated, service_role;

ALTER TABLE public.requisitions
  ADD CONSTRAINT requisitions_status_check
    CHECK (status IN ('pending', 'awaiting_payment', 'partly_paid', 'paid', 'rejected')),
  ADD CONSTRAINT requisitions_form_type_check
    CHECK (form_type IN ('payment_request', 'petty_cash')),
  ADD CONSTRAINT requisitions_line_items_array
    CHECK (jsonb_typeof(line_items) = 'array'),
  ADD CONSTRAINT requisitions_beneficiaries_array
    CHECK (jsonb_typeof(beneficiary_details) = 'array'),
  ADD CONSTRAINT requisitions_payment_request_fields
    CHECK (
      form_type <> 'payment_request'
      OR (length(btrim(coalesce(project_name, ''))) > 0 AND length(btrim(coalesce(purpose, ''))) > 0)
    ),
  -- A Payment Request must be raised at ₦30,000 or more. A signer may later
  -- reduce it, so the floor applies to what was asked for.
  ADD CONSTRAINT requisitions_payment_request_floor
    CHECK (form_type <> 'payment_request' OR original_amount >= 30000),
  -- Petty cash never exceeds ₦50,000, before or after a change.
  ADD CONSTRAINT requisitions_petty_cash_cap
    CHECK (form_type <> 'petty_cash' OR (amount <= 50000 AND original_amount <= 50000)),
  ADD CONSTRAINT requisitions_petty_cash_lines
    CHECK (
      form_type <> 'petty_cash'
      OR (jsonb_array_length(line_items) >= 1 AND public.requisition_line_items_total(line_items) = amount)
    ),
  ADD CONSTRAINT requisitions_beneficiary_count
    CHECK (
      jsonb_array_length(beneficiary_details) >= 1
      AND jsonb_array_length(beneficiary_details) <= CASE WHEN form_type = 'petty_cash' THEN 2 ELSE 4 END
    ),
  ADD CONSTRAINT requisitions_amount_paid_range
    CHECK (amount_paid >= 0 AND amount_paid <= amount);

CREATE INDEX IF NOT EXISTS idx_requisitions_form_type ON public.requisitions (form_type);
CREATE INDEX IF NOT EXISTS idx_requisitions_help_desk_ticket
  ON public.requisitions (help_desk_ticket_id) WHERE help_desk_ticket_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reference numbers: REQ-2026-0001 / PCV-2026-0001, restarting each January
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.requisition_number_counters (
  form_type text NOT NULL CHECK (form_type IN ('payment_request', 'petty_cash')),
  year integer NOT NULL,
  last_value integer NOT NULL,
  PRIMARY KEY (form_type, year)
);

ALTER TABLE public.requisition_number_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.requisition_number_counters FROM anon, authenticated;
CREATE POLICY requisition_number_counters_no_client_access
  ON public.requisition_number_counters FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.assign_requisition_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Nigerian year, so a request raised late on 31 December belongs to that year.
  v_year integer := extract(year FROM (now() AT TIME ZONE 'Africa/Lagos'))::integer;
  v_next integer;
BEGIN
  -- The upsert takes a row lock, so two simultaneous submissions get
  -- consecutive numbers rather than the same one.
  INSERT INTO public.requisition_number_counters (form_type, year, last_value)
  VALUES (NEW.form_type, v_year, 1)
  ON CONFLICT (form_type, year)
  DO UPDATE SET last_value = public.requisition_number_counters.last_value + 1
  RETURNING last_value INTO v_next;

  NEW.requisition_number :=
    CASE NEW.form_type WHEN 'petty_cash' THEN 'PCV' ELSE 'REQ' END
    || '-' || v_year::text
    || '-' || lpad(v_next::text, greatest(4, length(v_next::text)), '0');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_requisition_number() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER trg_requisitions_assign_number
  BEFORE INSERT ON public.requisitions
  FOR EACH ROW EXECUTE FUNCTION public.assign_requisition_number();

-- Who raised it, which form, its reference and the original ask never change.
CREATE OR REPLACE FUNCTION public.guard_requisition_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.form_type IS DISTINCT FROM OLD.form_type
     OR NEW.requisition_number IS DISTINCT FROM OLD.requisition_number
     OR NEW.original_amount IS DISTINCT FROM OLD.original_amount THEN
    RAISE EXCEPTION 'requisition reference fields cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_requisition_immutable_fields() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER trg_requisitions_guard_immutable
  BEFORE UPDATE ON public.requisitions
  FOR EACH ROW EXECUTE FUNCTION public.guard_requisition_immutable_fields();

-- ─────────────────────────────────────────────────────────────────────────────
-- Approval stages: resolved per requester at submission
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.requisition_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  stage_code text NOT NULL CHECK (stage_code IN ('reviewed', 'authorized', 'verified', 'approved')),
  -- Which role this stage was routed to: hr_lead, hcs, accounts_lead, md, department_lead.
  role_key text NOT NULL,
  role_label text NOT NULL,
  -- Resolved at submission so the record shows who it waited on. Admins can
  -- reassign a pending stage. NULL when the role had no lead at the time.
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'signed', 'bypassed', 'not_required', 'rejected')),
  -- Why a stage is not required, or which rule moved it (e.g. own request).
  state_note text,
  -- Signer, rejecter, or the later signer whose signature bypassed this stage.
  acted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acted_at timestamptz,
  comments text,
  -- The signer's signature file at the moment of signing (files are never overwritten).
  signature_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requisition_id, position)
);

CREATE INDEX idx_requisition_stages_requisition ON public.requisition_stages (requisition_id);
CREATE INDEX idx_requisition_stages_pending_assignee
  ON public.requisition_stages (assignee_id) WHERE state = 'pending';

CREATE TRIGGER trg_requisition_stages_updated_at
  BEFORE UPDATE ON public.requisition_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_requisitions_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Amount changes made by signers (reason compulsory)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.requisition_amount_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.requisition_stages(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_amount numeric(12, 2) NOT NULL,
  new_amount numeric(12, 2) NOT NULL CHECK (new_amount > 0),
  old_line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  new_line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  old_beneficiaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  new_beneficiaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_requisition_amount_changes_requisition ON public.requisition_amount_changes (requisition_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Payments (Processed By). Several may add up to the approved amount.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.requisition_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL,
  method text NOT NULL CHECK (method IN ('transfer', 'cash')),
  reference text,
  receipt_path text,
  note text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  signature_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_requisition_payments_requisition ON public.requisition_payments (requisition_id);

-- Staff allowed to record payments. The Accounts lead is always allowed too.
CREATE TABLE public.requisition_payment_processors (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Signing credentials: signature image + approval PIN
-- ─────────────────────────────────────────────────────────────────────────────

-- Server-only. The PIN is stored as a salted scrypt hash; no client role can
-- read any of this table, so an admin cannot read or set someone else's PIN.
CREATE TABLE public.approval_signing_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  signature_path text,
  signature_updated_at timestamptz,
  pin_hash text,
  pin_set_at timestamptz,
  failed_pin_attempts smallint NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_approval_signing_credentials_updated_at
  BEFORE UPDATE ON public.approval_signing_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_requisitions_updated_at();

-- Forgot-PIN codes, emailed to the user. Hashed, single use, short expiry.
CREATE TABLE public.approval_pin_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_pin_reset_codes_user ON public.approval_pin_reset_codes (user_id, created_at DESC);

-- Records one PIN check atomically, so parallel wrong guesses cannot slip past
-- the lockout. Reaching the limit locks the PIN and restarts the count.
CREATE OR REPLACE FUNCTION public.approval_pin_record_attempt(
  p_user_id uuid,
  p_success boolean,
  p_max_attempts integer,
  p_lock_minutes integer
)
RETURNS TABLE (failed_pin_attempts smallint, pin_locked_until timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.approval_signing_credentials c
  SET failed_pin_attempts = CASE
        WHEN p_success OR c.failed_pin_attempts + 1 >= p_max_attempts THEN 0
        ELSE c.failed_pin_attempts + 1
      END,
      pin_locked_until = CASE
        WHEN p_success THEN NULL
        WHEN c.failed_pin_attempts + 1 >= p_max_attempts THEN now() + make_interval(mins => p_lock_minutes)
        ELSE c.pin_locked_until
      END
  WHERE c.user_id = p_user_id
  RETURNING c.failed_pin_attempts, c.pin_locked_until
$$;

REVOKE EXECUTE ON FUNCTION public.approval_pin_record_attempt(uuid, boolean, integer, integer)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.approval_pin_record_attempt(uuid, boolean, integer, integer) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Access helpers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_requisition_payment_processor(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.requisition_payment_processors WHERE profile_id = p_user_id)
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_user_id
          AND p.is_department_lead
          AND (p.department = 'Accounts' OR 'Accounts' = ANY (coalesce(p.lead_departments, '{}'::text[])))
      )
$$;

REVOKE EXECUTE ON FUNCTION public.is_requisition_payment_processor(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_requisition_payment_processor(uuid) TO authenticated, service_role;

-- SECURITY DEFINER so the requisitions and stages policies can both use it
-- without recursing into each other.
CREATE OR REPLACE FUNCTION public.can_view_requisition(p_requisition_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.requisitions r
      WHERE r.id = p_requisition_id
        AND (r.user_id = auth.uid() OR public.is_lead_for_department(r.department))
    )
    OR EXISTS (
      SELECT 1 FROM public.requisition_stages s
      WHERE s.requisition_id = p_requisition_id AND (s.assignee_id = auth.uid() OR s.acted_by = auth.uid())
    )
    OR public.is_requisition_payment_processor(auth.uid())
    OR public.is_admin_like()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_requisition(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_requisition(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS. All writes go through API routes with the service-role client; the
-- client roles only ever read, and only what they are party to.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS users_select_requisitions ON public.requisitions;
DROP POLICY IF EXISTS users_update_requisitions ON public.requisitions;
DROP POLICY IF EXISTS users_insert_own_requisitions ON public.requisitions;

CREATE POLICY requisitions_select_party
  ON public.requisitions FOR SELECT TO authenticated
  USING (public.can_view_requisition(id));

ALTER TABLE public.requisition_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY requisition_stages_select_party
  ON public.requisition_stages FOR SELECT TO authenticated
  USING (public.can_view_requisition(requisition_id));

ALTER TABLE public.requisition_amount_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY requisition_amount_changes_select_party
  ON public.requisition_amount_changes FOR SELECT TO authenticated
  USING (public.can_view_requisition(requisition_id));

ALTER TABLE public.requisition_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY requisition_payments_select_party
  ON public.requisition_payments FOR SELECT TO authenticated
  USING (public.can_view_requisition(requisition_id));

ALTER TABLE public.requisition_payment_processors ENABLE ROW LEVEL SECURITY;
CREATE POLICY requisition_payment_processors_select_signed_in
  ON public.requisition_payment_processors FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

ALTER TABLE public.approval_signing_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_signing_credentials_no_client_access
  ON public.approval_signing_credentials FOR ALL TO authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.approval_pin_reset_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_pin_reset_codes_no_client_access
  ON public.approval_pin_reset_codes FOR ALL TO authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON public.requisitions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.requisitions FROM authenticated;
REVOKE ALL ON public.requisition_stages, public.requisition_amount_changes, public.requisition_payments,
  public.requisition_payment_processors FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.requisition_stages, public.requisition_amount_changes,
  public.requisition_payments, public.requisition_payment_processors FROM authenticated;
REVOKE ALL ON public.approval_signing_credentials, public.approval_pin_reset_codes FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Workflow RPCs. Service role only: the API route authenticates the actor,
-- checks their PIN, then calls these, which lock the row and apply the rules
-- in one transaction so two signers cannot race.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.requisition_create(p_requisition jsonb, p_stages jsonb)
RETURNS public.requisitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req public.requisitions;
BEGIN
  IF jsonb_typeof(p_stages) <> 'array' OR jsonb_array_length(p_stages) = 0 THEN
    RAISE EXCEPTION 'requisition_stages_required';
  END IF;

  INSERT INTO public.requisitions (
    user_id, form_type, department, project_name, purpose, site_location,
    amount, original_amount, amount_in_words, line_items, beneficiary_details, attachments,
    funding_category_id, funding_category_name, help_desk_ticket_id, status
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
$$;

CREATE OR REPLACE FUNCTION public.requisition_sign(
  p_requisition_id uuid,
  p_actor_id uuid,
  p_comments text,
  p_signature_path text,
  p_amount_change jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req public.requisitions;
  v_stage public.requisition_stages;
  v_bypassed uuid[];
  v_new_amount numeric;
  v_new_lines jsonb;
  v_new_beneficiaries jsonb;
  v_reason text;
  v_status text;
BEGIN
  SELECT * INTO v_req FROM public.requisitions WHERE id = p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'requisition_not_found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'requisition_not_pending'; END IF;
  IF v_req.user_id = p_actor_id THEN RAISE EXCEPTION 'cannot_sign_own_requisition'; END IF;

  -- The earliest pending stage this person holds. Anything still pending
  -- before it is bypassed by this signature.
  SELECT * INTO v_stage
  FROM public.requisition_stages
  WHERE requisition_id = p_requisition_id AND state = 'pending' AND assignee_id = p_actor_id
  ORDER BY position
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_a_pending_signer'; END IF;

  IF p_amount_change IS NOT NULL THEN
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

  IF EXISTS (SELECT 1 FROM public.requisition_stages WHERE requisition_id = p_requisition_id AND state = 'pending') THEN
    v_status := 'pending';
  ELSE
    v_status := 'awaiting_payment';
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
$$;

CREATE OR REPLACE FUNCTION public.requisition_reject(p_requisition_id uuid, p_actor_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.requisition_record_payment(
  p_requisition_id uuid,
  p_actor_id uuid,
  p_amount numeric,
  p_paid_on date,
  p_method text,
  p_reference text,
  p_receipt_path text,
  p_note text,
  p_signature_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  IF NOT public.is_requisition_payment_processor(p_actor_id) THEN RAISE EXCEPTION 'not_a_payment_processor'; END IF;
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
$$;

REVOKE EXECUTE ON FUNCTION public.requisition_create(jsonb, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.requisition_sign(uuid, uuid, text, text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.requisition_reject(uuid, uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.requisition_record_payment(uuid, uuid, numeric, date, text, text, text, text, text)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.requisition_create(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.requisition_sign(uuid, uuid, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.requisition_reject(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.requisition_record_payment(uuid, uuid, numeric, date, text, text, text, text, text)
  TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage
-- ─────────────────────────────────────────────────────────────────────────────

-- Financial documents: private. Read through short-lived signed URLs issued by
-- the API to people who can view the requisition. Uploads only into the
-- uploader's own folder.
UPDATE storage.buckets SET public = false WHERE id = 'requisition_documents';

DROP POLICY IF EXISTS "Users can view requisition documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload requisition documents" ON storage.objects;

CREATE POLICY "Users upload requisition documents to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'requisition_documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Signature images: private, written and read only by the API.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('approval_signatures', 'approval_signatures', false, 1048576, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
