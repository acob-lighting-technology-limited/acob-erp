-- Keep the production constraint aligned with MAX_BENEFICIARIES. Four is the
-- normal inline workflow; bulk requests can use the attached bank spreadsheet.
ALTER TABLE public.requisitions
  DROP CONSTRAINT IF EXISTS requisitions_beneficiary_count;

ALTER TABLE public.requisitions
  ADD CONSTRAINT requisitions_beneficiary_count
    CHECK (
      jsonb_array_length(beneficiary_details) >= 1
      AND jsonb_array_length(beneficiary_details) <= 100
    );
