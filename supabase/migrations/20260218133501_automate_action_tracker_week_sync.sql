-- 1. Add report_id to action_items to create a strong link
ALTER TABLE public.action_items ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES public.weekly_reports(id) ON DELETE SET NULL;

-- 2. Create a function to calculate the next ISO week/year
CREATE OR REPLACE FUNCTION public.fn_calculate_next_week(w int, y int)
RETURNS TABLE (next_w int, next_y int) AS $$
BEGIN
    IF w >= 52 THEN
        RETURN QUERY SELECT 1, y + 1;
    ELSE
        RETURN QUERY SELECT w + 1, y;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Create the Trigger Function to handle automatic movement of action items
CREATE OR REPLACE FUNCTION public.fn_sync_action_items_on_week_change()
RETURNS TRIGGER AS $$
DECLARE
    target_w int;
    target_y int;
BEGIN
    -- Only proceed if week_number, year, or department changed
    IF (OLD.week_number IS DISTINCT FROM NEW.week_number OR 
        OLD.year IS DISTINCT FROM NEW.year OR 
        OLD.department IS DISTINCT FROM NEW.department) THEN
        
        -- Calculate the new target week based on the report's new week
        SELECT next_w, next_y INTO target_w, target_y 
        FROM public.fn_calculate_next_week(NEW.week_number, NEW.year);
        
        -- MOVE manual/syced items that were targeted for this report
        -- We update any items linked via report_id
        UPDATE public.action_items
        SET week_number = target_w,
            year = target_y,
            department = NEW.department
        WHERE report_id = NEW.id;

        -- Fallback: If for some reason report_id isn't set, we can catch existing orphaned ones
        -- that look like they belonged to the old sync target (dept + old_next_week + pending)
        -- This helps with legacy data or cases where the app hasn't set report_id yet.
        IF NOT EXISTS (SELECT 1 FROM public.action_items WHERE report_id = NEW.id) THEN
            DECLARE
                old_target_w int;
                old_target_y int;
            BEGIN
                SELECT next_w, next_y INTO old_target_w, old_target_y 
                FROM public.fn_calculate_next_week(OLD.week_number, OLD.year);
                
                UPDATE public.action_items
                SET week_number = target_w,
                    year = target_y,
                    department = NEW.department
                WHERE department = OLD.department
                  AND week_number = old_target_w
                  AND year = old_target_y
                  AND status = 'pending';
            END;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the Trigger
DROP TRIGGER IF EXISTS tr_sync_action_items_on_week_change ON public.weekly_reports;
CREATE TRIGGER tr_sync_action_items_on_week_change
AFTER UPDATE ON public.weekly_reports
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_action_items_on_week_change();
;
