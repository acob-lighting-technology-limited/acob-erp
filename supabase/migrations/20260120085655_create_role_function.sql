
-- Role checking function
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid();
  
  CASE required_role
    WHEN 'visitor' THEN
      RETURN user_role IN ('visitor', 'staff', 'lead', 'admin', 'super_admin');
    WHEN 'staff' THEN
      RETURN user_role IN ('staff', 'lead', 'admin', 'super_admin');
    WHEN 'lead' THEN
      RETURN user_role IN ('lead', 'admin', 'super_admin');
    WHEN 'admin' THEN
      RETURN user_role IN ('admin', 'super_admin');
    WHEN 'super_admin' THEN
      RETURN user_role = 'super_admin';
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
