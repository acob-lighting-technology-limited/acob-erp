-- Track payment reminder delivery so due/overdue emails are sent once per cycle.

ALTER TABLE public.department_payments
ADD COLUMN IF NOT EXISTS due_notified_at timestamptz;

ALTER TABLE public.department_payments
ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;

COMMENT ON COLUMN public.department_payments.due_notified_at IS
'Timestamp of last due-date reminder email sent to payment creator.';

COMMENT ON COLUMN public.department_payments.overdue_notified_at IS
'Timestamp of last overdue reminder email sent to payment creator.';
