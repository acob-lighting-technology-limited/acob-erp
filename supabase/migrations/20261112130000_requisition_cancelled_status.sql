-- A requisition switched to the other form type (before anyone signs) is cancelled
-- and replaced by a new one with a new number. Adds the 'cancelled' status.
-- NOT APPLIED: review, then apply to the live project only with explicit approval.

ALTER TABLE public.requisitions DROP CONSTRAINT IF EXISTS requisitions_status_check;

ALTER TABLE public.requisitions
  ADD CONSTRAINT requisitions_status_check CHECK (
    status = ANY (ARRAY[
      'pending'::text,
      'awaiting_payment'::text,
      'scheduled'::text,
      'partly_paid'::text,
      'awaiting_approval'::text,
      'paid'::text,
      'rejected'::text,
      'cancelled'::text
    ])
  );
