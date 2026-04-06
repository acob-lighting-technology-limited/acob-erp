begin;

delete from public.task_updates
where task_id in (
  select id from public.tasks where coalesce(category, '') <> 'weekly_action'
);

delete from public.task_assignments
where task_id in (
  select id from public.tasks where coalesce(category, '') <> 'weekly_action'
);

delete from public.task_user_completion
where task_id in (
  select id from public.tasks where coalesce(category, '') <> 'weekly_action'
);

delete from public.tasks
where coalesce(category, '') <> 'weekly_action';

delete from public.project_updates;
delete from public.project_items;
delete from public.project_members;
delete from public.projects;

delete from public.help_desk_approvals;
delete from public.help_desk_comments;
delete from public.help_desk_events;
delete from public.help_desk_tickets;

delete from public.leave_evidence;
delete from public.leave_approvals;
delete from public.leave_requests;

commit;
