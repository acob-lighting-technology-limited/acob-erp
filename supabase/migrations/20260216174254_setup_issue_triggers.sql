-- C. Asset Issues (Alerts & Fixes)

-- 1. New Issue (Alert)
CREATE OR REPLACE FUNCTION public.handle_new_asset_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fingerprint text;
    v_asset_data jsonb;
    v_assigned_to uuid;
    v_full_name text;
    v_created_by_name text;
BEGIN
    v_fingerprint := 'issue_new_' || NEW.id;

    -- Find current assignee
    SELECT assigned_to INTO v_assigned_to
    FROM public.asset_assignments
    WHERE asset_id = NEW.asset_id AND is_current = true
    LIMIT 1;

    -- If no assignee, no user to notify (maybe notify admin in future, but out of scope for "User Notification")
    IF v_assigned_to IS NOT NULL THEN
        -- Get Asset Details
        SELECT jsonb_build_object(
            'unique_code', unique_code, 
            'asset_type', asset_type, 
            'asset_model', asset_model, 
            'serial_number', serial_number
        ) INTO v_asset_data
        FROM public.assets WHERE id = NEW.asset_id;

        -- Get Reporter Name
        SELECT full_name INTO v_created_by_name FROM public.profiles WHERE id = NEW.created_by;

        INSERT INTO public.notification_queue (user_id, type, title, fingerprint, data, process_after)
        VALUES (
            v_assigned_to,
            'asset_status_alert',
            'Asset Status Update: Issue Reported',
            v_fingerprint,
            v_asset_data || jsonb_build_object(
                'status_action', 'Issue Reported', -- Used in email
                'status_description', NEW.description,
                'authorized_by', COALESCE(v_created_by_name, 'System')
            ),
            now() + interval '5 minutes'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_asset_issue_created ON public.asset_issues;
CREATE TRIGGER on_asset_issue_created
AFTER INSERT ON public.asset_issues
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_asset_issue();


-- 2. Issue Resolved (Fixed)
CREATE OR REPLACE FUNCTION public.handle_asset_issue_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fingerprint text;
    v_asset_data jsonb;
    v_assigned_to uuid;
    v_resolved_by_name text;
BEGIN
    -- Trigger only when resolved changes from false/null to true
    IF (OLD.resolved IS FALSE OR OLD.resolved IS NULL) AND NEW.resolved IS TRUE THEN
        v_fingerprint := 'issue_fixed_' || NEW.id;

        -- Find current assignee
        SELECT assigned_to INTO v_assigned_to
        FROM public.asset_assignments
        WHERE asset_id = NEW.asset_id AND is_current = true
        LIMIT 1;

        IF v_assigned_to IS NOT NULL THEN
            SELECT jsonb_build_object(
                'unique_code', unique_code, 
                'asset_type', asset_type, 
                'asset_model', asset_model, 
                'serial_number', serial_number
            ) INTO v_asset_data
            FROM public.assets WHERE id = NEW.asset_id;

             -- Get Resolver Name
            SELECT full_name INTO v_resolved_by_name FROM public.profiles WHERE id = NEW.resolved_by;

            INSERT INTO public.notification_queue (user_id, type, title, fingerprint, data, process_after)
            VALUES (
                v_assigned_to,
                'asset_status_fixed',
                'Asset Status Update: Issue Resolved',
                v_fingerprint,
                v_asset_data || jsonb_build_object(
                    'status_action', 'Issue Resolved',
                    'status_description', 'The reported issue has been successfully resolved. The asset is now operational.',
                    'authorized_by', COALESCE(v_resolved_by_name, 'Support Team')
                ),
                now() + interval '5 minutes'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_asset_issue_updated ON public.asset_issues;
CREATE TRIGGER on_asset_issue_updated
AFTER UPDATE ON public.asset_issues
FOR EACH ROW
EXECUTE FUNCTION public.handle_asset_issue_resolution();
;
