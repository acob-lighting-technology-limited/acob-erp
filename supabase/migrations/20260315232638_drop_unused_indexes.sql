
-- Drop zero-scan unused indexes from public schema
-- These have never been used since the last pg_stat reset and are pure overhead

-- admin_logs
DROP INDEX IF EXISTS idx_admin_logs_admin_id;
DROP INDEX IF EXISTS idx_admin_logs_target_user_id;

-- applications
DROP INDEX IF EXISTS idx_applications_job;
DROP INDEX IF EXISTS idx_applications_status;

-- asset_assignments
DROP INDEX IF EXISTS idx_asset_assignments_one_current_per_asset;

-- asset_issues
DROP INDEX IF EXISTS idx_asset_issues_created_by;
DROP INDEX IF EXISTS idx_asset_issues_resolved;
DROP INDEX IF EXISTS idx_asset_issues_resolved_by;

-- asset_types
DROP INDEX IF EXISTS idx_asset_types_code;
DROP INDEX IF EXISTS idx_asset_types_created_by;
DROP INDEX IF EXISTS idx_asset_types_label;

-- assets
DROP INDEX IF EXISTS assets_serial_number_key;
DROP INDEX IF EXISTS idx_assets_unique_code;

-- attendance_records
DROP INDEX IF EXISTS idx_attendance_records_shift_id;

-- audit_logs
DROP INDEX IF EXISTS idx_audit_logs_user_created;

-- consumption_data
DROP INDEX IF EXISTS idx_consumption_data_meter_id;
DROP INDEX IF EXISTS idx_consumption_data_reading_date;

-- correspondence_approvals
DROP INDEX IF EXISTS idx_correspondence_approvals_correspondence;

-- correspondence_events
DROP INDEX IF EXISTS idx_correspondence_events_correspondence;

-- correspondence_records
DROP INDEX IF EXISTS idx_correspondence_records_assigned_department;
DROP INDEX IF EXISTS idx_correspondence_records_department_status;
DROP INDEX IF EXISTS idx_correspondence_records_direction_status;
DROP INDEX IF EXISTS idx_correspondence_records_reference_number;

-- correspondence_versions
DROP INDEX IF EXISTS idx_correspondence_versions_correspondence;

-- crm_activities
DROP INDEX IF EXISTS idx_crm_activities_assigned_to;
DROP INDEX IF EXISTS idx_crm_activities_completed;
DROP INDEX IF EXISTS idx_crm_activities_contact_id;
DROP INDEX IF EXISTS idx_crm_activities_due_date;
DROP INDEX IF EXISTS idx_crm_activities_opportunity_id;
DROP INDEX IF EXISTS idx_crm_activities_type;

-- crm_contacts
DROP INDEX IF EXISTS idx_crm_contacts_assigned_to;
DROP INDEX IF EXISTS idx_crm_contacts_meter_customer_id;
DROP INDEX IF EXISTS idx_crm_contacts_pipeline_id;
DROP INDEX IF EXISTS idx_crm_contacts_stage;
DROP INDEX IF EXISTS idx_crm_contacts_tags;
DROP INDEX IF EXISTS idx_crm_contacts_type;

-- crm_opportunities
DROP INDEX IF EXISTS idx_crm_opportunities_assigned_to;
DROP INDEX IF EXISTS idx_crm_opportunities_contact_id;
DROP INDEX IF EXISTS idx_crm_opportunities_pipeline_id;
DROP INDEX IF EXISTS idx_crm_opportunities_stage;

-- customers
DROP INDEX IF EXISTS idx_customers_crm_contact_id;

-- department_payments
DROP INDEX IF EXISTS idx_department_payments_invoice_number;
DROP INDEX IF EXISTS idx_department_payments_site_id;
DROP INDEX IF EXISTS idx_dept_payments_category;

-- departments
DROP INDEX IF EXISTS idx_departments_active;
DROP INDEX IF EXISTS idx_departments_head_id;
DROP INDEX IF EXISTS idx_departments_name;
DROP INDEX IF EXISTS unique_department_head;

-- dev_login_logs
DROP INDEX IF EXISTS idx_dev_login_logs_email_login_desc;
DROP INDEX IF EXISTS idx_dev_login_logs_user_login_desc;

-- employee_suspensions
DROP INDEX IF EXISTS idx_employee_suspensions_is_active;

-- event_notifications
DROP INDEX IF EXISTS idx_event_notifications_site_id;
DROP INDEX IF EXISTS idx_events_meter_id;
DROP INDEX IF EXISTS idx_events_severity;
DROP INDEX IF EXISTS idx_events_timestamp;

-- feedback
DROP INDEX IF EXISTS idx_feedback_user_id;

-- firmware_tasks
DROP INDEX IF EXISTS idx_firmware_tasks_firmware_id;
DROP INDEX IF EXISTS idx_firmware_tasks_meter_id;

-- goals_objectives
DROP INDEX IF EXISTS idx_goals_objectives_cycle_id;

-- gprs_status
DROP INDEX IF EXISTS idx_gprs_status_meter_id;
DROP INDEX IF EXISTS idx_gprs_status_online;

-- gprs_tasks
DROP INDEX IF EXISTS idx_gprs_tasks_meter_id;

-- help_desk_tickets
DROP INDEX IF EXISTS idx_help_desk_tickets_handling_mode_status;
DROP INDEX IF EXISTS idx_help_desk_tickets_priority;
DROP INDEX IF EXISTS idx_help_desk_tickets_requester_created;
DROP INDEX IF EXISTS idx_help_desk_tickets_requester_department_status;

-- holiday_calendar
DROP INDEX IF EXISTS idx_holiday_calendar_location_date;

-- interviews
DROP INDEX IF EXISTS idx_interviews_app_id;

-- leave_approver_assignments
DROP INDEX IF EXISTS idx_leave_approver_assignments_primary_scope;

-- leave_balances
DROP INDEX IF EXISTS idx_leave_balances_type_id;

-- leave_evidence
DROP INDEX IF EXISTS idx_leave_evidence_status;

-- leave_requests
DROP INDEX IF EXISTS idx_leave_requests_approval_stage;
DROP INDEX IF EXISTS idx_leave_requests_approved_by;
DROP INDEX IF EXISTS idx_leave_requests_stage_code;
DROP INDEX IF EXISTS idx_leave_requests_supervisor_id;
DROP INDEX IF EXISTS idx_leave_requests_type_id;
DROP INDEX IF EXISTS idx_leave_requests_user_id;

-- meter_readings
DROP INDEX IF EXISTS idx_meter_readings_meter_id;
DROP INDEX IF EXISTS idx_meter_readings_meter_time;
DROP INDEX IF EXISTS idx_meter_readings_odyssey_unique;
DROP INDEX IF EXISTS idx_meter_readings_site_id;
DROP INDEX IF EXISTS idx_meter_readings_type;

-- meters
DROP INDEX IF EXISTS idx_meters_gateway_id;
DROP INDEX IF EXISTS idx_meters_tariff_id;

-- notification_queue (both duplicates, both zero scans)
DROP INDEX IF EXISTS idx_notification_queue_status_process;
DROP INDEX IF EXISTS idx_notification_queue_status_process_after;

-- notifications
DROP INDEX IF EXISTS idx_notifications_priority;
DROP INDEX IF EXISTS idx_notifications_read;

-- offers
DROP INDEX IF EXISTS idx_offers_app_id;

-- office_locations
DROP INDEX IF EXISTS idx_office_locations_department;
DROP INDEX IF EXISTS idx_office_locations_site;
DROP INDEX IF EXISTS idx_office_locations_type;

-- payment_documents
DROP INDEX IF EXISTS idx_payment_docs_replaced_by;
DROP INDEX IF EXISTS idx_payment_documents_archived;
DROP INDEX IF EXISTS idx_payment_documents_date;

-- payroll_entries
DROP INDEX IF EXISTS idx_payroll_entries_period;

-- payslips
DROP INDEX IF EXISTS idx_payslips_entry_id;
DROP INDEX IF EXISTS idx_payslips_period_id;

-- performance_ratings
DROP INDEX IF EXISTS idx_performance_ratings_review_id;

-- performance_reviews
DROP INDEX IF EXISTS idx_perf_reviews_cycle_id;

-- profiles
DROP INDEX IF EXISTS idx_profiles_company_email;
DROP INDEX IF EXISTS idx_profiles_department;
DROP INDEX IF EXISTS idx_profiles_lead_department_ids;
DROP INDEX IF EXISTS idx_profiles_lead_departments;
DROP INDEX IF EXISTS idx_profiles_office_location;
DROP INDEX IF EXISTS unique_lead_per_department;

-- project_items
DROP INDEX IF EXISTS idx_project_items_created_by;

-- project_members
DROP INDEX IF EXISTS idx_project_members_assigned_by;
DROP INDEX IF EXISTS idx_project_members_is_active;
DROP INDEX IF EXISTS idx_project_members_project_id;

-- project_updates
DROP INDEX IF EXISTS idx_project_updates_project_id;
DROP INDEX IF EXISTS idx_project_updates_user_id;

-- projects
DROP INDEX IF EXISTS idx_projects_dates;

-- remote_tasks
DROP INDEX IF EXISTS idx_remote_tasks_created_at;
DROP INDEX IF EXISTS idx_remote_tasks_meter_id;
DROP INDEX IF EXISTS idx_remote_tasks_odyssey_id;
DROP INDEX IF EXISTS idx_remote_tasks_task_id;
DROP INDEX IF EXISTS idx_unique_remote_tasks;

-- salary_structures
DROP INDEX IF EXISTS idx_salary_structures_comp_id;

-- starlink_documents
DROP INDEX IF EXISTS idx_starlink_documents_payment;
DROP INDEX IF EXISTS idx_starlink_documents_type;

-- starlink_payments
DROP INDEX IF EXISTS idx_starlink_payments_created_by;
DROP INDEX IF EXISTS idx_starlink_payments_reminder;

-- starlink_sites
DROP INDEX IF EXISTS idx_starlink_sites_active;
DROP INDEX IF EXISTS idx_starlink_sites_created_by;
DROP INDEX IF EXISTS idx_starlink_sites_state;

-- sync_state
DROP INDEX IF EXISTS idx_sync_state_last_sync;
DROP INDEX IF EXISTS idx_sync_state_type;

-- system_settings
DROP INDEX IF EXISTS idx_system_settings_updated_by;

-- task_updates
DROP INDEX IF EXISTS idx_task_updates_task_id;
DROP INDEX IF EXISTS idx_task_updates_user_id_fk;

-- tasks
DROP INDEX IF EXISTS idx_tasks_assigned_by_fk;
DROP INDEX IF EXISTS idx_tasks_category;
DROP INDEX IF EXISTS idx_tasks_project_id;
DROP INDEX IF EXISTS idx_tasks_source_id;

-- token_records
DROP INDEX IF EXISTS idx_token_records_generated_at;

-- token_sales
DROP INDEX IF EXISTS idx_token_sales_created_at;
DROP INDEX IF EXISTS idx_token_sales_customer_id;
DROP INDEX IF EXISTS idx_token_sales_meter_id;

-- user_lead_departments
DROP INDEX IF EXISTS idx_user_lead_departments_user;
;
