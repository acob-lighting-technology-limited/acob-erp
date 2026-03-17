-- Broadcast Odyssey Events to User Notifications
-- This trigger automatically creates a notification for all admin users 
-- when a new record is added to event_notifications with severity >= 'medium'.

CREATE OR REPLACE FUNCTION public.broadcast_event_notification()
RETURNS TRIGGER AS $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Only broadcast if severity is not 'low'
    IF NEW.severity IN ('medium', 'high', 'critical') THEN
        -- Loop through all admin users
        FOR admin_user_id IN 
            SELECT user_id FROM public.user_roles WHERE role = 'admin'
        LOOP
            INSERT INTO public.notifications (
                user_id,
                type,
                title,
                message,
                data,
                priority,
                created_at
            ) VALUES (
                admin_user_id,
                'grid_event',
                'Grid Alert: ' || NEW.event_type,
                NEW.description,
                jsonb_build_object(
                    'event_id', NEW.event_id,
                    'meter_id', NEW.meter_id,
                    'odyssey_meter_id', NEW.odyssey_meter_id,
                    'severity', NEW.severity
                ),
                CASE 
                    WHEN NEW.severity = 'critical' THEN 'urgent'
                    WHEN NEW.severity = 'high' THEN 'high'
                    ELSE 'normal'
                END,
                NOW()
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_broadcast_event_notification ON public.event_notifications;
CREATE TRIGGER tr_broadcast_event_notification
AFTER INSERT ON public.event_notifications
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_event_notification();
;
