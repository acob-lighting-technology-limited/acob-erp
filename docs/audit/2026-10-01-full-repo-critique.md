# Matrix (ACOB ERP): full repo critique, 1 Oct 2026

Scope: the whole repo (about 300k lines of TS, 289 pages, 363 API routes, 572 migrations)
plus the **live** `acob-erp` Supabase project. I checked the live project read-only:
advisors, policies, grants, function bodies and row counts. Nothing was changed.

How severe each finding is:
- 🔴 **Fix this week.** Exploitable, breaks something, or wrong money.
- 🟠 **Fix this month.** Real cost now.
- 🟡 **Cleanup.** Debt that slows every future change.

How I checked: every 🔴 was confirmed against live DB state or by reading the code path.
I did **not** run any exploit. Anything I could not confirm is marked "verify".

---

## 0. The ten things to fix first

| # | | Problem | Where |
|---|---|---|---|
| 1 | 🔴 | **Any logged-in employee can approve their own leave.** `atomic_leave_approve_final`, `atomic_leave_approve_transition` and `atomic_leave_reject` are `SECURITY DEFINER`, executable by `authenticated`, and do no role or ownership check. One `supabase.rpc(...)` call from the browser console approves any leave request. | live DB, `/rest/v1/rpc/atomic_leave_*` |
| 2 | 🔴 | **Any employee can edit any requisition** (amount, status, approver). The RLS policy `users_update_requisitions` is `UPDATE … USING (true)`. | live DB, `requisitions` |
| 3 | 🔴 | **Any employee can send any other employee a notification with any link.** Both `create_notification` overloads are callable by `authenticated` with a free `p_user_id` and `p_link_url`. That is in-app phishing: *"HR: confirm your bank details → evil link"*. `enqueue_asset_notification` is callable by **anon**, so not even a login is needed. | live DB |
| 4 | 🔴 | **Remote check-in cannot work.** Your own header `Permissions-Policy: geolocation=()` blocks `navigator.geolocation` for every origin, including yours. `remote-checkin-modal.tsx` and the admin site-locations page both call it. | [next.config.mjs:21](../../next.config.mjs), [remote-checkin-modal.tsx:137](../../components/attendance/remote-checkin-modal.tsx) |
| 5 | 🔴 | **Payroll PAYE (2026 tax reform) is probably wrong in two places.** (a) Everyone gets a flat ₦500k "static relief". Under the Nigeria Tax Act 2025 this is *rent relief*: 20% of rent actually paid, capped at ₦500k. It is not automatic. (b) `max(tax, 1% of gross)` puts a minimum tax on individuals, which overrides the 0% band. Example: someone on ₦1.2M gross should pay ₦0 but is charged ₦12k. **Verify with your tax adviser.** | [lib/hr/payroll-utils.ts:157-206](../../lib/hr/payroll-utils.ts) |
| 6 | 🔴 | **The service-role key is still hardcoded in two live DB functions** (`process_notification_queue`, `process_digest_schedules`). Rotation is still deferred. Both functions also have a mutable `search_path`. Separately, the notification webhook secret is a guessable plain string committed to git in `supabase/migrations/_fix_queue_secret.sql`. Rotate it to a random value kept in Vault. | live DB, git |
| 7 | 🔴 | **Nobody uses MFA**: `auth.mfa_factors` has 0 rows, admins included. Leaked-password protection is also **off**. | Supabase Auth settings |
| 8 | 🟠 | **The attendance device webhook is weak.** The secret travels in the URL (`?token=`), so it lands in access logs. The comparison is not constant-time (`token !== secret`). There is no replay or timestamp check. The **60/min-per-IP** rate limit sits behind one office NAT, so a busy morning rush can 429 real clock-ins. | [hikvision/events/route.ts:335-350](../../app/api/devices/hikvision/events/route.ts) |
| 9 | 🟠 | **`requisition_documents` is a public bucket.** Financial documents can be opened by anyone who has the URL. `payment_documents`, `help_desk_documents` and `assets` have **no file-size limit**. | Storage |
| 10 | 🟠 | **The working tree is a mess**: 59 modified and ~19 untracked files on a branch named `perf/supabase-egress-network-archive`. They include attendance appeals, lunch share, profile and acobot work, none of it egress-related. **4 migrations are not applied live**: `20261001120000` … `150000`. One of them is the destructive network-log move. | git / `supabase_migrations` |

**Fix for #1 and #3:** the leave RPCs are only called from [app/api/hr/leave/approve/route.ts](../../app/api/hr/leave/approve/route.ts) through `supabaseAdmin`, which is the service role. So this is safe:
```sql
REVOKE EXECUTE ON FUNCTION public.atomic_leave_approve_final(uuid,uuid,int,text,text,int) FROM PUBLIC, anon, authenticated;
-- same for atomic_leave_approve_transition, atomic_leave_reject, create_notification (both), enqueue_asset_notification, atomic_assign_asset, release_asset
GRANT EXECUTE ON FUNCTION ... TO service_role;
```
⚠️ `atomic_dispatch_correspondence` is called with the **user's** client ([dispatch/route.ts:65](../../app/api/correspondence/records/[id]/dispatch/route.ts)). Do not revoke that one. Add an internal role check instead, or switch the route to the service client.
`release_asset` only *looks* guarded: `COALESCE(p_released_by, auth.uid())` is not a permission check.

---

## 1. UI (visual)

| | Finding | Evidence |
|---|---|---|
| 🟠 | **In light mode, muted text is not muted.** `--muted-foreground: oklch(0.25 0 0)` is the same value as `--foreground`. Every description, label and secondary line has the same weight as headings, so there is no visual hierarchy. The last commit (`b1066f66`, placeholder at `/50`) patched one symptom. Fix the token (~`oklch(0.5 0 0)`) and drop the patch. | [globals.css](../../app/globals.css) `:root` |
| 🟠 | **`--accent` is the brand green.** In shadcn, `accent` is a *subtle hover* background. Here, hovering any ghost or outline button, or highlighting any dropdown or select item, paints it **solid green with white text**. `--secondary` is green too, so you have no neutral secondary button. Set accent to something like `oklch(0.95 0.03 142)` with dark text, and make secondary neutral. | `dropdown-menu.tsx:84`, `select.tsx:247`, `button.tsx:15-17` |
| 🟠 | **Chart colours collide.** `chart-1`, `chart-4` and `chart-5` are all hue 142 (green), so multi-series charts are unreadable. Use 5 distinct hues. | `globals.css` |
| 🟠 | **Destructive buttons in dark mode have poor contrast**: `--destructive` at L=0.396 with a *red* foreground. | `.dark` |
| 🟠 | **5,723 hardcoded palette classes** (`bg-green-100`, `text-amber-700`…) across 268 files, plus 165 raw hex values. They bypass your tokens, which is why you need **1,349 `dark:` overrides**. Add semantic tokens (`--success`, `--warning`, `--info` + `-foreground` and `-muted`) and one `<StatusBadge status=…>`. | grep counts |
| 🟠 | **998 uses of `text-[10px]`/`text-[11px]`.** That is too small to read on phones and on the 150%-scaled Latitude screens you yourself documented. Make 12px the floor. | |
| 🟡 | **`tailwind.config.ts` is dead and wrong.** Tailwind v4 never loads it (there is no `@config`), and it wraps oklch variables in `hsl()`. It would break every colour if someone ever wired it up. Delete it, and the `tailwindcss-animate` dependency too (you use `tw-animate-css`). | |
| 🟡 | 1,548 arbitrary values (`w-[…]`, `text-[…]`). | |
| 🟡 | 30 raw `<img>` against 12 `next/image`. You lose resizing and lazy-loading, and pay for it in egress. | |
| 🟡 | 157 Dialogs but only 3 Sheets. `AGENTS.md` says a row tap opens a sheet and never a modal, but the app is modal-heavy. Long forms inside centred dialogs are painful on phones. | |

## 2. UX (will people understand it?)

| | Finding | Evidence |
|---|---|---|
| 🔴 | **People have learned to ignore notifications.** 5,898 of 7,193 notifications are unread (82%). In the last 30 days, **`approval_request` was unread 133 of 136 times** and **`task_awaiting_review` 206 of 207 times**. So approvals and reviews are *not* reaching people through the bell. Announcements (816) and "system" (569) drown out the ones that need action. | live `notifications` |
| 🟠 | **Adoption**: 61 of 119 auth users have not signed in for 60+ days. 47 of 117 profiles have **no `department_id`**, so department scoping, KSS rotation, approval routing and lead dashboards quietly miss those people. | live DB |
| 🟠 | **The admin sidebar has 81 links.** Nobody scans 81 items. See the recommendations section: role home, command palette, pinning. | [admin-sidebar.tsx](../../components/admin-sidebar.tsx) (1,197 lines) |
| 🟠 | **Forms behave inconsistently.** About 147 files build forms with `useState`, but only 12 use `react-hook-form`. Validation messages, field errors, disabled states and "lost my input after an error" differ from screen to screen. | |
| 🟠 | **76 of 98 icon-only buttons have no accessible name** (no `aria-label`, `title` or `sr-only`). Screen readers announce "button". | e.g. `calendar-view.tsx`, `lunch-content.tsx`, `BroadcastForm.tsx` |
| 🟠 | **Filters do not live in the URL.** You cannot share "this filtered view", and Back drops your filters. | |
| 🟡 | 9 native `confirm()`/`alert()` calls, even though `AlertDialog` exists (used in 40 places). | |
| 🟡 | A **"Dummy payroll"** page ships in admin (`/admin/payroll/dummy`). It is an 88% copy of the calculator. Is it a sandbox? Label it or remove it. | |
| 🟡 | **Dates render differently depending on the browser's locale**: 87 `toLocaleString` and 30 `toLocaleDateString` calls with no fixed locale or timezone, so one person sees `10/1/2026` and another `1/10/2026`. | |
| 🟡 | **The product has 4 names.** Repo `ACOB-Signature-Creator`, package `matrix`, domain `matrix.acoblighting.com`, Supabase `acob-erp`. New devs and agents get confused. | |

## 3. Database (schema and data)

| | Finding |
|---|---|
| 🔴 | The RPC grant holes in §0. In the live linter, 47 `SECURITY DEFINER` functions can be executed by `authenticated` and 3 by `anon`. Most are read-only predicates (`is_md`, `has_role`…), which is fine. The 8 that **write** are listed in §0. |
| 🟠 | **`customers`: 2,178 records readable by every employee** (`USING true`). Also open to every employee: `employee_department_history`, `payroll_periods`, `salary_components` and `action_items`. Customer PII should be readable by commercial/admin only. |
| 🟠 | **`staff_directory` is a `SECURITY DEFINER` view** (linter ERROR). It exposes `additional_email` and `additional_phone`, which are *personal* contacts, to all staff. Keep the view, but drop the personal columns or switch to `security_invoker` plus a narrow policy. |
| 🟠 | **Two sources of truth for department**: `profiles.department` (text, marked DEPRECATED in your own types) and `department_id`, kept in sync by a trigger. 47 rows have no id. Backfill, then drop the text column. |
| 🟠 | **Performance**: 126 FKs with no index, 3 duplicate indexes (`leave_requests`, `development_plans`, `development_plan_actions`), 46 unused indexes, 88 "multiple permissive policies" warnings (each extra policy runs on every row), and 3 `auth_rls_initplan` on `system_satisfaction_surveys` (wrap `auth.uid()` in `(select auth.uid())`). |
| 🟠 | `network_activity_logs` is **115 MB of the 268 MB DB (43%)**. The archive migration is written but not applied. |
| 🟡 | 45 `status`/`role`/`type` columns are free `text`. Use enums or `CHECK`, or typos become data. |
| 🟡 | Backup tables (`tasks_work_item_number_backup`, `deleted_tasks_archive`) live in `public`, so PostgREST exposes them. Move them to a `private` schema. |
| 🟡 | `create_notification` has 2 overloads. PostgREST overload resolution is fragile, and callers silently pick the old one. |
| 🟡 | `migrations/` contains `001-006_remote_baseline.sql`, `_fix_queue_secret.sql` (no timestamp, **holds a secret**), plus a `migrations_backup/` folder. Squash into one baseline. |

## 4. Supabase (platform and config)

| | Finding |
|---|---|
| 🔴 | No MFA anywhere; leaked-password check is off (§0). |
| 🔴 | Service-role key is in DB function source (§0). |
| 🟠 | **Your types cover 4 of 175 tables.** [types/database.ts](../../types/database.ts) is *hand-written* (profiles, departments, department_payments, office_locations). That is the root cause of the 214 `any`, the 45 `eslint-disable no-explicit-any` and the local row types everywhere. Fix: `supabase gen types typescript --project-id itqegqxeqkeogwrvlzlj > types/supabase.ts`, then fail CI when it drifts. |
| 🟠 | **There is no staging DB.** Every migration goes straight to prod. Use Supabase Branching or a second project. |
| 🟠 | **Stale cron jobs are still active.** `weekly-digest-test-840pm` and `weekly-digest-tonight` fire **every 18 February**. Three jobs run **every minute** (notifications, reminders, push) and poll even when there is nothing to do. |
| 🟡 | 7 functions have a mutable `search_path`. `pg_net` and `btree_gist` sit in `public`. |
| 🟡 | Background work runs on **three runtimes**: Edge Functions (8), `pg_cron`+`pg_net` calling Next routes, and Next cron routes. When Vault secrets went missing, all 8 jobs no-op'd silently. Pick one. Supabase Queues (`pgmq`) with one worker is the clean option. |
| 🟡 | The `acob-crm` project is INACTIVE. Delete it, or say what it is for. |
| 🟡 | Realtime is barely used (2 channels), while 6 `setInterval` pollers exist. |

## 5. Backend (API routes)

| | Finding |
|---|---|
| 🟠 | **28 client components write straight to Supabase** (`insert`/`update`/`delete`), skipping your API routes, audit logging and the AGENTS.md rule *"browser code never relies on loose RLS"*. Examples: `admin-employee-content.tsx`, `manage-users-dialog.tsx`, `communications-composer.tsx`, `unified-scorecard-hub.tsx`, `pms/reviews/[cycleId]/view.tsx`, `mail-digest-content.tsx`. Leftover `requisitions` policy holes like #2 exist *because* some screen once needed them. |
| 🟠 | **Only 144 of 363 routes validate input with zod (40%).** |
| 🟠 | **177 places send `error.message` back to the client.** That leaks table, column and constraint names to anyone poking the API. Log it server-side and return a generic message plus a code. |
| 🟠 | **Nothing is cached.** 210 routes/pages are `force-dynamic`, there are 2 `unstable_cache` and 0 server actions. Add **219 `select('*')`** and 119 route files with no `limit`/`range`. This is a direct line to your egress bill. |
| 🟠 | **Six permission modules**: `lib/permissions.ts`, `lib/role-management.ts`, `lib/admin/rbac.ts` (126 importers), `policy-v2.ts`, `api-guard-v2.ts`, and `access-policy.ts` (**0 importers**). Six ways to ask "can this user do X" means six ways to get it wrong. |
| 🟡 | **`app/api/admin/accounts/*` is a byte-identical copy of `app/api/admin/finance/*`, with zero callers.** Delete it. |
| 🟡 | **`lib/csrf.ts` and `hooks/use-csrf.ts` have 0 importers.** Either CSRF protection was never wired, or it was replaced (`apiFetch`) and these are dead. The `SameSite=Lax` cookie mitigates most of it, but delete or wire them. |
| 🟡 | Several `if (error.code === "42P01") return []` blocks (missing table → empty list) hide real failures. |
| 🟡 | Giant single files: `export-utils.ts` (3,206 lines), `leave/requests/route.ts` (1,617 lines in one route). |
| 🟡 | 77 `console.*` calls, although `lib/logger` exists. There is no error tracker (Sentry or similar). Client errors go into a Supabase table nobody watches. |
| 🟡 | AcoBot does not cap the number or length of messages per request, so a 200-turn history costs you on every call. It logs every Q&A *with IP address*, which needs a line in a privacy notice (see §11). The rest is good: system role stripped, auth, rate limit. |

## 6. Frontend (React / Next)

| | Finding |
|---|---|
| 🟠 | **Huge components**: 40 files over 880 lines. Top ones: `admin/hr/lunch/view.tsx` 2,917, `attendance-manager-dialog.tsx` 2,590, `data-table.tsx` 1,952, `admin-assets-content.tsx` 1,847. These are where regressions come from. |
| 🟠 | **Two data-fetching styles.** TanStack Query is used in 109 files, but 33 files still `fetch` inside `useEffect` with manual loading state. There are 281 `useEffect` calls in total and 18 `exhaustive-deps` disables, and those are stale-closure bugs waiting to happen. |
| 🟠 | **Helpers redefined everywhere**: `formatCurrency` in **21** files, `formatDate` in **29**, `getStatusColor` in **15**, `getInitials` in 5. |
| 🟡 | **Two toast systems**: sonner (222 files) plus Radix toast with `hooks/use-toast` (2 files). Remove Radix toast. |
| 🟡 | **Unused dependencies**: `@neondatabase/serverless`, `react-resizable-panels`, `embla-carousel-react`, `input-otp`, `@ai-sdk/openai`. `@types/*` packages sit in `dependencies` instead of `devDependencies`. Dead code: `hooks/use-async-state.ts`. |
| 🟡 | 484 `"use client"` files. Many whole pages are client-rendered when only a filter bar needs to be. |

## 7. Industry practice and process

| | Finding |
|---|---|
| 🔴 | **The agent rules contradict each other.** `AGENTS.md` (read by Codex, ChatGPT, Cursor) says *"Pre-push must pass `npm run build`. Confirm the build passes locally"*. `CLAUDE.md` and the actual hook say never build. It also says "always commit verified work", yet 78 files sit uncommitted. Agents following AGENTS.md will keep building and fighting your dev server. **Fix AGENTS.md** so it has one truth. |
| 🟠 | **Testing**: 38 unit-test files for 300k lines, and 4 Playwright specs that are not in CI. `test:risk-register` is missing from the `npm test` chain, so CI never runs it. There are no tests at all for RLS or grants, the class of bug in §0. Add a SQL test file that does `SET ROLE authenticated` and asserts denial. |
| 🟠 | **No error tracking, no uptime alerting.** You found the dead cron jobs and the 504 meeting-reminder miss by accident. |
| 🟠 | **CSP allows `unsafe-inline` and `unsafe-eval`.** The comment says *"remove once Next.js supports nonce-based CSP"*, but Next has supported nonces through middleware since 13.4, and you already have `proxy.ts`. `unsafe-eval` is only needed by the export libraries. Lazy-load them on the export pages and drop it everywhere else. |
| 🟡 | **No `.gitattributes`**, so every file warns `LF will be replaced by CRLF`. Add `* text=auto eol=lf`. |
| 🟡 | **The repo root is a junk drawer**: PDFs, `spa_birthday_voucher*.html/pdf/png`, `.docx`/`.xlsx` inventories, a `~$…xlsx` Office lock file, `tmp-action-points.docx`, `tsconfig.tsbuildinfo`, `test-results/` (tracked), `deno.lock`. The `.git` folder is 56 MB. Also, `supabase/backups/…auth_email_wipe_rollback.sql` is tracked and **contains staff emails (PII) in git history**. |
| 🟡 | **Branch hygiene**: one branch carries five unrelated features. Use one branch per feature, which `AGENTS.md` itself asks for. |
| 🟡 | Dependency version pinning is mixed (exact vs `^`). There is no Renovate or Dependabot. |

## 8. Where you should reuse instead of copying

Pairs I measured with line-level similarity:

| Similarity | File A | File B | Do this |
|---|---|---|---|
| 93% | `(app)/reports/weekly-reports/_components/pptx-mode-dialog.tsx` | `admin/…/pptx-mode-dialog.tsx` | Move to `components/reports/` |
| 88% | `admin/payroll/calculator/view.tsx` (1,439) | `admin/payroll/dummy/view.tsx` (1,348) | One component with a `mode` prop |
| 88% | `components/assets/AssetExportDialog.tsx` | `components/employees/EmployeeExportDialog.tsx` | Generic `<ExportDialog<T> columns=…>` |
| 85% | `(app)/accounts/payments/[id]/page.tsx` | `admin/accounts/payments/[id]/page.tsx` | Shared view + `scope` |
| 82% | `HelpDeskRouteDiagnosticsPanel.tsx` | `RouteDiagnosticsPanel.tsx` | One panel |
| 79% | `components/pms/cbt-question-manager.tsx` | `admin/pms/cbt/extra/page.tsx` | The page should render the component |
| 77% | `dev/role-escalations/…-content.tsx` | `dev/security-events/…-content.tsx` | One log viewer |
| 77% | `(app)/projects/project-content.tsx` | `admin/projects/_components/project-admin-content.tsx` | Shared |
| 72% | `dept/[dept_id]/accounts/requisitions/…` | `(app)/accounts/requisitions/page.tsx` | Shared |
| 70% | `(app)/reports/general-meeting/page.tsx` | `admin/reports/general-meeting/page.tsx` | Shared |
| 70% | `admin/help-desk/page.tsx` | `dept/[dept_id]/help-desk/page.tsx` | Shared |
| 65% | `admin/reports/action-tracker/…-content.tsx` (1,271) | `(app)/reports/action-tracker/page.tsx` (1,229) | **~2,500 lines → ~1,300** |
| 66% | `admin/reports/weekly-reports/…-content.tsx` | `(app)/reports/weekly-reports/page.tsx` | Shared |

**The pattern behind it:** staff, admin and dept versions of the same screen were each built by copying. You already have `admin-scope-context` and `dept-scope-context`. One component reading the scope from context would replace all of these. When you fix a bug in one copy, the others stay broken. That is the main source of "it works on admin but not for staff" bugs.

Also extract `lib/format.ts` (`formatCurrency`, `formatDate`, `formatDateTime`, `getInitials`, all pinned to `en-NG` and `Africa/Lagos`) and one `StatusBadge` with a status-to-token map. Together they replace about 65 local copies.

## 9. Use a library instead of hand-rolling

| You hand-rolled | Use | Why |
|---|---|---|
| 1,952-line `DataTable` (sort, paginate, filter, select) | **TanStack Table** (headless) + **TanStack Virtual** | You already use TanStack Query. It gives column visibility, pinning, grouping and virtualised rows. You keep your `DataTablePage` API on top. |
| `useState` forms ×147 | **react-hook-form + zod + shadcn `<Form>`** (both already installed) | One validation and error UX everywhere. The same zod schema can validate the API route. |
| Filters in component state | **nuqs** | Typed URL state: shareable links, and Back keeps filters. |
| `types/database.ts` by hand | **`supabase gen types`** | It is a one-liner and kills most `any`. |
| HTML-string email templates (`lib/email-templates/*.ts`) | **React Email** (`@react-email/components`) | Made for Resend. Components, preview server, and dark-mode handling built in. |
| Every-minute cron polling queues | **Supabase Queues (pgmq)**, or Inngest / Trigger.dev | Retries, backoff, a dead-letter queue and visibility. That is what your meeting-reminder retry design is rebuilding by hand. |
| `toLocaleString` ×117 | `Intl.DateTimeFormat('en-NG', {timeZone:'Africa/Lagos'})` in one helper, or `@date-fns/tz` (date-fns v4 is installed) | Same date format for everyone. |
| Native `confirm()` | shadcn **AlertDialog** (you have it) | |
| Ad-hoc mobile modals | shadcn **Drawer** (`vaul` is already installed) | Bottom sheets on phones. |
| Admin search | shadcn **Command** (`cmdk` is already installed) | ⌘K palette across all 289 pages. |
| Logging to a DB table | **Sentry** (free tier) | Stack traces, releases, alerts. |
| Hand-rolled rate limiter fallbacks | You already have Upstash. Make it required in prod and fail closed. | |
| Password + OTP auth | **Microsoft Entra ID SSO** (Supabase Azure provider) | You already use Graph and SharePoint (`lib/azure`, `lib/graph`, `lib/onedrive`). See §11. |

## 10. What you did wrong (process, not people)

1. **You ran several AI agents with no integration discipline.** Codex, ChatGPT and Claude each followed different rule files (they contradict each other), copied screens instead of sharing them, and left work uncommitted on the wrong branches. Most of §8 and §7 comes from this.
2. **You built for breadth, not depth.** Nearly 300 pages for 117 staff, but the loops are not closed: approvals go unread, 61 accounts are dormant, and 47 people have no department. A smaller set of modules that everyone uses beats 40 modules half-used.
3. **You trusted the app layer, then forgot the DB layer.** Routes check roles properly (`requireApiAdminScope` is good). But the same operations were exposed as `SECURITY DEFINER` RPCs and `USING(true)` policies that anyone can call directly. Your own AGENTS.md rules 4–5 say exactly this. It just was not enforced, because nothing tests it.
4. **You patched symptoms instead of tokens.** Muted text and the green hover show it: patched per-component (`/50`, `dark:` ×1,349, raw palette ×5,723) instead of fixing `globals.css` once.
5. **You have no staging environment and no RLS tests**, so every migration is a production experiment.
6. **You put tax law in code.** Bands and reliefs are hardcoded constants with comments. When the rules change you redeploy and hope.
7. **The repo doubles as a file share**: vouchers, memos, inventories and PII backups are tracked in git.

---

## 11. Recommendations: things you may not have thought of

**Security and compliance**
- **Nigeria Data Protection Act 2023 (NDPA).** You hold staff bank accounts, dates of birth, addresses, AcoBot Q&A with IPs, device swipe logs and 2,178 customer records. You likely need a privacy notice, a retention policy (for example, network logs 90 days and AcoBot logs 180 days), a named data-protection contact, and possibly NDPC registration given your data volume. Get a short legal read.
- **Turn on Supabase PITR** (point-in-time recovery) and **actually test a restore** once. A backup you have never restored is a hope, not a backup.
- **Make the audit log tamper-evident.** `log_audit` is callable by every user, though it pins the actor to `auth.uid()`, which is good. Add a hash-chain column so edits to `audit_logs` are detectable.
- **Add a DB security test suite**: one SQL file run in CI against a branch DB. For every sensitive RPC and table, assert that `SET ROLE authenticated` is denied. It would have caught all of §0.

**Product and UX**
- **SSO with Microsoft 365 (Entra ID).** You are already a Microsoft shop. Staff log in with their work account, you get MFA for free via Entra, and offboarding becomes automatic: disable them in M365 and they lose Matrix. This also fixes the 7-day Safari cookie problem you documented, and most password-reset tickets.
- **A "My Day" home screen** instead of `/profile`. One screen showing clock-in status, *things waiting on me* (leave, requisitions, task reviews, asset handovers), today's tasks, the lunch vote, and who is away. Your data says people miss approvals, so put approvals in their face.
- **A unified approvals inbox** with **one-tap approve/reject from email and push**, using signed, single-use action links. That is how you move `approval_request` from 2% read to most of them actioned.
- **WhatsApp Business API notifications.** HR already posts lunch links to WhatsApp, and in Nigeria WhatsApp beats email. Use it for approvals and overdue tasks only.
- **Notification tiers.** *Action* (push + email + WhatsApp), *FYI* (bell only, auto-read when seen), *Digest* (daily email). Today everything goes to the bell with the same weight.
- **A ⌘K command palette** plus pinned favourites and a role-based sidebar. The MD sees about 10 links, HR sees HR, and everyone else is behind search.
- **Offline-first attendance for field and site staff.** As a PWA with background sync, GPS check-ins queue when there is no signal. Fix #4 first.
- **An org chart page** generated from `department_id` and lead data. Cheap to build, and people love it.
- **Self-service employee letters** (employment confirmation, embassy or visa letter) generated from profile data with a signature. HR gets asked for these constantly.

**Payroll** (if it becomes real payroll, not a calculator)
- Move tax bands, reliefs and their effective dates into a **DB table**, not code.
- Generate the **pension (PenCom) schedule, NHF schedule and the bank payment file**, plus payslip PDFs (you have `payslip.ts`).
- Have a payroll professional sign off a test pack of 10 real salary cases. Make them unit tests.

**Engineering**
- **Measure before you build more.** Add per-route usage (Vercel Analytics is in, or PostHog for funnels). Delete or merge pages nobody opens in 60 days. With 289 pages, some are surely dead.
- **Supabase Branching for staging.** Every PR gets a DB branch and migrations run there first.
- **Playwright + axe** for accessibility checks, plus screenshot diffs on 10 key pages. That catches the token and contrast regressions in §1 automatically.
- **Renovate** for dependencies, and `knip` to find unused files, exports and deps on every PR.
- **One AGENTS.md, under 300 lines.** At 976 lines, agents skim it. Put the hard rules first and link the details.

---

## Suggested order of work
1. **Today:** run the REVOKE SQL from §0 (leave, notifications, asset RPCs) and fix the `requisitions` UPDATE policy. Change `geolocation=()` to `geolocation=(self)`. Enable leaked-password protection.
2. **This week:** rotate the service-role key and move it to Vault. Make the `requisition_documents` bucket private and use signed URLs. Get a tax review on the PAYE calc. Commit and split the dirty tree, and apply or abandon the 4 migrations. Fix AGENTS.md.
3. **This month:** set up `supabase gen types`, Sentry, MFA for admins (or Entra SSO), notification tiers and an approvals inbox. Fix the theme tokens (muted, accent, chart). Add a `StatusBadge` and `lib/format`.
4. **This quarter:** merge the duplicate screens (§8), move the DataTable onto TanStack Table, move forms to RHF, set up a staging branch DB and an RLS test suite.
