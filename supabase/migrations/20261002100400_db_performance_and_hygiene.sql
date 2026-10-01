-- Database performance + hygiene (audit 3.4, 3.5, 3.8, 3.9, 3.11).

BEGIN;

-- 3.5 Covering indexes for foreign keys (Supabase linter: unindexed_foreign_keys).
-- Generated from the live schema on 2026-10-02. Without them, joins on these
-- columns and ON DELETE checks on the parent table scan the whole child table.
CREATE INDEX IF NOT EXISTS idx_action_item_evidence_uploaded_by ON public.action_item_evidence (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_action_items_blocker_reported_by ON public.action_items (blocker_reported_by);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON public.admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_user_id ON public.admin_logs (target_user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_posting_id ON public.applications (job_posting_id);
CREATE INDEX IF NOT EXISTS idx_asset_issues_created_by ON public.asset_issues (created_by);
CREATE INDEX IF NOT EXISTS idx_asset_issues_resolved_by ON public.asset_issues (resolved_by);
CREATE INDEX IF NOT EXISTS idx_asset_types_created_by ON public.asset_types (created_by);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_by ON public.assets (deleted_by);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_attendance_record_id ON public.attendance_appeals (attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_reviewed_by ON public.attendance_appeals (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_attendance_early_closures_created_by ON public.attendance_early_closures (created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_events_actor_id ON public.attendance_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_attendance_exempt_periods_created_by ON public.attendance_exempt_periods (created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_late_resumptions_created_by ON public.attendance_late_resumptions (created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_lunch_log_created_by ON public.attendance_lunch_log (created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_oos_periods_created_by ON public.attendance_oos_periods (created_by);
CREATE INDEX IF NOT EXISTS idx_attendance_records_shift_id ON public.attendance_records (shift_id);
CREATE INDEX IF NOT EXISTS idx_cbt_questions_created_by ON public.cbt_questions (created_by);
CREATE INDEX IF NOT EXISTS idx_consumption_data_meter_id ON public.consumption_data (meter_id);
CREATE INDEX IF NOT EXISTS idx_controlled_document_acknowledgements_document_id ON public.controlled_document_acknowledgements (document_id);
CREATE INDEX IF NOT EXISTS idx_controlled_document_versions_uploaded_by ON public.controlled_document_versions (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_controlled_documents_created_by ON public.controlled_documents (created_by);
CREATE INDEX IF NOT EXISTS idx_controlled_documents_current_version_id ON public.controlled_documents (current_version_id);
CREATE INDEX IF NOT EXISTS idx_controlled_documents_updated_by ON public.controlled_documents (updated_by);
CREATE INDEX IF NOT EXISTS idx_correspondence_approvals_approver_id ON public.correspondence_approvals (approver_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_categories_created_by ON public.correspondence_categories (created_by);
CREATE INDEX IF NOT EXISTS idx_correspondence_events_actor_id ON public.correspondence_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_events_correspondence_id ON public.correspondence_events (correspondence_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_records_created_by_id ON public.correspondence_records (created_by_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_versions_uploaded_by ON public.correspondence_versions (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_daily_reports_acknowledged_by ON public.daily_reports (acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_department_document_metadata_created_by_user_id ON public.department_document_metadata (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_department_document_metadata_last_modified_by_user_id ON public.department_document_metadata (last_modified_by_user_id);
CREATE INDEX IF NOT EXISTS idx_department_payments_site_id ON public.department_payments (site_id);
CREATE INDEX IF NOT EXISTS idx_departments_department_head_id ON public.departments (department_head_id);
CREATE INDEX IF NOT EXISTS idx_dev_login_logs_user_id ON public.dev_login_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_development_plans_created_by ON public.development_plans (created_by);
CREATE INDEX IF NOT EXISTS idx_digest_schedules_created_by ON public.digest_schedules (created_by);
CREATE INDEX IF NOT EXISTS idx_employee_number_history_changed_by ON public.employee_number_history (changed_by);
CREATE INDEX IF NOT EXISTS idx_employee_number_history_profile_id ON public.employee_number_history (profile_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_invited_via_department_id ON public.event_attendees (invited_via_department_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_meter_id ON public.event_notifications (meter_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events (created_by);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON public.events (organizer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_firmware_tasks_firmware_id ON public.firmware_tasks (firmware_id);
CREATE INDEX IF NOT EXISTS idx_firmware_tasks_meter_id ON public.firmware_tasks (meter_id);
CREATE INDEX IF NOT EXISTS idx_fleet_booking_attachments_uploaded_by ON public.fleet_booking_attachments (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_fleet_bookings_reviewed_by ON public.fleet_bookings (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_fleet_resources_created_by ON public.fleet_resources (created_by);
CREATE INDEX IF NOT EXISTS idx_general_meeting_attendance_recorded_by ON public.general_meeting_attendance (recorded_by);
CREATE INDEX IF NOT EXISTS idx_general_meeting_sessions_created_by ON public.general_meeting_sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_goals_objectives_archived_by ON public.goals_objectives (archived_by);
CREATE INDEX IF NOT EXISTS idx_goals_objectives_updated_by ON public.goals_objectives (updated_by);
CREATE INDEX IF NOT EXISTS idx_gprs_status_meter_id ON public.gprs_status (meter_id);
CREATE INDEX IF NOT EXISTS idx_gprs_tasks_meter_id ON public.gprs_tasks (meter_id);
CREATE INDEX IF NOT EXISTS idx_help_desk_approvals_approver_id ON public.help_desk_approvals (approver_id);
CREATE INDEX IF NOT EXISTS idx_help_desk_attachments_uploaded_by ON public.help_desk_attachments (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_help_desk_comments_author_id ON public.help_desk_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_help_desk_events_actor_id ON public.help_desk_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_help_desk_tickets_assigned_by ON public.help_desk_tickets (assigned_by);
CREATE INDEX IF NOT EXISTS idx_help_desk_tickets_created_by ON public.help_desk_tickets (created_by);
CREATE INDEX IF NOT EXISTS idx_holiday_calendar_created_by ON public.holiday_calendar (created_by);
CREATE INDEX IF NOT EXISTS idx_implementation_plans_created_by ON public.implementation_plans (created_by);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON public.interviews (application_id);
CREATE INDEX IF NOT EXISTS idx_kpi_actuals_recorded_by ON public.kpi_actuals (recorded_by);
CREATE INDEX IF NOT EXISTS idx_kss_results_evaluator_id ON public.kss_results (evaluator_id);
CREATE INDEX IF NOT EXISTS idx_kss_results_presenter_id ON public.kss_results (presenter_id);
CREATE INDEX IF NOT EXISTS idx_kss_rotation_skips_created_by ON public.kss_rotation_skips (created_by);
CREATE INDEX IF NOT EXISTS idx_kss_weekly_roster_created_by ON public.kss_weekly_roster (created_by);
CREATE INDEX IF NOT EXISTS idx_kss_weekly_roster_presenter_id ON public.kss_weekly_roster (presenter_id);
CREATE INDEX IF NOT EXISTS idx_leave_approver_assignments_approver_role_code ON public.leave_approver_assignments (approver_role_code);
CREATE INDEX IF NOT EXISTS idx_leave_balances_leave_type_id ON public.leave_balances (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by ON public.leave_requests (approved_by);
CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type_id ON public.leave_requests (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_supervisor_id ON public.leave_requests (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_lunch_menus_archived_by ON public.lunch_menus (archived_by);
CREATE INDEX IF NOT EXISTS idx_lunch_menus_created_by ON public.lunch_menus (created_by);
CREATE INDEX IF NOT EXISTS idx_lunch_reviews_user_id ON public.lunch_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_lunch_vote_selections_group_id ON public.lunch_vote_selections (group_id);
CREATE INDEX IF NOT EXISTS idx_md_desk_delegates_granted_by ON public.md_desk_delegates (granted_by);
CREATE INDEX IF NOT EXISTS idx_meeting_artifact_ledger_document_id ON public.meeting_artifact_ledger (document_id);
CREATE INDEX IF NOT EXISTS idx_meeting_artifact_sources_created_by ON public.meeting_artifact_sources (created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_challenges_created_by ON public.meeting_challenges (created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_challenges_owner_id ON public.meeting_challenges (owner_id);
CREATE INDEX IF NOT EXISTS idx_meeting_week_documents_presenter_id ON public.meeting_week_documents (presenter_id);
CREATE INDEX IF NOT EXISTS idx_meeting_week_documents_replaced_by ON public.meeting_week_documents (replaced_by);
CREATE INDEX IF NOT EXISTS idx_meters_gateway_id ON public.meters (gateway_id);
CREATE INDEX IF NOT EXISTS idx_meters_tariff_id ON public.meters (tariff_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON public.notification_queue (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_delivery_preferences_notification_key ON public.notification_user_delivery_preferences (notification_key);
CREATE INDEX IF NOT EXISTS idx_offers_application_id ON public.offers (application_id);
CREATE INDEX IF NOT EXISTS idx_payment_documents_replaced_by ON public.payment_documents (replaced_by);
CREATE INDEX IF NOT EXISTS idx_payslips_payroll_entry_id ON public.payslips (payroll_entry_id);
CREATE INDEX IF NOT EXISTS idx_payslips_payroll_period_id ON public.payslips (payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_peer_feedback_reviewer_user_id ON public.peer_feedback (reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_users_contract_category_id ON public.pending_users (contract_category_id);
CREATE INDEX IF NOT EXISTS idx_performance_ratings_performance_review_id ON public.performance_ratings (performance_review_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_created_by ON public.portfolios (created_by);
CREATE INDEX IF NOT EXISTS idx_profiles_attendance_exempt_set_by ON public.profiles (attendance_exempt_set_by);
CREATE INDEX IF NOT EXISTS idx_profiles_contract_category_id ON public.profiles (contract_category_id);
CREATE INDEX IF NOT EXISTS idx_project_items_created_by ON public.project_items (created_by);
CREATE INDEX IF NOT EXISTS idx_project_members_assigned_by ON public.project_members (assigned_by);
CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON public.project_updates (project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_user_id ON public.project_updates (user_id);
CREATE INDEX IF NOT EXISTS idx_remote_tasks_meter_id ON public.remote_tasks (meter_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_approved_by ON public.requisitions (approved_by);
CREATE INDEX IF NOT EXISTS idx_requisitions_authorized_by ON public.requisitions (authorized_by);
CREATE INDEX IF NOT EXISTS idx_requisitions_rejected_by ON public.requisitions (rejected_by);
CREATE INDEX IF NOT EXISTS idx_requisitions_reviewed_by ON public.requisitions (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_requisitions_verified_by ON public.requisitions (verified_by);
CREATE INDEX IF NOT EXISTS idx_risk_register_created_by ON public.risk_register (created_by);
CREATE INDEX IF NOT EXISTS idx_risk_register_updated_by ON public.risk_register (updated_by);
CREATE INDEX IF NOT EXISTS idx_salary_structures_salary_component_id ON public.salary_structures (salary_component_id);
CREATE INDEX IF NOT EXISTS idx_starlink_documents_payment_id ON public.starlink_documents (payment_id);
CREATE INDEX IF NOT EXISTS idx_starlink_payments_created_by ON public.starlink_payments (created_by);
CREATE INDEX IF NOT EXISTS idx_starlink_sites_created_by ON public.starlink_sites (created_by);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON public.system_settings (updated_by);
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON public.task_updates (task_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_user_id ON public.task_updates (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_archived_by ON public.tasks (archived_by);
CREATE INDEX IF NOT EXISTS idx_tasks_reassigned_to ON public.tasks (reassigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_by ON public.tasks (updated_by);
CREATE INDEX IF NOT EXISTS idx_token_sales_customer_id ON public.token_sales (customer_id);
CREATE INDEX IF NOT EXISTS idx_token_sales_meter_id ON public.token_sales (meter_id);

-- 3.5 Duplicate indexes (identical definitions; keep the *_id-named one).
DROP INDEX IF EXISTS public.idx_development_plan_actions_plan;
DROP INDEX IF EXISTS public.idx_development_plans_user;
DROP INDEX IF EXISTS public.idx_leave_requests_user;

-- 3.4 Department: department_id is the authority; the text column is a mirror the
-- sync trigger maintains. Backfill the profile whose text matches a real
-- department but whose id is missing. (46 profiles have neither — HR must assign
-- them; the admin "data health" card lists them.)
UPDATE public.profiles p
SET department_id = d.id
FROM public.departments d
WHERE p.department_id IS NULL
  AND p.department IS NOT NULL
  AND lower(d.name) = lower(p.department);

COMMENT ON COLUMN public.profiles.department IS
  'Mirror of departments.name for department_id, maintained by trg_profile_department_ssot_sync. Join on department_id; never write this column directly.';

-- 3.8 Backup tables out of the PostgREST-exposed schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER TABLE IF EXISTS public.tasks_work_item_number_backup SET SCHEMA private;
ALTER TABLE IF EXISTS public.deleted_tasks_archive SET SCHEMA private;

-- 3.9 Retire the legacy 7-argument create_notification overload. Its only two
-- callers (CRM-era meter/token triggers) move to the 11-argument version, which
-- applies notification preferences and categories.
CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND OLD.status IS DISTINCT FROM NEW.status AND NEW.created_by IS NOT NULL THEN
    PERFORM public.create_notification(
      p_user_id := NEW.created_by,
      p_type := CASE WHEN NEW.status = 'completed' THEN 'task_completed' ELSE 'system' END,
      p_category := 'system',
      p_title := CASE WHEN NEW.status = 'completed' THEN 'Task Completed Successfully' ELSE 'Task Failed' END,
      p_message := format('Remote task for meter %s has %s', NEW.meter_id, NEW.status),
      p_priority := CASE WHEN NEW.status = 'failed' THEN 'high' ELSE 'normal' END,
      p_link_url := NULL,
      p_actor_id := NULL,
      p_entity_type := 'remote_task',
      p_entity_id := NEW.id,
      p_rich_content := jsonb_build_object(
        'task_id', NEW.id, 'meter_id', NEW.meter_id, 'task_type', NEW.task_type,
        'status', NEW.status, 'error_message', NEW.error_message)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_token_generated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.generated_by IS NOT NULL THEN
    PERFORM public.create_notification(
      p_user_id := NEW.generated_by,
      p_type := 'system',
      p_category := 'system',
      p_title := 'Token Generated Successfully',
      p_message := format('Token %s generated for meter %s', NEW.token, NEW.meter_id),
      p_priority := 'normal',
      p_link_url := NULL,
      p_actor_id := NULL,
      p_entity_type := 'token_sale',
      p_entity_id := NEW.id,
      p_rich_content := jsonb_build_object(
        'token_id', NEW.id, 'meter_id', NEW.meter_id, 'amount', NEW.amount, 'units', NEW.units)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_task_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_token_generated() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.create_notification(uuid, text, text, text, jsonb, text, text);

-- 3.11 Unschedule leftover one-off test jobs (they fire again every 18 February).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest-test-840pm') THEN
    PERFORM cron.unschedule('weekly-digest-test-840pm');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-digest-tonight') THEN
    PERFORM cron.unschedule('weekly-digest-tonight');
  END IF;
END $$;

COMMIT;
