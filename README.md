# Matrix — ACOB Lighting internal ERP

Matrix is the internal staff portal and ERP for ACOB Lighting Technology Limited,
served at **https://matrix.acoblighting.com**. It is a private, sign-in-only
application for ACOB staff (`@acoblighting.com` / `@org.acoblighting.com`
accounts). It is not a public website, and nothing in this repo is meant for
anonymous visitors. The public company site is a separate project.

> The local folder may still be named `ACOB-Signature-Creator` — the app began as
> an email-signature tool. The repository is `acob-erp`.

## What it covers

| Area | Examples |
| --- | --- |
| HR | Attendance and clock-in, leave, onboarding, payroll, PMS and review cycles, CBT |
| Work | Tasks, projects, goals, weekly reports, meetings and KSS rotation |
| Operations | Help desk, assets and inventory, purchasing, payments, Starlink billing |
| Communications | Notifications (in-app, email, web push), correspondence, events calendar, MD's Desk, birthdays |
| Governance | Audit logs, policies and SOPs, risk register, corporate scorecard, security |
| Tools | Email signature creator and other staff utilities |

Staff-facing pages live under `app/(app)`; admin pages live under `app/admin`.
For how staff use the system, see [docs/MATRIX_USER_GUIDE.md](docs/MATRIX_USER_GUIDE.md).

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + shadcn/ui components
- **Supabase** — Postgres with RLS, Auth, Storage, Edge Functions (`supabase/functions`), `pg_cron`
- **Resend** for transactional email; **Upstash Redis** for rate limiting
- **Vercel** for hosting; `services/document-service` for PDF/OCR tooling

## Getting started

Requires Node 24 and access to the ACOB Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the values — ask ICT for secrets
npm run dev                  # http://localhost:3000
```

`.env.example` documents every variable. Only the Supabase, Resend and site-URL
groups are required to boot; the rest switch on optional integrations
(OneDrive, AcoBot, document service, help-desk SLAs, cron).

Never commit `.env.local` or any service-role key. See
[docs/SECURITY_KEY_ROTATION_RUNBOOK.md](docs/SECURITY_KEY_ROTATION_RUNBOOK.md)
if a secret leaks.

## Checking your work

Use the fast checks. **Do not run `npm run build` locally** — it takes several
minutes and fights the dev server for `.next/`. Vercel is the only place the
production build runs.

```bash
npm run type-check          # tsc --noEmit
npm run lint:strict         # ESLint, zero warnings allowed
npm test                    # unit test suites (tsx --test)
npm run test:e2e            # Playwright
```

Individual suites are available as `npm run test:<area>` (e.g. `test:attendance`,
`test:admin-scope`, `test:starlink`).

## Git workflow

- Branch from `main`; never push to `main` directly — the pre-push hook blocks it.
- Open a pull request; if one is already open for your work, push to its branch.
- Commits follow Conventional Commits (`commitlint`); `npm run commit` gives a prompt.
- Pre-commit runs `lint-staged` (ESLint + Prettier). Pre-push runs `lint:strict`
  and `type-check`. Never bypass hooks with `--no-verify`.

## Database

Schema changes are SQL migrations in `supabase/migrations/`. The live database is
the only environment — there is no shared dev database — so treat every push as
production.

- Check what is actually applied with `npx supabase migration list` (the
  `remote` column is the source of truth, not `git status`).
- Apply pending migrations with `npx supabase db push`.
- Edge functions live in `supabase/functions/` and are deployed with the
  Supabase CLI.

## Project conventions

[AGENTS.md](AGENTS.md) is the source of truth for engineering standards and UI
patterns — table pages (`DataTablePage` + `DataTable`), stat cards, typing,
commit grouping and migration rules. Read it before making changes. It applies
to human contributors and AI agents alike.

## Repository layout

```
app/            Routes — (app) staff pages, admin, api, auth
components/     Shared UI (components/ui = shadcn-based primitives)
lib/            Domain logic, grouped by area (hr, tasks, starlink, …)
supabase/       Migrations, edge functions, config
services/       Out-of-process services (document-service)
scripts/        Maintenance, audits, test campaigns
docs/           Runbooks, audits, implementation notes, user guide
tests/          Playwright end-to-end tests
```

## Access and support

Matrix accounts are provisioned by ICT; staff activate theirs at
`/auth/setup-account`. For access, bugs or questions, contact ACOB ICT.

This is proprietary software of ACOB Lighting Technology Limited. All rights reserved.
