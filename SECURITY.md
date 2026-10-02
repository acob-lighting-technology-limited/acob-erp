# Security

Matrix holds staff and company data, so security issues are handled privately.

## Reporting a vulnerability

Email **ict@acoblighting.com** with the details. Please do not open a public issue
or discuss it in shared channels until it is fixed. Include what you found, how to
reproduce it, and what data or action it exposes.

## How the app is protected

- The Supabase anon key ships to every browser, so the **database is the security
  boundary**: row-level security on every table, column-level grants on tables
  with privileged fields, and `SECURITY DEFINER` functions limited to the roles
  that need them.
- Browser code only reads; every write goes through an authenticated `/api/` route
  that checks the caller's scope, validates the body with zod and writes with the
  service role.
- Scheduled jobs and device webhooks authenticate with a bearer secret compared in
  constant time.
- Rules for contributors are in [`AGENTS.md`](AGENTS.md) → *Database Security
  Standard*; the latest review is in
  [`docs/audit/`](docs/audit/2026-10-01-full-repo-critique.md).

## Secrets

Secrets live in Vercel and Supabase Vault — never in the repo, in migrations or in
SQL function bodies. If one is exposed, follow
[`docs/runbooks/security-key-rotation.md`](docs/runbooks/security-key-rotation.md).
