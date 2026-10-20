# Matrix — ACOB Lighting ERP

Matrix is the internal operations platform for ACOB Lighting Technology Limited
(<https://matrix.acoblighting.com>). One app covers the day-to-day work of every
department: attendance and leave, tasks and projects, performance reviews,
requisitions and payments, assets, correspondence, help desk, weekly reports and
the general meeting, and MD's Desk.

## Surfaces

| Surface | Path | Who |
|---|---|---|
| Staff app | `app/(app)/…` | Every employee — their own attendance, leave, tasks, reviews, requests |
| Admin console | `app/admin/…` | HR, finance, ICT and leadership, scoped by `admin_routes` |
| Department console | `app/dept/[dept_id]/…` | Department leads, locked to their department |

All three reuse the same feature components (`components/<feature>/`); the route
decides the scope, the API route decides what data that scope may see.

## Modules

Attendance (Hikvision terminal sync, appeals, exemptions, out-of-station) · Leave
(multi-stage approvals, balances, SLA) · Lunch (daily menu poll) · Tasks & Projects ·
PMS (KPIs, reviews, CBT, peer feedback) · Corporate scorecard · Requisitions &
Payments · Payroll · Assets · Inventory & Purchasing · Correspondence register ·
Help desk · Weekly reports, action tracker & KSS · Events calendar · MD's Desk ·
Policies & SOPs · Communications & notifications · AcoBot assistant.

## Architecture

```
Browser ──► Next.js 16 (App Router, React 19)
              ├─ Server components ──► Supabase (Postgres + RLS)
              └─ /api/* route handlers ─► Supabase via service role, after
                                           authorisation (lib/admin/api-scope)
Supabase ──► pg_cron / Edge Functions ─► /api/cron/* (bearer CRON_SECRET)
External ──► Hikvision terminal webhook · Microsoft Graph (OneDrive, Teams) ·
             Resend (email) · Web Push · Groq (AcoBot) · Upstash (rate limits)
```

Key rules (full list in [`AGENTS.md`](AGENTS.md)):

- **The database is the security boundary.** The anon key is public, so every
  table has RLS and every `SECURITY DEFINER` function is locked to the roles that
  need it. Browser code never writes to Supabase directly — it calls an `/api/`
  route that authorises, validates with zod and writes with the service role.
- **One component per screen** across staff/admin/dept, shared helpers in `lib/`
  (`lib/format.ts`, `lib/status-tones.ts`, `lib/api/*`), shared UI in
  `components/ui/` and `components/ui/patterns/`.
- **Every list page** uses `DataTablePage` + `DataTable`; every route has a
  `loading.tsx` skeleton.

## Tech stack

Next.js 16 · React 19 · TypeScript (strict) · Tailwind CSS v4 + shadcn/ui (Radix) ·
TanStack Query · react-hook-form + zod · Supabase (Postgres, Auth, Storage, Edge
Functions) · Resend · Vercel.

## Getting started

Requires Node 22+ and access to the Supabase project.

```bash
npm install
cp .env.example .env.local   # fill in the Supabase, Resend and site URL values
npm run dev                  # http://localhost:3000
```

The variables in `.env.example` marked **Required** are needed to sign in and load
data; the rest enable optional integrations (OneDrive, push, AcoBot, rate limits).

## Checks

```bash
npx tsc --noEmit -p tsconfig.json   # types
npm run lint:strict                 # ESLint, zero warnings
npm test                            # unit tests (node:test via tsx)
npm run test:e2e                    # Playwright (needs a running app + session)
```

The pre-push hook runs lint and type-check; CI (`.github/workflows/ci.yml`) runs
lint, type-check and unit tests on every pull request. Production builds run only
on Vercel — **do not run `npm run build` locally** (it competes with the dev
server for `.next/`).

## Database

Migrations live in `supabase/migrations/` and are the only way to change schema,
policies or grants. Check what is live before pushing:

```bash
npx supabase migration list
```

There is no staging database: every push hits production, so migrations are
reviewed first. Archived, non-migration SQL is in `supabase/archive/`.

## Repository layout

```
app/            routes — (app) staff, admin, dept, api, auth
components/     feature components and the shared UI kit (components/ui)
lib/            data access, domain logic, helpers (format, status tones, api)
hooks/          client hooks
supabase/       migrations, edge functions, archived SQL
scripts/        maintained tooling (see scripts/README.md); one-offs in scripts/archive
docs/           guides, runbooks, integrations, architecture, audits (see docs/README.md)
templates/      starting points for new pages that follow the house standards
```

## Contributing

Read [`AGENTS.md`](AGENTS.md) before changing anything — it is the single source
of truth for engineering standards, shared by every contributor and AI agent.
Commits follow `type: description` (conventional commits, lowercase, ≤72 chars).
