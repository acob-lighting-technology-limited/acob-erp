
-- Drop the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update action items" ON action_items;

-- New policy: users can only update action_items for their own department
-- Admins and super_admins can update any
CREATE POLICY "Users can update own dept action items"
ON action_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.department = action_items.department
      OR profiles.role IN ('admin', 'super_admin')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.department = action_items.department
      OR profiles.role IN ('admin', 'super_admin')
    )
  )
);
;
