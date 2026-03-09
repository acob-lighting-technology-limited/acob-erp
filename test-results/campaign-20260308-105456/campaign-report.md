# ERP Comprehensive Test Campaign Report

Generated: 2026-03-08T09:57:07.671Z
Duration: 132s

## Summary
- Total findings: 5
- P0: 0
- P1: 5
- P2: 0
- P3: 0
- Coverage: pass=219, fail=0, skip=57, blocker=0
- Inventory: pages=156, apis=99

## Prioritized Findings
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

## Route Coverage Matrix
| Target | Type | Role | Status | Reason |
|---|---|---|---|---|
| /api/dev/leave-route-diagnostics | diagnostic | developer | pass | All route stages resolvable. |
| /api/dev/help-desk-route-diagnostics | diagnostic | developer | pass | Help desk routing prerequisites healthy. |
| /api/dev/task-route-diagnostics | diagnostic | developer | pass | Task routing prerequisites healthy. |
| scripts/rbac-deep-audit.cjs | diagnostic | system | pass | RBAC deep audit passed. |
| / | page | unauthenticated | pass | HTTP 307 -> /profile |
| /admin | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin |
| /admin-setup | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin-setup |
| /admin/assets | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fassets |
| /admin/assets/issues | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fassets%2Fissues |
| /admin/audit-logs | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Faudit-logs |
| /admin/communications | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fcommunications |
| /admin/communications/broadcast | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fcommunications%2Fbroadcast |
| /admin/communications/meetings | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fcommunications%2Fmeetings |
| /admin/communications/meetings/mail | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fcommunications%2Fmeetings%2Fmail |
| /admin/communications/meetings/reminders | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fcommunications%2Fmeetings%2Freminders |
| /admin/correspondence | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fcorrespondence |
| /admin/dev | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdev |
| /admin/dev/login-logs | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdev%2Flogin-logs |
| /admin/dev/maintenance | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdev%2Fmaintenance |
| /admin/dev/role-escalations | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdev%2Frole-escalations |
| /admin/dev/security-events | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdev%2Fsecurity-events |
| /admin/dev/tests | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdev%2Ftests |
| /admin/dev/ui-errors | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdev%2Fui-errors |
| /admin/documentation | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdocumentation |
| /admin/documentation/department-documents | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdocumentation%2Fdepartment-documents |
| /admin/documentation/internal | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fdocumentation%2Finternal |
| /admin/employees | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Femployees |
| /admin/employees/[userId] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/employees/signature/[userId] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/feedback | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffeedback |
| /admin/finance | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffinance |
| /admin/finance/bills | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffinance%2Fbills |
| /admin/finance/bills/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/finance/bills/new | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffinance%2Fbills%2Fnew |
| /admin/finance/invoices | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffinance%2Finvoices |
| /admin/finance/invoices/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/finance/invoices/new | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffinance%2Finvoices%2Fnew |
| /admin/finance/payments | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffinance%2Fpayments |
| /admin/finance/payments/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/finance/payments/departments | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffinance%2Fpayments%2Fdepartments |
| /admin/finance/reports | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ffinance%2Freports |
| /admin/help-desk | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhelp-desk |
| /admin/hr | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr |
| /admin/hr/attendance/reports | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Fattendance%2Freports |
| /admin/hr/departments | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Fdepartments |
| /admin/hr/employees | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Femployees |
| /admin/hr/employees/[userId] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/hr/employees/offboarding-conflicts | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Femployees%2Foffboarding-conflicts |
| /admin/hr/employees/signature/[userId] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/hr/leave/approve | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Fleave%2Fapprove |
| /admin/hr/leave/settings | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Fleave%2Fsettings |
| /admin/hr/leave/test | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Fleave%2Ftest |
| /admin/hr/office-location | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Foffice-location |
| /admin/hr/performance/create | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fhr%2Fperformance%2Fcreate |
| /admin/inventory | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Finventory |
| /admin/inventory/categories | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Finventory%2Fcategories |
| /admin/inventory/movements | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Finventory%2Fmovements |
| /admin/inventory/products | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Finventory%2Fproducts |
| /admin/inventory/products/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/inventory/products/[id]/edit | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/inventory/products/new | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Finventory%2Fproducts%2Fnew |
| /admin/inventory/warehouses | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Finventory%2Fwarehouses |
| /admin/job-descriptions | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fjob-descriptions |
| /admin/meetings | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fmeetings |
| /admin/meetings/mail | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fmeetings%2Fmail |
| /admin/meetings/reminders | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fmeetings%2Freminders |
| /admin/notification | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fnotification |
| /admin/notification/broadcast | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fnotification%2Fbroadcast |
| /admin/notification/meetings | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fnotification%2Fmeetings |
| /admin/notification/meetings/mail | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fnotification%2Fmeetings%2Fmail |
| /admin/notification/meetings/reminders | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fnotification%2Fmeetings%2Freminders |
| /admin/onedrive | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fonedrive |
| /admin/payments | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fpayments |
| /admin/payments/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/payments/departments | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fpayments%2Fdepartments |
| /admin/projects | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fprojects |
| /admin/projects/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/purchasing | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fpurchasing |
| /admin/purchasing/orders | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fpurchasing%2Forders |
| /admin/purchasing/orders/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/purchasing/orders/new | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fpurchasing%2Forders%2Fnew |
| /admin/purchasing/receipts | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fpurchasing%2Freceipts |
| /admin/purchasing/suppliers | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fpurchasing%2Fsuppliers |
| /admin/purchasing/suppliers/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/purchasing/suppliers/[id]/edit | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /admin/reports | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Freports |
| /admin/reports/action-tracker | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Freports%2Faction-tracker |
| /admin/reports/mail | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Freports%2Fmail |
| /admin/reports/weekly-reports | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Freports%2Fweekly-reports |
| /admin/settings | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fsettings |
| /admin/settings/company | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fsettings%2Fcompany |
| /admin/settings/maintenance | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fsettings%2Fmaintenance |
| /admin/settings/roles | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fsettings%2Froles |
| /admin/settings/users | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fsettings%2Fusers |
| /admin/settings/users/invite | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Fsettings%2Fusers%2Finvite |
| /admin/tasks | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ftasks |
| /admin/tools | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ftools |
| /admin/tools/reference-generator | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fadmin%2Ftools%2Freference-generator |
| /assets | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fassets |
| /auth/error | page | unauthenticated | pass | HTTP 200 |
| /auth/forgot-password | page | unauthenticated | pass | HTTP 200 |
| /auth/login | page | unauthenticated | pass | HTTP 200 |
| /auth/reset-password | page | unauthenticated | pass | HTTP 200 |
| /auth/set-password | page | unauthenticated | pass | HTTP 200 |
| /auth/setup-account | page | unauthenticated | pass | HTTP 200 |
| /auth/sign-up | page | unauthenticated | pass | HTTP 200 |
| /auth/sign-up-success | page | unauthenticated | pass | HTTP 200 |
| /dashboard | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard |
| /dashboard/assets | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fassets |
| /dashboard/attendance | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fattendance |
| /dashboard/attendance/records | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fattendance%2Frecords |
| /dashboard/correspondence | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fcorrespondence |
| /dashboard/documentation | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fdocumentation |
| /dashboard/documentation/department-documents | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fdocumentation%2Fdepartment-documents |
| /dashboard/documentation/internal | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fdocumentation%2Finternal |
| /dashboard/feedback | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Ffeedback |
| /dashboard/goals | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fgoals |
| /dashboard/help-desk | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fhelp-desk |
| /dashboard/leave | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fleave |
| /dashboard/leave/request | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fleave%2Frequest |
| /dashboard/notifications | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fnotifications |
| /dashboard/payments | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fpayments |
| /dashboard/payments/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /dashboard/profile | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fprofile |
| /dashboard/profile/edit | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fprofile%2Fedit |
| /dashboard/projects | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Fprojects |
| /dashboard/projects/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /dashboard/reports | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Freports |
| /dashboard/reports/action-tracker | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Freports%2Faction-tracker |
| /dashboard/reports/weekly-reports | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Freports%2Fweekly-reports |
| /dashboard/reports/weekly-reports/new | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Freports%2Fweekly-reports%2Fnew |
| /dashboard/reviews | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Freviews |
| /dashboard/tasks | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Ftasks |
| /dashboard/tasks/management | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Ftasks%2Fmanagement |
| /dashboard/tools | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdashboard%2Ftools |
| /documentation | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdocumentation |
| /documentation/department-documents | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdocumentation%2Fdepartment-documents |
| /documentation/internal | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fdocumentation%2Finternal |
| /employee/new | page | unauthenticated | pass | HTTP 200 |
| /feedback | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Ffeedback |
| /job-description | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fjob-description |
| /maintenance | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fmaintenance |
| /notification | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fnotification |
| /payments | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fpayments |
| /payments/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /portal | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fportal |
| /portal/[...slug] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /profile | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fprofile |
| /profile/edit | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fprofile%2Fedit |
| /projects | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fprojects |
| /projects/[id] | page | unauthenticated | skip | Dynamic route skipped in anonymous crawl. |
| /signature | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fsignature |
| /suspended | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fsuspended |
| /tasks | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Ftasks |
| /tools | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Ftools |
| /tools/job-description | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Ftools%2Fjob-description |
| /tools/reference-generator | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Ftools%2Freference-generator |
| /tools/signature | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Ftools%2Fsignature |
| /tools/watermark | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Ftools%2Fwatermark |
| /watermark | page | unauthenticated | pass | HTTP 307 -> /auth/login?next=%2Fwatermark |
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
| /api/admin/approve-user | api | unauthenticated | pass | HTTP 307 |
| /api/admin/assets/snapshot | api | unauthenticated | pass | HTTP 307 |
| /api/admin/create-user | api | unauthenticated | pass | HTTP 307 |
| /api/admin/dev/login-logs | api | unauthenticated | pass | HTTP 307 |
| /api/admin/employees/next-serial | api | unauthenticated | pass | HTTP 307 |
| /api/admin/import-csv | api | unauthenticated | pass | HTTP 307 |
| /api/admin/users/invite | api | unauthenticated | pass | HTTP 307 |
| /api/admin/users/role | api | unauthenticated | pass | HTTP 307 |
| /api/auth/create-profile | api | unauthenticated | pass | HTTP 307 |
| /api/auth/setup-password | api | unauthenticated | pass | HTTP 307 |
| /api/correspondence/department-codes | api | unauthenticated | pass | HTTP 307 |
| /api/correspondence/records | api | unauthenticated | pass | HTTP 307 |
| /api/correspondence/records/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/correspondence/records/[id]/approvals | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/correspondence/records/[id]/dispatch | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/correspondence/records/[id]/documents | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/correspondence/records/[id]/link-response | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/departments | api | unauthenticated | pass | HTTP 307 |
| /api/departments/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/asset-mail-routing | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/flow-tests | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/help-desk-route-diagnostics | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/leave-flow-test | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/leave-route-diagnostics | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/login-log | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/maintenance | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/dev/task-route-diagnostics | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/categories | api | unauthenticated | pass | HTTP 307 |
| /api/help-desk/dashboard | api | unauthenticated | pass | HTTP 307 |
| /api/help-desk/tickets | api | unauthenticated | pass | HTTP 307 |
| /api/help-desk/tickets/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/tickets/[id]/approvals | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/tickets/[id]/assign | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/tickets/[id]/comments | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/help-desk/tickets/[id]/pivot | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/hr/attendance/clock-in | api | unauthenticated | pass | HTTP 307 |
| /api/hr/attendance/clock-out | api | unauthenticated | pass | HTTP 307 |
| /api/hr/attendance/records | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/approve | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/balances | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/data-quality | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/evidence | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/evidence/verify | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/flow | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/flow/preview | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/holidays | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/lifecycle | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/payroll-feed | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/policies | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/policy-simulation | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/queue | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/relievers | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/requests | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/sla | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/sla/reminders | api | unauthenticated | pass | HTTP 307 |
| /api/hr/leave/types | api | unauthenticated | pass | HTTP 307 |
| /api/hr/performance/cycles | api | unauthenticated | pass | HTTP 307 |
| /api/hr/performance/goals | api | unauthenticated | pass | HTTP 307 |
| /api/hr/performance/reviews | api | unauthenticated | pass | HTTP 307 |
| /api/onedrive | api | unauthenticated | pass | HTTP 307 |
| /api/onedrive/download | api | unauthenticated | pass | HTTP 307 |
| /api/onedrive/preview | api | unauthenticated | pass | HTTP 307 |
| /api/payments | api | unauthenticated | pass | HTTP 307 |
| /api/payments/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/payments/[id]/documents | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/payments/categories | api | unauthenticated | pass | HTTP 307 |
| /api/payments/categories/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/profile/update | api | unauthenticated | pass | HTTP 307 |
| /api/search | api | unauthenticated | pass | HTTP 307 |
| /api/telemetry/errors | api | unauthenticated | pass | HTTP 307 |
| /api/v1/finance/payments | api | unauthenticated | pass | HTTP 307 |
| /api/v1/finance/payments/[id] | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/v1/hr/attendance/clock-in | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/attendance/clock-out | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/attendance/records | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/departments | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/employees/[id]/status | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/v1/hr/employees/[id]/suspensions | api | unauthenticated | skip | Dynamic/dev route skipped in generic unauthenticated API crawl. |
| /api/v1/hr/leave/approve | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/balances | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/data-quality | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/evidence | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/evidence/verify | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/holidays | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/lifecycle | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/payroll-feed | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/policies | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/policy-simulation | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/queue | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/relievers | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/requests | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/sla | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/sla/reminders | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/leave/types | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/performance/cycles | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/performance/goals | api | unauthenticated | pass | HTTP 307 |
| /api/v1/hr/performance/reviews | api | unauthenticated | pass | HTTP 307 |
| /auth/callback | api | unauthenticated | pass | HTTP 307 |
| /auth/confirm | api | unauthenticated | pass | HTTP 307 |
| workflow:leave/helpdesk/task | workflow | developer | skip | Developer cookie or seed IDs unavailable. |
| rls-negative-tests | diagnostic | employee | skip | Required persona IDs unavailable. |
| ui:audit loading coverage | static | system | pass | All page directories include loading.tsx. |
| ui:audit header standard | static | system | pass | All non-exempt pages use custom header/wrapper. |
| ui:audit table wrapper standard | static | system | pass | All table surfaces use shared wrappers/allowlist. |
| ui:audit stat-card standard | static | system | pass | All page-level metric cards use StatCard/allowlist. |