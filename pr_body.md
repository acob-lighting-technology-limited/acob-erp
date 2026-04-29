## Summary
- move correspondence to root-level routes and sidebar entries (/correspondence, /admin/correspondence)
- keep legacy reference-generator routes as redirects
- enforce staged correspondence approvals (department lead first, executive/MD final approval)
- hide reference numbers until final approval and render under_review as Sent for review
- collapse Department Code Management by default in admin correspondence
- restrict user booking cancellation to pending resource bookings only
- route user shared resources navigation to /resources and add admin /admin/hr/resources
- align weekly report actions with grace-period lock state
- add goal visibility in admin tasks and include lead-assigned individual tasks in scoped admin view
- mask anonymous feedback requester identity in admin feedback views
- include leave evidence upload endpoints and correspondence backfill migration already in local uncommitted scope

## Validation
- npx eslint . --ext .ts,.tsx
- npx tsc --noEmit
- pre-push hook: lint:strict, type-check, build
