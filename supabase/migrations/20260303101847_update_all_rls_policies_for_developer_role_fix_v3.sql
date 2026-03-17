-- Fix RLS policies to include 'developer' role across all tables

-- action_items
DROP POLICY IF EXISTS "Users can delete action items" ON action_items;
CREATE POLICY "Users can delete action items" ON action_items 
FOR DELETE TO authenticated USING (public.has_role('lead'));

DROP POLICY IF EXISTS "Users can update own dept action items" ON action_items;
CREATE POLICY "Users can update own dept action items" ON action_items 
FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.department = action_items.department OR public.has_role('admin'))
  )
);

DROP POLICY IF EXISTS "Users can view action items for their department" ON action_items;
CREATE POLICY "Users can view action items for their department" ON action_items 
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (p.department = action_items.department OR public.has_role('lead'))
  )
);


-- digest_schedules (fix)
DROP POLICY IF EXISTS "Admins can manage digest schedules" ON digest_schedules;
CREATE POLICY "Admins can manage digest schedules" ON digest_schedules 
FOR ALL TO authenticated USING (public.has_role('admin'));


-- employee_department_history
DROP POLICY IF EXISTS "Admins can insert department history" ON employee_department_history;
CREATE POLICY "Admins can insert department history" ON employee_department_history 
FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));


-- office_locations (fix)
DROP POLICY IF EXISTS "Office locations delete policy" ON office_locations;
CREATE POLICY "Office locations delete policy" ON office_locations 
FOR DELETE TO authenticated USING (public.has_role('super_admin'));


-- pending_users
DROP POLICY IF EXISTS "Pending users delete policy" ON pending_users;
CREATE POLICY "Pending users delete policy" ON pending_users 
FOR DELETE TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "Pending users insert policy" ON pending_users;
CREATE POLICY "Pending users insert policy" ON pending_users 
FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "Pending users select policy" ON pending_users;
CREATE POLICY "Pending users select policy" ON pending_users 
FOR SELECT TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "Pending users update policy" ON pending_users;
CREATE POLICY "Pending users update policy" ON pending_users 
FOR UPDATE TO authenticated USING (public.has_role('admin'));


-- roles
DROP POLICY IF EXISTS "Admins can manage roles" ON roles;
CREATE POLICY "Admins can manage roles" ON roles 
FOR ALL TO authenticated USING (public.has_role('admin'));


-- starlink_payments
DROP POLICY IF EXISTS "Starlink payments select policy" ON starlink_payments;
CREATE POLICY "Starlink payments select policy" ON starlink_payments 
FOR SELECT TO authenticated USING (public.has_role('admin'));


-- tariffs
DROP POLICY IF EXISTS "Tariffs admin manage" ON tariffs;
CREATE POLICY "Tariffs admin manage" ON tariffs 
FOR ALL TO authenticated USING (public.has_role('admin'));


-- token_sales
DROP POLICY IF EXISTS "Users with access can read token sales" ON token_sales;
CREATE POLICY "Users with access can read token sales" ON token_sales 
FOR SELECT TO authenticated USING (public.has_role('staff') OR public.has_role('visitor'));


-- user_roles
DROP POLICY IF EXISTS "User roles insert policy" ON user_roles;
CREATE POLICY "User roles insert policy" ON user_roles 
FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "User roles select (self or admin)" ON user_roles;
CREATE POLICY "User roles select (self or admin)" ON user_roles 
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role('admin'));


-- weekly_reports
DROP POLICY IF EXISTS "Leads and admins can insert weekly reports" ON weekly_reports;
CREATE POLICY "Leads and admins can insert weekly reports" ON weekly_reports 
FOR INSERT TO authenticated WITH CHECK (public.has_role('lead'));

DROP POLICY IF EXISTS "Leads and admins can update weekly reports" ON weekly_reports;
CREATE POLICY "Leads and admins can update weekly reports" ON weekly_reports 
FOR UPDATE TO authenticated USING (
  auth.uid() = user_id 
  OR public.has_role('admin')
  OR (public.has_role('lead') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.department = weekly_reports.department))
);

DROP POLICY IF EXISTS "Only admins can delete weekly reports" ON weekly_reports;
CREATE POLICY "Only admins can delete weekly reports" ON weekly_reports 
FOR DELETE TO authenticated USING (public.has_role('admin'));
;
