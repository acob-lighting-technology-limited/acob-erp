# ERP Comprehensive Test Campaign Report

Generated: 2026-03-07T16:18:32.290Z
Duration: 130s

## Summary
- Total findings: 83
- P0: 0
- P1: 81
- P2: 1
- P3: 1
- Coverage: pass=139, fail=76, skip=144, blocker=1
- Inventory: pages=156, apis=99

## Prioritized Findings
- [P1] [RBAC] routing | / | role=unauthenticated
  - Expected: Protected route should redirect to login or maintenance.
  - Actual: Route did not enforce auth boundary (HTTP 307, location=/profile).
  - Evidence: {"status":307,"location":"/profile"}
  - Repro: Open / without login.
- [P1] [RBAC] api | /api/admin/approve-user | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/admin/approve-user without authentication.
- [P1] [RBAC] api | /api/admin/assets/snapshot | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/admin/assets/snapshot without authentication.
- [P1] [RBAC] api | /api/admin/create-user | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/admin/create-user without authentication.
- [P1] [RBAC] api | /api/admin/dev/login-logs | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/admin/dev/login-logs without authentication.
- [P1] [RBAC] api | /api/admin/employees/next-serial | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/admin/employees/next-serial without authentication.
- [P1] [RBAC] api | /api/admin/import-csv | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/admin/import-csv without authentication.
- [P1] [RBAC] api | /api/admin/users/invite | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/admin/users/invite without authentication.
- [P1] [RBAC] api | /api/admin/users/role | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/admin/users/role without authentication.
- [P1] [RBAC] api | /api/auth/create-profile | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/auth/create-profile without authentication.
- [P1] [RBAC] api | /api/auth/setup-password | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/auth/setup-password without authentication.
- [P1] [RBAC] api | /api/correspondence/department-codes | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/correspondence/department-codes without authentication.
- [P1] [RBAC] api | /api/correspondence/records | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/correspondence/records without authentication.
- [P1] [RBAC] api | /api/departments | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/departments without authentication.
- [P1] [RBAC] api | /api/help-desk/categories | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/help-desk/categories without authentication.
- [P1] [RBAC] api | /api/help-desk/dashboard | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/help-desk/dashboard without authentication.
- [P1] [RBAC] api | /api/help-desk/tickets | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/help-desk/tickets without authentication.
- [P1] [RBAC] api | /api/hr/attendance/clock-in | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/attendance/clock-in without authentication.
- [P1] [RBAC] api | /api/hr/attendance/clock-out | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/attendance/clock-out without authentication.
- [P1] [RBAC] api | /api/hr/attendance/records | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/attendance/records without authentication.
- [P1] [RBAC] api | /api/hr/leave/approve | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/approve without authentication.
- [P1] [RBAC] api | /api/hr/leave/balances | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/balances without authentication.
- [P1] [RBAC] api | /api/hr/leave/data-quality | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/data-quality without authentication.
- [P1] [RBAC] api | /api/hr/leave/evidence | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/evidence without authentication.
- [P1] [RBAC] api | /api/hr/leave/evidence/verify | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/evidence/verify without authentication.
- [P1] [RBAC] api | /api/hr/leave/flow | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/flow without authentication.
- [P1] [RBAC] api | /api/hr/leave/flow/preview | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/flow/preview without authentication.
- [P1] [RBAC] api | /api/hr/leave/holidays | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/holidays without authentication.
- [P1] [RBAC] api | /api/hr/leave/lifecycle | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/lifecycle without authentication.
- [P1] [RBAC] api | /api/hr/leave/payroll-feed | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/payroll-feed without authentication.
- [P1] [RBAC] api | /api/hr/leave/policies | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/policies without authentication.
- [P1] [RBAC] api | /api/hr/leave/policy-simulation | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/policy-simulation without authentication.
- [P1] [RBAC] api | /api/hr/leave/queue | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/queue without authentication.
- [P1] [RBAC] api | /api/hr/leave/relievers | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/relievers without authentication.
- [P1] [RBAC] api | /api/hr/leave/requests | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/requests without authentication.
- [P1] [RBAC] api | /api/hr/leave/sla | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/sla without authentication.
- [P1] [RBAC] api | /api/hr/leave/sla/reminders | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/sla/reminders without authentication.
- [P1] [RBAC] api | /api/hr/leave/types | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/leave/types without authentication.
- [P1] [RBAC] api | /api/hr/performance/cycles | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/performance/cycles without authentication.
- [P1] [RBAC] api | /api/hr/performance/goals | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/performance/goals without authentication.
- [P1] [RBAC] api | /api/hr/performance/reviews | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/hr/performance/reviews without authentication.
- [P1] [RBAC] api | /api/onedrive | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/onedrive without authentication.
- [P1] [RBAC] api | /api/onedrive/download | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/onedrive/download without authentication.
- [P1] [RBAC] api | /api/onedrive/preview | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/onedrive/preview without authentication.
- [P1] [RBAC] api | /api/payments | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/payments without authentication.
- [P1] [RBAC] api | /api/payments/categories | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/payments/categories without authentication.
- [P1] [RBAC] api | /api/profile/update | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/profile/update without authentication.
- [P1] [RBAC] api | /api/search | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/search without authentication.
- [P1] [RBAC] api | /api/telemetry/errors | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/telemetry/errors without authentication.
- [P1] [RBAC] api | /api/v1/finance/payments | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/finance/payments without authentication.
- [P1] [RBAC] api | /api/v1/hr/attendance/clock-in | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/attendance/clock-in without authentication.
- [P1] [RBAC] api | /api/v1/hr/attendance/clock-out | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/attendance/clock-out without authentication.
- [P1] [RBAC] api | /api/v1/hr/attendance/records | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/attendance/records without authentication.
- [P1] [RBAC] api | /api/v1/hr/departments | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/departments without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/approve | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/approve without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/balances | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/balances without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/data-quality | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/data-quality without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/evidence | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/evidence without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/evidence/verify | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/evidence/verify without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/holidays | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/holidays without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/lifecycle | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/lifecycle without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/payroll-feed | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/payroll-feed without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/policies | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/policies without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/policy-simulation | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/policy-simulation without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/queue | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/queue without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/relievers | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/relievers without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/requests | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/requests without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/sla | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/sla without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/sla/reminders | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/sla/reminders without authentication.
- [P1] [RBAC] api | /api/v1/hr/leave/types | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/leave/types without authentication.
- [P1] [RBAC] api | /api/v1/hr/performance/cycles | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/performance/cycles without authentication.
- [P1] [RBAC] api | /api/v1/hr/performance/goals | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/performance/goals without authentication.
- [P1] [RBAC] api | /api/v1/hr/performance/reviews | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /api/v1/hr/performance/reviews without authentication.
- [P1] [RBAC] api | /auth/callback | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /auth/callback without authentication.
- [P1] [RBAC] api | /auth/confirm | role=unauthenticated
  - Expected: Endpoint should reject unauthorized access.
  - Actual: HTTP 307
  - Evidence: {"status":307}
  - Repro: GET /auth/confirm without authentication.
- [P1] [Legacy] config | persona_credentials | role=developer
  - Expected: All seeded personas must be available for full RBAC campaign coverage.
  - Actual: Credentials missing for this persona.
  - Evidence: {"persona":"developer"}
  - Repro: Set TEST_USER_DEVELOPER_EMAIL and TEST_USER_DEVELOPER_PASSWORD in environment.
- [P1] [Legacy] config | persona_credentials | role=super_admin
  - Expected: All seeded personas must be available for full RBAC campaign coverage.
  - Actual: Credentials missing for this persona.
  - Evidence: {"persona":"super_admin"}
  - Repro: Set TEST_USER_SUPER_ADMIN_EMAIL and TEST_USER_SUPER_ADMIN_PASSWORD in environment.
- [P1] [Legacy] config | persona_credentials | role=admin
  - Expected: All seeded personas must be available for full RBAC campaign coverage.
  - Actual: Credentials missing for this persona.
  - Evidence: {"persona":"admin"}
  - Repro: Set TEST_USER_ADMIN_EMAIL and TEST_USER_ADMIN_PASSWORD in environment.
- [P1] [Legacy] config | persona_credentials | role=employee
  - Expected: All seeded personas must be available for full RBAC campaign coverage.
  - Actual: Credentials missing for this persona.
  - Evidence: {"persona":"employee"}
  - Repro: Set TEST_USER_EMPLOYEE_EMAIL and TEST_USER_EMPLOYEE_PASSWORD in environment.
- [P1] [Legacy] config | persona_credentials | role=department_lead
  - Expected: All seeded personas must be available for full RBAC campaign coverage.
  - Actual: Credentials missing for this persona.
  - Evidence: {"persona":"department_lead"}
  - Repro: Set TEST_USER_DEPARTMENT_LEAD_EMAIL and TEST_USER_DEPARTMENT_LEAD_PASSWORD in environment.
- [P1] [RBAC] rbac | scripts/rbac-deep-audit.cjs | role=system
  - Expected: Script should complete successfully.
  - Actual: Command failed: node /Users/chibuike/Documents/GitHub/clone/ERP/scripts/rbac-deep-audit.cjs
RBAC deep audit failed: {
  code: '22P02',
  details: null,
  hint: null,
  message: 'invalid input value for enum user_role: "lead"'
}

  - Evidence: RBAC deep audit failed: {
  code: '22P02',
  details: null,
  hint: null,
  message: 'invalid input value for enum user_role: "lead"'
}

  - Repro: Run `node scripts/rbac-deep-audit.cjs` with valid env vars.
- [P2] [Responsive] ui | DialogContent responsive constraints | role=system
  - Expected: Modals should include mobile-safe width/overflow constraints.
  - Actual: 1 modal component(s) missing clear responsive constraints.
  - Evidence: {"modalResponsiveWarnings":1}
  - Repro: Scan components with DialogContent and verify width/overflow responsive classes.
- [P3] [Skeleton] ui | loading.tsx coverage | role=system
  - Expected: Critical/slow routes should have consistent loading skeleton coverage.
  - Actual: 87 page segment(s) missing colocated loading.tsx.
  - Evidence: {"missingLoading":87}
  - Repro: Scan route segments and compare page.tsx dirs against loading.tsx dirs.

## Route Coverage Matrix
| Target | Type | Role | Status | Reason |
|---|---|---|---|---|
| /api/dev/leave-route-diagnostics | diagnostic | developer | pass | All route stages resolvable. |
| /api/dev/help-desk-route-diagnostics | diagnostic | developer | pass | Help desk routing prerequisites healthy. |
| /api/dev/task-route-diagnostics | diagnostic | developer | pass | Task routing prerequisites healthy. |
| scripts/rbac-deep-audit.cjs | diagnostic | system | blocker | Command failed: node /Users/chibuike/Documents/GitHub/clone/ERP/scripts/rbac-deep-audit.cjs
RBAC deep audit failed: {
  code: '22P02',
  details: null,
  hint: null,
  message: 'invalid input value for enum user_role: "lead"'
}
 |
| / | page | unauthenticated | fail | HTTP 307 -> /profile |
| /admin | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin-setup | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/assets | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/assets/issues | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/audit-logs | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/communications | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/communications/broadcast | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/communications/meetings | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/communications/meetings/mail | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/communications/meetings/reminders | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/correspondence | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/dev | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/dev/login-logs | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/dev/maintenance | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/dev/role-escalations | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/dev/security-events | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/dev/tests | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/dev/ui-errors | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/documentation | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/documentation/department-documents | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/documentation/internal | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/employees | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/employees/[userId] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/employees/signature/[userId] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/feedback | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/finance | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/finance/bills | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/finance/bills/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/finance/bills/new | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/finance/invoices | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/finance/invoices/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/finance/invoices/new | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/finance/payments | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/finance/payments/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/finance/payments/departments | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/finance/reports | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/help-desk | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/attendance/reports | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/departments | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/employees | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/employees/[userId] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/hr/employees/offboarding-conflicts | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/employees/signature/[userId] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/hr/leave/approve | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/leave/settings | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/leave/test | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/office-location | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/hr/performance/create | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/inventory | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/inventory/categories | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/inventory/movements | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/inventory/products | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/inventory/products/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/inventory/products/[id]/edit | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/inventory/products/new | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/inventory/warehouses | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/job-descriptions | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/meetings | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/meetings/mail | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/meetings/reminders | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/notification | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/notification/broadcast | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/notification/meetings | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/notification/meetings/mail | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/notification/meetings/reminders | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/onedrive | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/payments | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/payments/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/payments/departments | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/projects | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/projects/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/purchasing | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/purchasing/orders | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/purchasing/orders/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/purchasing/orders/new | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/purchasing/receipts | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/purchasing/suppliers | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/purchasing/suppliers/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/purchasing/suppliers/[id]/edit | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/reports | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/reports/action-tracker | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/reports/mail | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/reports/weekly-reports | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/settings | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/settings/company | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/settings/maintenance | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/settings/roles | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/settings/users | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/settings/users/invite | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/tasks | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/tools | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/tools/reference-generator | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /assets | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /auth/error | page | unauthenticated | pass | HTTP 200 |
| /auth/forgot-password | page | unauthenticated | pass | HTTP 200 |
| /auth/login | page | unauthenticated | pass | HTTP 200 |
| /auth/reset-password | page | unauthenticated | pass | HTTP 200 |
| /auth/set-password | page | unauthenticated | pass | HTTP 200 |
| /auth/setup-account | page | unauthenticated | pass | HTTP 200 |
| /auth/sign-up | page | unauthenticated | pass | HTTP 200 |
| /auth/sign-up-success | page | unauthenticated | pass | HTTP 200 |
| /dashboard | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/assets | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/attendance | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/attendance/records | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/correspondence | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/documentation | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/documentation/department-documents | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/documentation/internal | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/feedback | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/goals | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/help-desk | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/leave | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/leave/request | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/notifications | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/payments | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/payments/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /dashboard/profile | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/profile/edit | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/projects | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/projects/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /dashboard/reports | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/reports/action-tracker | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/reports/weekly-reports | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/reports/weekly-reports/new | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/reviews | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/tasks | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/tasks/management | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /dashboard/tools | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /documentation | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /documentation/department-documents | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /documentation/internal | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /employee/new | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /feedback | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /job-description | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /maintenance | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fmaintenance |
| /notification | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /payments | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /payments/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /portal | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /portal/[...slug] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /profile | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /profile/edit | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /projects | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /projects/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /signature | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /suspended | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /tasks | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /tools | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /tools/job-description | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /tools/reference-generator | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /tools/signature | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /tools/watermark | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /watermark | page | unauthenticated | pass | HTTP 307 -> /maintenance |
| /admin/dev | page | developer | skip | Persona unavailable. |
| /admin/dev/tests | page | developer | skip | Persona unavailable. |
| /admin | page | developer | skip | Persona unavailable. |
| /admin | page | super_admin | skip | Persona unavailable. |
| /admin/dev/tests | page | super_admin | skip | Persona unavailable. |
| /admin | page | admin | skip | Persona unavailable. |
| /admin/dev/tests | page | admin | skip | Persona unavailable. |
| /admin | page | department_lead | skip | Persona unavailable. |
| /admin/dev/tests | page | department_lead | skip | Persona unavailable. |
| /admin | page | employee | skip | Persona unavailable. |
| /admin/dev/tests | page | employee | skip | Persona unavailable. |
| /api/admin/approve-user | api | unauthenticated | fail | HTTP 307 |
| /api/admin/assets/snapshot | api | unauthenticated | fail | HTTP 307 |
| /api/admin/create-user | api | unauthenticated | fail | HTTP 307 |
| /api/admin/dev/login-logs | api | unauthenticated | fail | HTTP 307 |
| /api/admin/employees/next-serial | api | unauthenticated | fail | HTTP 307 |
| /api/admin/import-csv | api | unauthenticated | fail | HTTP 307 |
| /api/admin/users/invite | api | unauthenticated | fail | HTTP 307 |
| /api/admin/users/role | api | unauthenticated | fail | HTTP 307 |
| /api/auth/create-profile | api | unauthenticated | fail | HTTP 307 |
| /api/auth/setup-password | api | unauthenticated | fail | HTTP 307 |
| /api/correspondence/department-codes | api | unauthenticated | fail | HTTP 307 |
| /api/correspondence/records | api | unauthenticated | fail | HTTP 307 |
| /api/correspondence/records/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/correspondence/records/[id]/approvals | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/correspondence/records/[id]/dispatch | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/correspondence/records/[id]/documents | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/correspondence/records/[id]/link-response | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/departments | api | unauthenticated | fail | HTTP 307 |
| /api/departments/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/asset-mail-routing | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/flow-tests | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/help-desk-route-diagnostics | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/leave-flow-test | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/leave-route-diagnostics | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/login-log | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/maintenance | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/task-route-diagnostics | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/categories | api | unauthenticated | fail | HTTP 307 |
| /api/help-desk/dashboard | api | unauthenticated | fail | HTTP 307 |
| /api/help-desk/tickets | api | unauthenticated | fail | HTTP 307 |
| /api/help-desk/tickets/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/tickets/[id]/approvals | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/tickets/[id]/assign | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/tickets/[id]/comments | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/tickets/[id]/pivot | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/hr/attendance/clock-in | api | unauthenticated | fail | HTTP 307 |
| /api/hr/attendance/clock-out | api | unauthenticated | fail | HTTP 307 |
| /api/hr/attendance/records | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/approve | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/balances | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/data-quality | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/evidence | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/evidence/verify | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/flow | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/flow/preview | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/holidays | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/lifecycle | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/payroll-feed | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/policies | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/policy-simulation | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/queue | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/relievers | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/requests | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/sla | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/sla/reminders | api | unauthenticated | fail | HTTP 307 |
| /api/hr/leave/types | api | unauthenticated | fail | HTTP 307 |
| /api/hr/performance/cycles | api | unauthenticated | fail | HTTP 307 |
| /api/hr/performance/goals | api | unauthenticated | fail | HTTP 307 |
| /api/hr/performance/reviews | api | unauthenticated | fail | HTTP 307 |
| /api/onedrive | api | unauthenticated | fail | HTTP 307 |
| /api/onedrive/download | api | unauthenticated | fail | HTTP 307 |
| /api/onedrive/preview | api | unauthenticated | fail | HTTP 307 |
| /api/payments | api | unauthenticated | fail | HTTP 307 |
| /api/payments/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/payments/[id]/documents | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/payments/categories | api | unauthenticated | fail | HTTP 307 |
| /api/payments/categories/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/profile/update | api | unauthenticated | fail | HTTP 307 |
| /api/search | api | unauthenticated | fail | HTTP 307 |
| /api/telemetry/errors | api | unauthenticated | fail | HTTP 307 |
| /api/v1/finance/payments | api | unauthenticated | fail | HTTP 307 |
| /api/v1/finance/payments/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/v1/hr/attendance/clock-in | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/attendance/clock-out | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/attendance/records | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/departments | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/employees/[id]/status | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/v1/hr/employees/[id]/suspensions | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/v1/hr/leave/approve | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/balances | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/data-quality | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/evidence | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/evidence/verify | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/holidays | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/lifecycle | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/payroll-feed | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/policies | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/policy-simulation | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/queue | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/relievers | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/requests | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/sla | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/sla/reminders | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/leave/types | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/performance/cycles | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/performance/goals | api | unauthenticated | fail | HTTP 307 |
| /api/v1/hr/performance/reviews | api | unauthenticated | fail | HTTP 307 |
| /auth/callback | api | unauthenticated | fail | HTTP 307 |
| /auth/confirm | api | unauthenticated | fail | HTTP 307 |
| workflow:leave/helpdesk/task | workflow | developer | skip | Developer cookie or seed IDs unavailable. |
| rls-negative-tests | diagnostic | employee | skip | Required persona IDs unavailable. |
| /dashboard/attendance | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/attendance/records | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/correspondence | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/documentation/department-documents | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/documentation/internal | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/goals | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/leave | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/leave/request | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/payments/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/reports/action-tracker | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/reports | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/reports/weekly-reports/new | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/reports/weekly-reports | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/reviews | static | system | skip | No loading.tsx in route segment directory. |
| /dashboard/tasks/management | static | system | skip | No loading.tsx in route segment directory. |
| /documentation/department-documents | static | system | skip | No loading.tsx in route segment directory. |
| /documentation/internal | static | system | skip | No loading.tsx in route segment directory. |
| /payments/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /portal/[...slug] | static | system | skip | No loading.tsx in route segment directory. |
| /tools/reference-generator | static | system | skip | No loading.tsx in route segment directory. |
| /tools/watermark | static | system | skip | No loading.tsx in route segment directory. |
| /admin/assets/issues | static | system | skip | No loading.tsx in route segment directory. |
| /admin/communications/broadcast | static | system | skip | No loading.tsx in route segment directory. |
| /admin/communications/meetings/mail | static | system | skip | No loading.tsx in route segment directory. |
| /admin/communications/meetings | static | system | skip | No loading.tsx in route segment directory. |
| /admin/communications/meetings/reminders | static | system | skip | No loading.tsx in route segment directory. |
| /admin/communications | static | system | skip | No loading.tsx in route segment directory. |
| /admin/correspondence | static | system | skip | No loading.tsx in route segment directory. |
| /admin/dev/login-logs | static | system | skip | No loading.tsx in route segment directory. |
| /admin/dev/maintenance | static | system | skip | No loading.tsx in route segment directory. |
| /admin/dev | static | system | skip | No loading.tsx in route segment directory. |
| /admin/dev/role-escalations | static | system | skip | No loading.tsx in route segment directory. |
| /admin/dev/security-events | static | system | skip | No loading.tsx in route segment directory. |
| /admin/dev/tests | static | system | skip | No loading.tsx in route segment directory. |
| /admin/dev/ui-errors | static | system | skip | No loading.tsx in route segment directory. |
| /admin/documentation/department-documents | static | system | skip | No loading.tsx in route segment directory. |
| /admin/documentation/internal | static | system | skip | No loading.tsx in route segment directory. |
| /admin/finance/bills/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /admin/finance/bills/new | static | system | skip | No loading.tsx in route segment directory. |
| /admin/finance/invoices/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /admin/finance/invoices/new | static | system | skip | No loading.tsx in route segment directory. |
| /admin/finance/payments/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /admin/finance/payments/departments | static | system | skip | No loading.tsx in route segment directory. |
| /admin/finance/reports | static | system | skip | No loading.tsx in route segment directory. |
| /admin/hr/employees/offboarding-conflicts | static | system | skip | No loading.tsx in route segment directory. |
| /admin/hr/leave/settings | static | system | skip | No loading.tsx in route segment directory. |
| /admin/hr/leave/test | static | system | skip | No loading.tsx in route segment directory. |
| /admin/inventory/movements | static | system | skip | No loading.tsx in route segment directory. |
| /admin/inventory/products/[id]/edit | static | system | skip | No loading.tsx in route segment directory. |
| /admin/inventory/products/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /admin/inventory/products/new | static | system | skip | No loading.tsx in route segment directory. |
| /admin/meetings/mail | static | system | skip | No loading.tsx in route segment directory. |
| /admin/meetings | static | system | skip | No loading.tsx in route segment directory. |
| /admin/meetings/reminders | static | system | skip | No loading.tsx in route segment directory. |
| /admin/notification/broadcast | static | system | skip | No loading.tsx in route segment directory. |
| /admin/notification/meetings/mail | static | system | skip | No loading.tsx in route segment directory. |
| /admin/notification/meetings | static | system | skip | No loading.tsx in route segment directory. |
| /admin/notification/meetings/reminders | static | system | skip | No loading.tsx in route segment directory. |
| /admin/payments/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /admin/payments/departments | static | system | skip | No loading.tsx in route segment directory. |
| /admin/purchasing/orders/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /admin/purchasing/orders/new | static | system | skip | No loading.tsx in route segment directory. |
| /admin/purchasing/receipts | static | system | skip | No loading.tsx in route segment directory. |
| /admin/purchasing/suppliers/[id]/edit | static | system | skip | No loading.tsx in route segment directory. |
| /admin/purchasing/suppliers/[id] | static | system | skip | No loading.tsx in route segment directory. |
| /admin/purchasing/suppliers | static | system | skip | No loading.tsx in route segment directory. |
| /admin/reports/action-tracker | static | system | skip | No loading.tsx in route segment directory. |
| /admin/reports/mail | static | system | skip | No loading.tsx in route segment directory. |
| /admin/reports | static | system | skip | No loading.tsx in route segment directory. |
| /admin/reports/weekly-reports | static | system | skip | No loading.tsx in route segment directory. |
| /admin/settings/company | static | system | skip | No loading.tsx in route segment directory. |
| /admin/settings/maintenance | static | system | skip | No loading.tsx in route segment directory. |
| /admin/settings/roles | static | system | skip | No loading.tsx in route segment directory. |
| /admin/settings/users/invite | static | system | skip | No loading.tsx in route segment directory. |
| /admin/settings/users | static | system | skip | No loading.tsx in route segment directory. |
| /admin/tools | static | system | skip | No loading.tsx in route segment directory. |
| /admin/tools/reference-generator | static | system | skip | No loading.tsx in route segment directory. |
| /auth/error | static | system | skip | No loading.tsx in route segment directory. |
| /auth/forgot-password | static | system | skip | No loading.tsx in route segment directory. |
| /auth/login | static | system | skip | No loading.tsx in route segment directory. |
| /auth/reset-password | static | system | skip | No loading.tsx in route segment directory. |
| /auth/set-password | static | system | skip | No loading.tsx in route segment directory. |
| /auth/setup-account | static | system | skip | No loading.tsx in route segment directory. |
| /auth/sign-up | static | system | skip | No loading.tsx in route segment directory. |
| /auth/sign-up-success | static | system | skip | No loading.tsx in route segment directory. |
| /employee/new | static | system | skip | No loading.tsx in route segment directory. |
| /maintenance | static | system | skip | No loading.tsx in route segment directory. |
| components/admin/department-leads-manager.tsx | static | system | fail | DialogContent without obvious responsive constraints. |