
-- 1. Fix Action Items Policies
DROP POLICY IF EXISTS "Users can update their own action items or admins/leads" ON public.action_items;
DROP POLICY IF EXISTS "Users can delete action items" ON public.action_items;

-- Update: Allowed for creator, Admins, or Leads of the SAME department
CREATE POLICY "Leads and admins can update department action items"
    ON public.action_items FOR UPDATE
    USING (
        auth.uid() = assigned_by
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('admin', 'super_admin')
                OR (profiles.role = 'lead' AND profiles.department = action_items.department)
            )
        )
    );

-- Delete: ONLY Admins can delete
CREATE POLICY "Only admins can delete action items"
    ON public.action_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );


-- 2. Fix Weekly Reports Policies
DROP POLICY IF EXISTS "Leads can manage their own reports" ON public.weekly_reports;

-- Update: Allowed for owner, Admins, or Leads of the SAME department
CREATE POLICY "Leads and admins can update weekly reports"
    ON public.weekly_reports FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('admin', 'super_admin')
                OR (profiles.role = 'lead' AND profiles.department = weekly_reports.department)
            )
        )
    );

-- Delete: ONLY Admins can delete (moved from general management to specific policy)
CREATE POLICY "Only admins can delete weekly reports"
    ON public.weekly_reports FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );
