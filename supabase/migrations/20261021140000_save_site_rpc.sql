-- ─────────────────────────────────────────────────────────────
-- save_site: write a site and its conveyance documents in one transaction
--
-- POST and PATCH /api/sites used to write the sites row and then each
-- document as separate requests. A failure partway left the site changed
-- and its documents half-synced. A function body runs in one transaction,
-- so any failure here (a CHECK, the unique name index, a dropped connection)
-- rolls back the site and every document write together.
--
-- p_site_id NULL creates the site; otherwise that site is updated (P0002 if
-- it does not exist). The documents become exactly p_documents: rows with an
-- id belonging to this site are updated, everything else is inserted, and
-- the site's other documents are deleted. An id from another site is treated
-- as new, never as a way to edit someone else's paperwork.
--
-- Input is validated by zod in the API route; the table constraints are the
-- backstop. Called only by the API with the service-role client, which also
-- supplies p_actor from the authenticated session.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_site(
  p_site_id   uuid,
  p_site      jsonb,
  p_documents jsonb,
  p_actor     uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_site_id uuid := p_site_id;
  v_now     timestamptz := now();
  v_doc     jsonb;
  v_doc_id  uuid;
  v_kept    uuid[] := '{}';
BEGIN
  IF jsonb_typeof(p_documents) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_documents must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF v_site_id IS NULL THEN
    INSERT INTO public.sites (name, lga, state, date_signed, portfolio_id, project_id, notes, created_by, updated_by)
    VALUES (
      p_site->>'name',
      p_site->>'lga',
      p_site->>'state',
      (p_site->>'date_signed')::date,
      (p_site->>'portfolio_id')::uuid,
      (p_site->>'project_id')::uuid,
      p_site->>'notes',
      p_actor,
      p_actor
    )
    RETURNING id INTO v_site_id;
  ELSE
    UPDATE public.sites SET
      name         = p_site->>'name',
      lga          = p_site->>'lga',
      state        = p_site->>'state',
      date_signed  = (p_site->>'date_signed')::date,
      portfolio_id = (p_site->>'portfolio_id')::uuid,
      project_id   = (p_site->>'project_id')::uuid,
      notes        = p_site->>'notes',
      updated_by   = p_actor,
      updated_at   = v_now
    WHERE id = v_site_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Site % not found', v_site_id USING ERRCODE = 'P0002';
    END IF;
  END IF;

  FOR v_doc IN SELECT * FROM jsonb_array_elements(p_documents) LOOP
    v_doc_id := NULL;
    IF v_doc->>'id' IS NOT NULL THEN
      UPDATE public.site_documents SET
        document_type = v_doc->>'document_type',
        label         = v_doc->>'label',
        status        = v_doc->>'status',
        reference     = v_doc->>'reference',
        issued_on     = (v_doc->>'issued_on')::date,
        expires_on    = (v_doc->>'expires_on')::date,
        notes         = v_doc->>'notes',
        updated_by    = p_actor,
        updated_at    = v_now
      WHERE id = (v_doc->>'id')::uuid AND site_id = v_site_id
      RETURNING id INTO v_doc_id;
    END IF;

    IF v_doc_id IS NULL THEN
      INSERT INTO public.site_documents
        (site_id, document_type, label, status, reference, issued_on, expires_on, notes, created_by, updated_by)
      VALUES (
        v_site_id,
        v_doc->>'document_type',
        v_doc->>'label',
        v_doc->>'status',
        v_doc->>'reference',
        (v_doc->>'issued_on')::date,
        (v_doc->>'expires_on')::date,
        v_doc->>'notes',
        p_actor,
        p_actor
      )
      RETURNING id INTO v_doc_id;
    END IF;

    v_kept := v_kept || v_doc_id;
  END LOOP;

  DELETE FROM public.site_documents
  WHERE site_id = v_site_id AND NOT (id = ANY (v_kept));

  RETURN v_site_id;
END;
$$;

COMMENT ON FUNCTION public.save_site(uuid, jsonb, jsonb, uuid) IS
  'Atomically create/update a site and replace its conveyance documents. service_role only; called by /api/sites.';

-- The API is the only caller. p_actor is trusted input, so nobody else may run it.
REVOKE EXECUTE ON FUNCTION public.save_site(uuid, jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_site(uuid, jsonb, jsonb, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
