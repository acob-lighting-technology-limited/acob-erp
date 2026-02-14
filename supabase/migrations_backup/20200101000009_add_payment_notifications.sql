-- Add notification tracking to department_payments
ALTER TABLE department_payments 
ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notification_count INTEGER DEFAULT 0;

-- Function to check payment status and generate notifications
CREATE OR REPLACE FUNCTION check_payment_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    payment_record RECORD;
    dept_head_id UUID;
    notification_id UUID;
BEGIN
    -- 1. Identify and update OVERDUE payments
    -- Find payments that are 'due' but past their next_payment_due date
    FOR payment_record IN 
        SELECT * FROM department_payments 
        WHERE status = 'due' 
        AND next_payment_due < CURRENT_DATE
    LOOP
        -- Update status to overdue
        UPDATE department_payments 
        SET status = 'overdue',
            updated_at = NOW()
        WHERE id = payment_record.id;

        -- Get Department Head
        SELECT department_head_id INTO dept_head_id
        FROM departments
        WHERE id = payment_record.department_id;

        -- Notify Department Head if exists
        IF dept_head_id IS NOT NULL THEN
            PERFORM create_notification(
                dept_head_id,
                'payment_overdue',
                'finance',
                'Payment Overdue: ' || payment_record.title,
                'The payment for ' || payment_record.title || ' (' || payment_record.amount || ' ' || payment_record.currency || ') was due on ' || payment_record.next_payment_due,
                'high',
                '/portal/payments', -- User link
                NULL -- No actor
            );
        END IF;
    END LOOP;

    -- 2. Notify for PAYMENTS DUE SOON (e.g., within 3 days)
    -- Find payments that are 'due', due within 3 days, and haven't been notified in the last 24 hours
    FOR payment_record IN 
        SELECT * FROM department_payments 
        WHERE status = 'due'
        AND next_payment_due <= (CURRENT_DATE + INTERVAL '3 days')
        AND next_payment_due >= CURRENT_DATE
        AND (last_notification_sent_at IS NULL OR last_notification_sent_at < NOW() - INTERVAL '24 hours')
    LOOP
        -- Get Department Head
        SELECT department_head_id INTO dept_head_id
        FROM departments
        WHERE id = payment_record.department_id;

        -- Notify Department Head if exists
        IF dept_head_id IS NOT NULL THEN
             -- Create Notification
            PERFORM create_notification(
                dept_head_id,
                'payment_due_soon',
                'finance',
                'Payment Due Soon: ' || payment_record.title,
                'The payment for ' || payment_record.title || ' (' || payment_record.amount || ' ' || payment_record.currency || ') is due on ' || payment_record.next_payment_due,
                'normal',
                '/portal/payments',
                NULL
            );

            -- Update tracking
            UPDATE department_payments
            SET last_notification_sent_at = NOW(),
                notification_count = notification_count + 1
            WHERE id = payment_record.id;
        END IF;
    END LOOP;
END;
$$;
