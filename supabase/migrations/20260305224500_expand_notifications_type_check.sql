-- Expand notifications type check to include app-level workflow notification types.

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check
CHECK (
  type = ANY (
    ARRAY[
      -- Existing legacy/system types
      'token_generated',
      'token_cancelled',
      'task_completed',
      'task_failed',
      'customer_added',
      'customer_updated',
      'meter_status_change',
      'meter_added',
      'activity_reminder',
      'crm_contact_added',
      'opportunity_won',
      'opportunity_lost',
      'system_alert',
      'asset_assigned',
      'asset_transfer_outgoing',
      'asset_transfer_incoming',
      'asset_returned',
      'asset_status_alert',
      'asset_status_fixed',
      'system_restored',
      -- App notification types currently used in code
      'task_assigned',
      'task_updated',
      'mention',
      'feedback',
      'approval_request',
      'approval_granted',
      'approval_rejected',
      'announcement',
      'system'
    ]::text[]
  )
);
