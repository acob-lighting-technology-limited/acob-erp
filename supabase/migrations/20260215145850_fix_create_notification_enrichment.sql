CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, 
  p_type text, 
  p_title text, 
  p_message text, 
  p_data jsonb DEFAULT '{}'::jsonb, 
  p_action_url text DEFAULT NULL::text, 
  p_priority text DEFAULT 'normal'::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  notification_id UUID;
  v_first_name TEXT;
  v_full_name TEXT;
  v_dept_name TEXT;
BEGIN
  -- Fetch user profile and department info
  SELECT 
    p.first_name, 
    COALESCE(p.first_name || ' ' || p.last_name, p.first_name, 'Team') as full_name,
    d.name
  INTO v_first_name, v_full_name, v_dept_name
  FROM profiles p
  LEFT JOIN departments d ON p.department_id = d.id
  WHERE p.id = p_user_id;

  -- Enrich p_data with the fetched info
  p_data := COALESCE(p_data, '{}'::jsonb) || jsonb_build_object(
    'user_first_name', COALESCE(v_first_name, 'Team'),
    'user_full_name', COALESCE(v_full_name, 'Team Member'),
    'user_dept_name', COALESCE(v_dept_name, 'Member')
  );

  INSERT INTO notifications (
    user_id, type, title, message, data, action_url, priority
  ) VALUES (
    p_user_id, p_type, p_title, p_message, p_data, p_action_url, p_priority
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$;;
