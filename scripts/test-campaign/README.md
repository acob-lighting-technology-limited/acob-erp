# Comprehensive ERP Test Campaign Runner

This runner executes a full staging regression campaign and writes:

- `campaign-report.md` (prioritized bug report + route matrix)
- `campaign-report.json` (machine-readable findings and coverage)
- `route-inventory.json` (all `app/**/page.tsx` + `app/**/route.ts` classified)

## What It Covers

- Route inventory and classification (`public auth`, `employee app`, `admin`, `developer-only`, `api-only`)
- Seeded persona authentication matrix
- Preflight diagnostics (leave/help-desk/task prerequisites + RBAC deep audit)
- Route access checks (unauthenticated + role-based checks with real session cookies)
- Workflow E2E checks (leave/help-desk/task developer diagnostics with cleanup)
- RLS/RBAC negative checks (low-privilege write attempts)
- UI static checks (loading/skeleton coverage + modal responsive heuristics)

## Required Environment Variables

Core:

- `STAGING_BASE_URL` (for example: `https://staging.example.com`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Seeded users:

- `TEST_USER_DEVELOPER_EMAIL`
- `TEST_USER_DEVELOPER_PASSWORD`
- `TEST_USER_SUPER_ADMIN_EMAIL`
- `TEST_USER_SUPER_ADMIN_PASSWORD`
- `TEST_USER_ADMIN_EMAIL`
- `TEST_USER_ADMIN_PASSWORD`
- `TEST_USER_EMPLOYEE_EMAIL`
- `TEST_USER_EMPLOYEE_PASSWORD`
- `TEST_USER_DEPARTMENT_LEAD_EMAIL`
- `TEST_USER_DEPARTMENT_LEAD_PASSWORD`

Optional:

- `TEST_CAMPAIGN_OUTPUT_DIR` (default: `test-results`)

## Run

```bash
npm run test:campaign
```

Inventory-only mode:

```bash
npm run test:campaign:inventory
```
