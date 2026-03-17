-- 1. Drop old overloaded versions to avoid confusion
-- (We need to specify argument types to drop specific overloads, or just overwrite)
-- To be safe, let's just create a definitive one with a name that won't clash if needed, 
-- or overwrite the most likely one.

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id uuid,
    p_type text,
    p_category text DEFAULT NULL,
    p_title text DEFAULT NULL,
    p_message text DEFAULT NULL,
    p_priority text DEFAULT 'normal',
    p_link_url text DEFAULT NULL,
    p_actor_id uuid DEFAULT NULL,
    p_entity_type text DEFAULT NULL,
    p_entity_id text DEFAULT NULL,
    p_rich_content jsonb DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_notification_id UUID;
  v_data JSONB;
BEGIN
  -- Consolidate all extra metadata into the 'data' JSONB column
  v_data := jsonb_build_object(
    'category', p_category,
    'actor_id', p_actor_id,
    'entity_type', p_entity_type,
    'entity_id', p_entity_id,
    'rich_content', p_rich_content,
    'link_url', p_link_url
  );

  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    priority,
    action_url,
    data
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_priority,
    p_link_url,
    v_data
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$function$;;
