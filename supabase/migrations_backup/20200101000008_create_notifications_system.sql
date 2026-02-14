-- Professional Notification System
-- Creates tables and functions for a robust notification system like LinkedIn/GitHub

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification metadata
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'task_updated', 'task_completed', 'mention', 'feedback', 'asset_assigned', 'approval_request', 'approval_granted', 'system', 'announcement')),
  category TEXT NOT NULL CHECK (category IN ('tasks', 'assets', 'feedback', 'approvals', 'system', 'mentions')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  rich_content JSONB, -- For additional structured data (avatars, actions, etc.)
  
  -- Links and actions
  link_url TEXT,
  link_text TEXT,
  action_buttons JSONB, -- Array of action buttons {label, action, url}
  
  -- Actors (who triggered this notification)
  actor_id UUID REFERENCES auth.users(id), -- Person who caused this notification
  actor_name TEXT,
  actor_avatar TEXT,
  
  -- Entity references (for grouping/deduplication)
  entity_type TEXT, -- 'task', 'asset', 'feedback', etc.
  entity_id UUID,
  
  -- State
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  clicked BOOLEAN NOT NULL DEFAULT FALSE,
  clicked_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration date
  
  -- Indexes
  CONSTRAINT notifications_user_id_created_at_idx UNIQUE NULLS NOT DISTINCT (user_id, created_at, id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(user_id, category);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor ON notifications(actor_id);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Channel preferences
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Category preferences
  tasks_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  assets_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  feedback_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  approvals_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  system_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mentions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Frequency settings
  email_frequency TEXT NOT NULL DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'hourly', 'daily', 'weekly', 'never')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  -- Other settings
  auto_mark_read_on_click BOOLEAN NOT NULL DEFAULT TRUE,
  show_previews BOOLEAN NOT NULL DEFAULT TRUE,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_category TEXT,
  p_title TEXT,
  p_message TEXT,
  p_priority TEXT DEFAULT 'normal',
  p_link_url TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_rich_content JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_preferences RECORD;
BEGIN
  -- Check user preferences
  SELECT * INTO v_preferences
  FROM notification_preferences
  WHERE user_id = p_user_id;
  
  -- If no preferences exist, create defaults
  IF NOT FOUND THEN
    INSERT INTO notification_preferences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    v_preferences.in_app_enabled := TRUE;
  END IF;
  
  -- Only create if in-app notifications are enabled for this category
  IF v_preferences.in_app_enabled THEN
    INSERT INTO notifications (
      user_id,
      type,
      category,
      priority,
      title,
      message,
      link_url,
      actor_id,
      entity_type,
      entity_id,
      rich_content
    ) VALUES (
      p_user_id,
      p_type,
      p_category,
      p_priority,
      p_title,
      p_message,
      p_link_url,
      p_actor_id,
      p_entity_type,
      p_entity_id,
      p_rich_content
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all as read
    UPDATE notifications
    SET read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id AND read = FALSE;
  ELSE
    -- Mark specific ones as read
    UPDATE notifications
    SET read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id 
      AND id = ANY(p_notification_ids)
      AND read = FALSE;
  END IF;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications() RETURNS void AS $$
BEGIN
  -- Archive read notifications older than 30 days
  UPDATE notifications
  SET archived = TRUE, archived_at = NOW()
  WHERE read = TRUE 
    AND created_at < NOW() - INTERVAL '30 days'
    AND archived = FALSE;
  
  -- Delete archived notifications older than 90 days
  DELETE FROM notifications
  WHERE archived = TRUE
    AND archived_at < NOW() - INTERVAL '90 days';
    
  -- Delete expired notifications
  DELETE FROM notifications
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate actor info
CREATE OR REPLACE FUNCTION populate_notification_actor() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actor_id IS NOT NULL AND NEW.actor_name IS NULL THEN
    SELECT 
      CONCAT(first_name, ' ', last_name),
      avatar_url
    INTO NEW.actor_name, NEW.actor_avatar
    FROM profiles
    WHERE id = NEW.actor_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_populate_notification_actor ON notifications;
CREATE TRIGGER trigger_populate_notification_actor
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION populate_notification_actor();

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- RLS Policies for preferences
CREATE POLICY "Users can view their own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE notifications IS 'Stores all user notifications with rich content and real-time support';
COMMENT ON TABLE notification_preferences IS 'User notification settings and preferences';
COMMENT ON FUNCTION create_notification IS 'Helper function to create notifications with automatic preference checks';
COMMENT ON FUNCTION mark_notifications_read IS 'Bulk mark notifications as read';
COMMENT ON FUNCTION cleanup_old_notifications IS 'Clean up old archived and expired notifications';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

