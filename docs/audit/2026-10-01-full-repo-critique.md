# Matrix (ACOB ERP): full repo critique, v2 (1 Oct 2026)

**Scope.** Every folder in the repo (about 300k lines of TypeScript, 289 pages, 363 API routes, 572 migrations, 175 live tables), plus the **live** `acob-erp` Supabase project. I inspected the live project read-only: advisors, RLS policies, column grants, function bodies, cron jobs and row counts. **Nothing was changed. No exploit was run.**

**Format.** Every finding has three parts: **Problem** (what is wrong), **Why it matters** (the real cost) and **Fix** (exactly what to do).

**Severity**
- 🔴 **Now.** Exploitable, broken, or wrong money.
- 🟠 **This month.** Real cost today.
- 🟡 **Cleanup.** Debt that makes every future change slower or makes the repo look amateur.

**Corrections to v1:** client components that write straight to the DB number **13**, not 28 (v1's grep also matched `Set.delete`). v1 also flagged three `dangerouslySetInnerHTML` uses; they render static print CSS, so they are safe and have been dropped.

## Remediation checklist key (added 2 Oct 2026)

Scope set by the user on 2 Oct 2026. Everything stays local: **no pushes to GitHub or Supabase**. Migrations are written but not applied.

- `[ ]` to do · `[x]` done locally · `[-]` out of scope (reason given)
- In scope: A1, A3–A6, A11, A12 (as part of §3/§5); A2 changed to "remove bank fields entirely"; A7 changed to "remove remote check-in"; all of §1, §2, §3, §5–§13.
- Out of scope: A8 (do not touch), A9 (leave), A10 (revisit), §4 Supabase platform (revisit), §14–§16 (narrative).

## Contents
- [A. Fix-first list](#a-fix-first-list)
- [1. UI (visual)](#1-ui-visual)
- [2. UX (will people understand it)](#2-ux)
- [3. Database](#3-database)
- [4. Supabase platform](#4-supabase-platform)
- [5. Backend / API](#5-backend--api)
- [6. Frontend / React](#6-frontend--react)
- [7. Data tables](#7-data-tables)
- [8. Skeletons and loading states](#8-skeletons-and-loading-states)
- [9. Reuse and duplicates](#9-reuse-and-duplicates)
- [10. Use a library instead of hand-rolling](#10-use-a-library-instead-of-hand-rolling)
- [11. Patches and workarounds](#11-patches-and-workarounds)
- [12. Modern practices: where you are vs. 2026 standard](#12-modern-practices)
- [13. Making the repo look professional to outsiders](#13-professional-presentation)
- [14. What went wrong (process)](#14-what-went-wrong)
- [15. Things you didn't ask about but should know](#15-recommendations)
- [16. Order of work](#16-order-of-work)

---

## A. Fix-first list

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [x] done — column grants + guard trigger + WITH CHECK; admin edits via API (85728bcc, migration 20261002100000) | A1 🔴 | **Any employee can make themselves super admin.** The `profiles` UPDATE policy allows `id = auth.uid()` with **no `WITH CHECK`**. `authenticated` holds UPDATE on *every* column, including `role`, `is_admin`, `admin_routes`, `admin_domains`, `is_department_lead`, `employment_status` and the bank fields. No trigger blocks role changes; `sync_profile_role_to_user_roles` even copies the new role into `user_roles`. `has_role()` reads `profiles.role`. So `supabase.from('profiles').update({role:'developer'}).eq('id', me)` from the browser console grants full access. | This is total compromise of the ERP by any staff member: payroll, HR records, every document. | Restrict UPDATE to safe columns with column grants (below). Move role, status, lead and admin-route changes to admin-only API routes that use the service role. Add a `BEFORE UPDATE` trigger as a second wall that raises if a non-service caller changes privileged columns. Then search `audit_logs` for past `profiles` updates where `changed_fields` contains `role`, and confirm nobody has already done this. |
| [x] done — bank fields removed from UI/API and dropped (migration 20261002100000) | A2 🔴 | **Employees can change their own bank account** (`profile-form.tsx` writes `bank_account_number` directly) with no approval and no alert. | This is the classic payroll-diversion fraud. A stolen session or a disgruntled employee changes the account before payday. | Turn bank changes into a **change request** that HR approves. Email the employee's *old* address whenever bank details change, and lock bank edits for 48h before a payroll run. |
| [x] done — EXECUTE revoked to service_role (migration 20261002100100) | A3 🔴 | **Any employee can approve their own leave.** `atomic_leave_approve_final`, `…_transition` and `…_reject` are `SECURITY DEFINER`, executable by `authenticated`, with no role or ownership check. | Leave approval is meaningless. | These functions are only called through `supabaseAdmin` ([leave/approve/route.ts:257,369](../../app/api/hr/leave/approve/route.ts)), so revoking is safe (SQL below). |
| [x] done — UPDATE policy dropped; API now enforces stage approvers, no self-approval, scoped list/detail (85728bcc) | A4 🔴 | **Any employee can edit any requisition.** The policy `users_update_requisitions` is `UPDATE … USING (true)`. | People can change amounts or approval status on money requests. | Replace it with an owner-only policy for drafts, and an admin/approver policy via `has_role('admin')` or the approver's id. Move approve/reject to an API route. |
| [x] done — 42 callers moved to server createNotification(); RPC + table INSERT locked (85728bcc) | A5 🔴 | **Anyone can send any employee a notification with any link.** Both `create_notification` overloads are callable by `authenticated` with a free `p_user_id` and `p_link_url`. `enqueue_asset_notification` is callable by **anon**, so no login is needed at all. | In-app phishing: "HR: re-confirm your bank details → link". Staff trust the bell. | Revoke from `PUBLIC, anon, authenticated` and grant to `service_role`. ⚠️ `create_notification` is called from **42 places** in 20+ API routes, and some use the user's session client. First route them all through one server helper using the service client (e.g. `lib/notifications/notify.ts`), *then* revoke. Otherwise those notifications silently stop. `enqueue_asset_notification` can be revoked from `anon` immediately. |
| [x] done — asset/dispatch RPCs service_role-only; dispatch route uses service client | A6 🔴 | **Asset and correspondence RPCs are open.** `atomic_assign_asset`, `release_asset` and `reassign_asset` are executable by any user. `release_asset`'s `COALESCE(…, auth.uid())` is *not* a permission check. `atomic_dispatch_correspondence` is also open. | Anyone can reassign company laptops or mark letters as dispatched. | Revoke the asset RPCs (they are called through the service client). `atomic_dispatch_correspondence` **is called with the user's client** ([dispatch/route.ts:65](../../app/api/correspondence/records/[id]/dispatch/route.ts)): switch that route to the service client first, *then* revoke. |
| [x] done — feature removed; columns + attendance_sites dropped (717a90c0, migration 20261002100200) | A7 🔴 | **Remote check-in cannot work.** `Permissions-Policy: geolocation=()` blocks geolocation for every origin, including your own. | Field staff cannot clock in remotely, and site-location capture in admin also fails. | [next.config.mjs:21](../../next.config.mjs): change `geolocation=()` to `geolocation=(self)`. |
| [-] do not touch (user) | A8 🔴 | **The 2026 PAYE calculation is likely wrong.** (a) It applies a flat ₦500k "static relief" to everyone. NTA 2025 rent relief is 20% of rent *paid*, capped at ₦500k. (b) `max(tax, 1% gross)` re-adds a minimum tax for individuals, overriding the 0% band. | Wrong deductions on every payslip. That is a legal and staff-trust issue. | [payroll-utils.ts:157-206](../../lib/hr/payroll-utils.ts): add a `rent_paid` input, compute `min(0.2*rent, 500000)`, remove the 1% floor for individuals, and move bands into a DB table with `effective_from`. Get a tax adviser to sign off 10 real cases and make them unit tests. |
| [-] leave (user) | A9 🔴 | **The service-role key is hardcoded** in `process_notification_queue` and `process_digest_schedules`. A guessable webhook secret (`acob_notification_trigger_secret_…`) is committed in `supabase/migrations/_fix_queue_secret.sql`. | Anyone with DB-function or git-history access holds god-mode keys. | Follow `docs/runbooks/security-key-rotation.md` now. Store both values in **Vault** (`vault.decrypted_secrets`) and read them in the function. Generate the new webhook secret with `gen_random_bytes(32)`. |
| [-] revisit later (user) | A10 🔴 | **Zero MFA enrolments** (`auth.mfa_factors` = 0), and leaked-password protection is **off**. | One phished admin password owns everything. | Dashboard → Auth → enable leaked-password protection. Require TOTP MFA for admin/HR/finance roles: check `aal2` in `requireApiAdminScope`. Better still, use Entra ID SSO (§15). |
| [x] done — lib/utils/random.ts (3fcd5e97) | A11 🟠 | **Credentials are generated with `Math.random()`** ([DispatchCredentialsDialog.tsx:38](../../components/employees/DispatchCredentialsDialog.tsx)). | `Math.random` is predictable and not meant for secrets. | Use `crypto.getRandomValues(new Uint32Array(n))` and map to the charset, or `crypto.randomUUID()`-based. |
| [x] done — constant-time compare, 600/min; URL token kept (device cannot send headers) (46697fb6) | A12 🟠 | **The device webhook leaks its secret.** The token travels in the query string (it lands in logs), the comparison is not constant-time, there is no replay protection, and the limit is **60/min per IP** behind one office NAT. | Clock-ins can be forged, and in the morning rush real swipes may get a 429. | Accept only the `Authorization` header and use your existing `safeCompare`. Add an event-id dedupe (unique index on device serial + event serial). Key the rate limit by device serial, not IP, and raise it to around 600/min. |

**SQL for A1/A3/A5/A6 (review first, then apply as a migration):**
```sql
-- A1: column-level lockdown (keep only what the profile form legitimately edits)
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (first_name, last_name, other_names, phone_number, additional_phone,
              residential_address, office_location, email_notifications, birthday,
              birth_year, job_description, job_description_updated_at, updated_at)
  ON public.profiles TO authenticated;
-- department, designation, bank_* move to an HR-approved change-request flow.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role('admin') AND (
       NEW.role IS DISTINCT FROM OLD.role OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
    OR NEW.admin_routes IS DISTINCT FROM OLD.admin_routes OR NEW.admin_domains IS DISTINCT FROM OLD.admin_domains
    OR NEW.is_department_lead IS DISTINCT FROM OLD.is_department_lead
    OR NEW.employment_status IS DISTINCT FROM OLD.employment_status) THEN
    RAISE EXCEPTION 'not allowed to change privileged profile fields';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_profile_privileged BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- A3/A5/A6: lock RPCs to the service role
DO $$ DECLARE f regprocedure; BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
    AND p.proname IN ('atomic_leave_approve_final','atomic_leave_approve_transition','atomic_leave_reject',
                      'create_notification','enqueue_asset_notification',
                      'atomic_assign_asset','release_asset','reassign_asset')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP; END $$;
```
⚠️ Before applying: (1) take `create_notification` out of this list until its 42 callers use the service client (see A5); (2) check every *server* caller of the other RPCs uses the service client, not the user's session; (3) confirm what `admin_routes` holds; (4) `profile-form.tsx` currently writes `department`, `designation` and bank fields from the browser, so update it (send those to an API route or change request) **in the same release** as the column grants, or profile saves will fail. Afterwards, verify with `BEGIN; SET LOCAL ROLE authenticated; … ; ROLLBACK;`.

---

## 1. UI (visual)

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [x] done — token 0.48; /50 placeholder patch reverted; /60–/80 opacity hacks removed (33c01051) | 1.1 🟠 | **Muted text is the same colour as body text.** Light-mode `--muted-foreground: oklch(0.25 0 0)` equals `--foreground`. | No visual hierarchy: descriptions, labels and captions shout as loudly as headings. The recent placeholder `/50` commit (`b1066f66`) patched one symptom. | In `app/globals.css` `:root`, set `--muted-foreground: oklch(0.52 0.01 75)` (still ≥4.5:1 on white). Revert the per-component `/50` patches. |
| [x] done — subtle accent; admin/lead shells use a 14% tint (33c01051) | 1.2 🟠 | **`--accent` is the brand green.** In shadcn, `accent` is the *subtle hover* surface. | Every ghost/outline button hover and every dropdown or select item highlight becomes **solid green with white text**. It reads as "selected" and not "hovered". | Set `--accent: oklch(0.955 0.03 142)` and `--accent-foreground: oklch(0.3 0.08 142)`, plus a dark equivalent (`oklch(0.25 0.03 142)` with light text). |
| [x] done — neutral secondary | 1.3 🟠 | **`--secondary` is also green.** | There is no neutral secondary button, so everything is green and primary actions don't stand out. | Use `--secondary: oklch(0.95 0.003 75)` and `--secondary-foreground: oklch(0.25 0 0)`. |
| [x] done — five distinct chart hues, light + dark | 1.4 🟠 | **`chart-1`, `chart-4` and `chart-5` are the same hue (142).** | Multi-series charts are unreadable. | Use five distinct hues at similar lightness, e.g. green 142, teal 185, blue 255, amber 70, rose 15. |
| [x] done — dark destructive readable | 1.5 🟠 | **Dark-mode destructive has poor contrast**: `--destructive` L=0.396 with a red foreground. | Delete buttons are hard to read. | `.dark`: `--destructive: oklch(0.58 0.22 27)` with `--destructive-foreground: oklch(0.985 0 0)`. |
| [~] partial — semantic tones + Badge variants + StatusBadge; codemod moved 124 files of status pills/text to tokens (6e76a302); 5,723→4,137 raw classes, remainder mostly sanctioned StatCard icon tints; attendance legend kept as a documented domain palette | 1.6 🟠 | **5,723 hardcoded palette classes** (`bg-green-100`, `text-amber-700`…) in 268 files, 165 raw hex values, and **1,349 `dark:` overrides** to compensate. | Changing the brand or fixing dark mode means editing about 7,000 places, and the colours drift across screens. | Add semantic tokens `--success`, `--warning`, `--info`, `--neutral`, each with `-foreground` and `-muted` variants, in `@theme`. You already have `components/ui/patterns/status-badge.tsx` (49 users): give it a status→tone map and make it the *only* way to colour a status. Add an ESLint `no-restricted-syntax` rule banning `/(bg\|text\|border)-(red\|green\|…)-\d{2,3}/` in `className`, then migrate folder by folder. |
| [x] done — 998 → 0 in owned files (42b455bc) | 1.7 🟠 | **998 uses of `text-[10px]`/`text-[11px]`.** | Unreadable on phones and on the 150%-scaled laptops your own CSS comment describes. External reviewers notice this immediately. | Make `text-xs` (12px) the floor. Find and replace `text-[10px]`/`text-[11px]` with `text-xs`, and ban arbitrary font sizes via lint. |
| [~] 234 exact pixel values moved to spacing-scale classes (a52d91f5); the ~600 left are text sizes, odd pixel values, grid templates and calc() expressions with no exact scale equivalent | 1.8 🟡 | **1,548 arbitrary values** (`w-[…]`, `h-[…]`, `max-w-[…]`). | Spacing doesn't follow the scale, and layouts feel "off" by a few pixels. | Use scale values. For the ones that repeat, add `@theme` tokens (`--spacing-sidebar`, etc.). |
| [x] done — tailwind.config.ts + tailwindcss-animate removed (86db252f) | 1.9 🟡 | **`tailwind.config.ts` is dead and wrong.** Tailwind v4 does not load it, and it wraps oklch vars in `hsl()`. | It misleads every contributor and agent, and breaks colours if anyone wires it with `@config`. | Delete the file, and remove the `tailwindcss-animate` dependency (you use `tw-animate-css`). |
| [x] reviewed every <img>: employee avatar → shadcn Avatar, letterhead logo → next/image. The rest are correct as raw img — email-signature HTML strings, next/og, blob/data URLs (QR, PDF previews), signed Storage URLs and arbitrary external thumbnails, which next/image cannot or should not proxy | 1.10 🟡 | **30 raw `<img>` vs 12 `next/image`**, and 16 lint disables for it. | Images are not resized or lazy-loaded, which costs egress and causes layout shift. | Use `next/image` (Supabase storage is already in `images.remotePatterns`). Keep `<img>` only in email or PDF renderers. |
| [x] fixed at the source: DialogContent is a bottom sheet below sm (full width, docked, grab handle, slide-up), so all 157 dialogs get it with no call-site change; desktop unchanged | 1.11 🟡 | **Modal-heavy**: 157 `DialogContent` vs 3 `SheetContent`, while AGENTS.md says a row tap opens a sheet. | Long forms in centred dialogs are cramped on phones. | You already have `ui/patterns/responsive-modal.tsx` (**1 user**). Make it Dialog ≥ md and **Drawer (vaul) < md**, then switch dialogs to it. |
| [x] each shell already redefines --primary (admin-shell, data-scope=lead, html:has fallback); the last hardcoded brand-green accents now use primary. Green that means success stays on the success tokens | 1.12 🟡 | **Three shell accents** (green user / amber admin / blue lead). | A good idea, but some components hardcode green and ignore the shell. | Make components read `--primary`, and have each shell redefine `--primary` (not a separate `--admin-primary`). |

## 2. UX

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [~] tiers live: bell badge counts only Needs-you items, FYI auto-read on open and dropped after 14 days, announcements moved to their own tab (3d442f1d); push limited to action items (016a26b3, needs migration 20261003100000). Email for action items still rides each module's own mailers | 2.1 🔴 | **Notifications are ignored.** 82% are unread overall. In the last 30 days, `approval_request` was unread **133 of 136** times and `task_awaiting_review` **206 of 207**. Announcements (816) and system messages (569) bury them. | Approvals stall, people blame the system, and adoption drops. | Introduce **tiers**. *Action* (approvals, reviews, overdue) gets push + email + a dedicated **"Needs you" inbox** with a count badge. *FYI* is bell-only and marked read when the list opens. *Announcements* go to a feed, not the bell. Auto-archive FYI after 14 days. |
| [x] Won't do (owner decision, 2026-10-03): /profile stays the landing page; the /home "My Day" page was built, then removed | 2.2 🟠 | **No "home" for a staff member.** Root redirects to `/profile`. | People have to hunt for what to do today. | Build a **"My Day" page** (§15) as the landing route. |
| [x] sidebars already filter by role; ⌘K search now finds every page the viewer can open (a5dfc186), with pinned favourites and recent pages (this commit); groups start collapsed except the active one | 2.3 🟠 | **The admin sidebar has 81 links** ([admin-sidebar.tsx](../../components/admin-sidebar.tsx), 1,197 lines). | Nobody can scan 81 items, so features are effectively invisible. | Show only the links a role needs. Add **⌘K command palette** (cmdk is installed), **pinned favourites**, and "recently visited". Collapse groups by default. |
| [~] HR dashboard data-health card: no department, departments without a lead, no sign-in in 30 days, each linking to the record. department_id NOT NULL waits until HR assigns the ~46 people the card lists | 2.4 🟠 | **Adoption gaps**: 61 of 119 users haven't signed in for 60+ days, and 47 of 117 profiles have no `department_id`. | People without a department fall out of routing, dashboards and KSS. | Build an admin "data health" card listing people with missing department, manager, or no login in 30 days. Make `department_id` NOT NULL once backfilled. |
| [~] 9 forms on react-hook-form + zod with one schema shared by form and route (invite user, supplier, funding category, portfolio, change password, attendance policy, new requisition; reset + set password now one shared NewPasswordForm); ApiError + applyServerErrors put server field errors under inputs. The remaining forms were checked against the actual faults this row names — lost input, no disabled state, no Enter-to-submit: Departments and Offices & Rooms allowed double submits (fixed, 22924373); the rest already keep input, disable while saving and submit on Enter, so converting them is churn. Project add/edit merged into one react-hook-form form with an end-after-start rule on the server too (18a531d1). Leave request: the Submit button now lists what is still missing, a retry after a failed upload no longer creates a duplicate request (57220ade), and the orphaned /hr/leave/request copy that skipped the balance and attachment checks now redirects (24f1f6e0). Create review needs nothing (scores clamp, text optional, save disabled until employee + cycle). Left: login and setup-account, deliberately untouched — everyone's way in | 2.5 🟠 | **Forms behave differently everywhere.** About 147 files hand-roll `useState` forms; 12 use RHF. | Different error messages and disabled states; input is lost after a failed submit; enter-to-submit only works sometimes. | Standardise on **react-hook-form + zod + shadcn `<Form>`** (§10). Share each schema between the client form and the API route. |
| [x] done — 96 icon buttons, 93 labelled; 3 left are in files with another session's uncommitted work (6587ef36) | 2.6 🟠 | **76 of 98 icon-only buttons have no accessible name.** | Screen readers say "button", and there is no tooltip for sighted users either. | Add `aria-label` plus `<Tooltip>`. Better: create `<IconButton label="…" icon={…}>` that *requires* `label`, and lint against raw `size="icon"`. |
| [x] providers/confirm-provider.tsx (7acbad31) | 2.7 🟡 | **9 native `confirm()`/`alert()` calls.** | They look like 1999 and break the design. | Use `<AlertDialog>`. Add a `useConfirm()` hook that returns a promise, so call sites stay one line. |
| [x] every locale-less toLocale* call moved to lib/format or an explicit en-NG locale (07610226); explicit-locale calls left are deterministic | 2.8 🟡 | **Dates are formatted by browser locale** (117 `toLocale*` calls). | One person sees `10/1/2026`, another sees `1/10/2026`. | Put one `lib/format.ts` behind `Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos' })` and ban `toLocale*` via lint. |
| [x] done — /admin/payroll/dummy already redirected; its unreachable 1,348-line view deleted | 2.9 🟡 | **A "Dummy payroll" page ships to admins.** | It is confusing, and it looks unfinished to an outsider. | Merge it into the calculator as a "Sandbox" toggle, or delete it. |
| [x] DataTable empty states use the shared EmptyState (3c95e76a) and take an emptyAction — wired on requisitions, projects, leave, resource booking and peer feedback; with filters active they offer Clear filters. The remaining "No data" strings are scorecard cell values, not empty lists | 2.10 🟡 | **Empty states.** `ui/patterns/empty-state.tsx` is used in 40 files, but many lists still render a bare "No data". | Users don't know what to do next. | Every empty state gets an icon, one sentence and **one primary action** ("Create your first requisition"). |
| [x] routes go through serverError(), which maps DB codes to plain text (now incl. bad format, too long, invalid date, timeout); the 2 remaining .message responses are Supabase Auth texts written for users (password rules, email in use) | 2.11 🟡 | **Errors are shown as raw DB messages** (177 routes return `error.message`). | Users see `duplicate key value violates unique constraint "…"`. | Map known codes to human text in `lib/api/errors.ts`, which already exists. |

## 3. Database

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [x] done (see A1–A6) | 3.1 🔴 | The holes in A1–A6. | | See A. |
| [x] done — customers/payroll_periods/salary_components/dept history admin-only (migration 20261002100100) | 3.2 🟠 | **`customers` (2,178 rows) is readable by every employee** (`USING true`). The same applies to `employee_department_history`, `payroll_periods`, `salary_components` and `action_items`. | Customer PII is exposed to all staff via the public anon key. That is an NDPA issue. | Scope SELECT to roles that need it (`has_role('admin')` or a commercial-department check). Config tables like `leave_types` and `holiday_calendar` can stay open. |
| [x] done — personal columns removed; definer kept by design (documented) | 3.3 🟠 | **`staff_directory` is a `SECURITY DEFINER` view** (linter ERROR) that exposes `additional_email` and `additional_phone` (personal contacts). | Personal contact data is visible to everyone. | Drop the two personal columns from the view, or recreate it `WITH (security_invoker = true)` over a narrow SECURITY DEFINER function that returns only work fields. |
| [~] partial — id backfilled, text column documented as trigger-maintained mirror; dropping it is a 200-file refactor, deferred; 46 profiles need HR to assign a department | 3.4 🟠 | **Two sources of truth for department**: `profiles.department` (text, "DEPRECATED") and `department_id`, synced by a trigger. 47 rows have no id. | Queries use either column, so results disagree. | Backfill `department_id`, switch all reads to the FK, drop the text column and the sync trigger. |
| [x] done — 126 FK indexes, 3 dup indexes dropped, 14 policy groups merged, initplan fixed (migrations 20261002100300/100400). Unused indexes kept (stats too young to trust) | 3.5 🟠 | **Performance debt**: 126 un-indexed FKs, 3 duplicate indexes, 46 unused indexes, 88 "multiple permissive policies", 3 `auth_rls_initplan`. | Slower joins and deletes. Every extra permissive policy is evaluated per row. | One migration: add FK indexes for the tables you actually query, and drop the duplicates (`idx_leave_requests_user` etc.). Merge permissive policies per role/action into one `USING (a OR b)`. Wrap `auth.uid()` as `(select auth.uid())` on `system_satisfaction_surveys`. |
| [-] migration 20261001120000 already written by another session; not applied (no Supabase pushes) | 3.6 🟠 | **`network_activity_logs` is 115 MB of the 268 MB DB.** | Backup size, egress and the free-tier ceiling. | Apply the pending SharePoint-archive migration (`20261001120000`) after review, and keep the 10-minute purge job. |
| [x] done — only 7 of 41 columns lacked a CHECK; 6 constrained (migration 20261002100500) | 3.7 🟡 | **45 `status`/`role`/`type` columns are free `text`.** | Typos become data, and UI filters miss rows. | Add `CHECK (status IN (…))` or a Postgres enum. Generated types then give you TS unions for free. |
| [x] done — moved to private schema | 3.8 🟡 | **Backup tables live in `public`** (`tasks_work_item_number_backup`, `deleted_tasks_archive`). | They are exposed through PostgREST and clutter the schema. | Move them to a `private` schema (not exposed), or drop them. |
| [x] done — legacy overload dropped, 2 trigger callers rewritten | 3.9 🟡 | **`create_notification` has 2 overloads** with different signatures. | PostgREST picks by argument names, so callers silently hit the legacy one. | Rename the old one `create_notification_legacy`, migrate callers, then drop it. |
| [x] done — stray files archived to supabase/archive; 001–006 baselines kept (registered live) | 3.10 🟡 | **Migration folder hygiene**: `001–006_remote_baseline.sql`, `_fix_queue_secret.sql` (no timestamp, holds a secret), a `migrations_backup/` folder, and old numbered SQL in `scripts/001…008`. | Confusing, and a fresh `db reset` may not reproduce prod. | Squash into one dated baseline taken from `supabase db dump`. Move the old files to an archive branch or tag. Prove a fresh local `supabase db reset` works. |
| [x] done — test cron jobs unscheduled; per-minute pollers are §4.4 (revisit) | 3.11 🟡 | **Cron sprawl**: the test jobs `weekly-digest-test-840pm` and `weekly-digest-tonight` still fire every **18 Feb**, and 3 jobs run **every minute**. | Surprise emails next February, and constant DB load. | Unschedule the two test jobs. Replace the per-minute pollers with a queue (§4.4). |

## 4. Supabase platform

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [-] revisit Supabase later (user) | 4.1 🔴 | No MFA; leaked-password check off. | | See A10. |
| [-] revisit Supabase later (user) | 4.2 🟠 | **Types cover 4 of 175 tables**, because [types/database.ts](../../types/database.ts) is hand-written. | This is why you have 214 `any`, 63 `as unknown as` and local row types everywhere. Typos in column names only fail at runtime. | `npx supabase gen types typescript --project-id itqegqxeqkeogwrvlzlj > types/supabase.ts`, then `createClient<Database>()`. Add a CI job that regenerates the types and fails on diff. |
| [-] revisit Supabase later (user) | 4.3 🟠 | **No staging database.** Every migration is a production experiment. | One bad migration hits real staff data. | Turn on **Supabase Branching** (a preview DB per PR), or a second "acob-erp-staging" project. Run migrations there first. |
| [-] revisit Supabase later (user) | 4.4 🟠 | **Background jobs run on 3 runtimes**: 8 Edge Functions, `pg_cron`+`pg_net` calling Next routes, and Next cron routes. Missing Vault secrets silently killed 8 jobs. | Hard to observe, and failures are silent. | Use **Supabase Queues (pgmq)** with one consumer, or Inngest/Trigger.dev, to get retries, DLQ and a dashboard. At minimum, have `app-reminders-health` alert by email when any job hasn't succeeded in N runs. |
| [-] revisit Supabase later (user) | 4.5 🟡 | 7 functions have a mutable `search_path`; `pg_net` and `btree_gist` live in `public`. | A search-path hijack vector, and the linter stays noisy. | `ALTER FUNCTION … SET search_path = public, pg_temp;` and `ALTER EXTENSION … SET SCHEMA extensions;` |
| [-] revisit Supabase later (user) | 4.6 🟡 | **Public buckets**: `requisition_documents` and `assets`. `payment_documents`, `help_desk_documents` and `assets` have **no size limit**. | Financial documents are reachable by URL, and one 2 GB upload eats your quota. | Make `requisition_documents` private and serve it with `createSignedUrl` (60 s). Set `file_size_limit` and `allowed_mime_types` on every bucket. |
| [-] revisit Supabase later (user) | 4.7 🟡 | **The `acob-crm` project is INACTIVE.** | Clutter and a confusing org. | Delete it, or document why it exists. |
| [-] revisit Supabase later (user) | 4.8 🟡 | **Realtime is almost unused** (2 channels), alongside 6 `setInterval` pollers. | Pollers waste egress, and data goes stale between polls. | Use Realtime for the notification bell and approval counters. Leave the rest to react-query `refetchOnWindowFocus`. |

## 5. Backend / API

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [x] done — 13 browser write sites moved to API routes; eslint allowlist removed (3a23986f) | 5.1 🟠 | **13 client components write directly to Supabase**: `profile-form.tsx` (profiles), `job-description/page.tsx` (profiles), `admin-employee-content.tsx` (profiles), `notification-bell.tsx` and `notification-content.tsx` (notifications), `pending-applications-modal.tsx` and `manage-users-dialog.tsx` (pending_users), `feedback-edit-modal.tsx`, `user-feedback-list.tsx` and `feedback-content.tsx` (feedback), `notification-preferences-form.tsx`, `tasks-content.tsx` (task_updates), `excel-import-dialog.tsx` (action_items). | These writes skip validation, audit logging and rate limits, and they force loose RLS. A1 exists *because* the profile form writes directly. | Route each one through an API route that uses zod and the service client. Then extend the ESLint `no-restricted-imports` rule for `@/lib/supabase/client` from `app/admin/**` to **all** client code (reads can stay where RLS is tight), and delete the "temporary allowlist" in `eslint.config.mjs`. |
| [~] mostly done — parseJsonBody() + zod on 33 of 41 unvalidated mutating routes; closed two mass-assignment holes (payments PATCH, SLA upsert). Left: onedrive, assets, meeting-artifacts send/sources, meeting-week-documents, 2 dev-only test routes (they coerce inputs with String()) | 5.2 🟠 | **Only 144 of 363 routes validate input with zod.** | Malformed input reaches the DB, and errors appear as 500s. | Add a `parseBody(req, schema)` helper returning a 400 with field errors, and use it in every POST/PATCH/PUT. A grep in CI can enforce it. |
| [x] done — 211 500s + 15 400/404 rewritten to serverError()/fixed text (08031334, d2bc22e0); Supabase Auth user-facing messages deliberately kept | 5.3 🟠 | **177 places return `error.message` to the client.** | They leak table, column and constraint names, and users see gibberish. | `return apiError(err)` from `lib/api/errors.ts`: log the detail with a request id and return `{ error: "Could not save", code, requestId }`. |
| [~] partial — access-policy deleted, 5 ensureAdmin copies → requireAdminRole, hasGlobalReportsWriteAccess → rbac | 5.4 🟠 | **Authorization has 6 modules**: `lib/permissions.ts`, `lib/role-management.ts`, `lib/admin/rbac.ts` (126 importers), `policy-v2.ts`, `api-guard-v2.ts`, and `access-policy.ts` (**0 importers**). **11 routes define their own `ensureAdmin()`.** | Six ways to answer "can they?", and they will disagree. | Keep `rbac.ts` + `api-scope.ts`. Delete `access-policy.ts`. Fold `permissions`, `role-management` and `policy-v2` into `rbac`. Replace the local `ensureAdmin` copies with `requireApiAdminScope`. |
| [~] notifications inbox capped; the job-descriptions list sent every column of every profile to the browser and now selects only the 11 it shows (dd07f128). Of the 151 select("*"), ~90 return one row after an insert/update and the 61 list-shaped ones are mostly small config tables (holidays, roles, categories) or tables absent in prod — narrowing those blind risks dropping a field a screen reads for little egress; do them when each route is next touched | 5.5 🟠 | **No caching**: 210 `force-dynamic`, 2 `unstable_cache`, 0 server actions, **219 `select('*')`**, 119 route files with unbounded queries. | This is your egress bill and slow pages. | Select explicit columns, add `.range()`/`.limit()` everywhere, and cache reference data (departments, offices, leave types) with `"use cache"` + `cacheTag`, revalidating on write (§12). |
| [x] done — lib/security/bearer-auth.ts (46697fb6) | 5.6 🟠 | **Cron-auth is copy-pasted.** `safeCompare` is defined in **10** cron/ingest routes. | A security primitive with 10 copies will diverge. | `lib/security/cron-auth.ts`: `export function requireCronAuth(req): Response \| null`, used by all 10. |
| [x] done (86db252f) | 5.7 🟡 | **Dead duplicate API**: `app/api/admin/accounts/*` is byte-identical to `app/api/admin/finance/*` and has zero callers. | Dead attack surface that confuses readers. | Delete `app/api/admin/accounts/`. |
| [x] done — dead csrf files deleted (middleware owns CSRF) | 5.8 🟡 | **`lib/csrf.ts` and `hooks/use-csrf.ts` have 0 importers.** | It looks like security that isn't there. | Delete them (`apiFetch` + SameSite=Lax covers you), or wire them into `apiFetch`. |
| [~] checked prod schema: swallows on existing tables removed (roles, suppliers, purchase_orders, department_payments, help-desk legacy, holiday created_by). The rest guard tables that DO NOT EXIST in prod — bills, invoices, products, product_categories, warehouses, stock_movements, goods_receipts — so Bills/Invoices/Inventory/Receipts are unbuilt modules that silently show empty. Your call: ship their migrations, or hide those routes | 5.9 🟡 | **Schema-drift swallowing**: 21× `if (error.code === '42P01') return []` and 9× `42703` fallbacks. | Hides missing tables/columns, so bugs look like "no data". | Remove them once types are generated (4.2) and staging exists (4.3). Missing tables should fail loudly. |
| [x] export-utils split by format into lib/export/* with a barrel (7600c381); leave/requests route split per method (0a7fe78b); leave-workflow.ts (978) is one cohesive module and stays | 5.10 🟡 | **Giant files**: `export-utils.ts` 3,206 lines, `leave/requests/route.ts` 1,617, `leave-workflow.ts` 978. | Hard to review and easy to break. | Split them by concern (`export/csv.ts`, `export/pdf.ts`, `export/xlsx.ts`, and leave `create`/`list`/`cancel` handlers delegating to `lib/hr/leave/*`). |
| [~] 69 console.* calls → lib/logger, no-console is a lint error (b87f8f32); Sentry needs a project/DSN you create (external account) | 5.11 🟡 | **77 `console.*` calls** although `lib/logger` exists; there is no error tracker. | Prod errors vanish. | Lint `no-console: error` outside scripts, and add Sentry (§10). |
| [x] done — Fisher–Yates shuffle (3fcd5e97) | 5.12 🟡 | **Biased exam shuffle**: `sort(() => 0.5 - Math.random())` in the CBT session route ([cbt/session/route.ts:405-431](../../app/api/hr/performance/cbt/session/route.ts)). | The shuffle is not uniform, so questions are unevenly likely in a *graded exam*. | Use a Fisher–Yates `shuffle()` in `lib/utils/random.ts`, with `crypto.getRandomValues`. |
| [x] done — last 12 messages, 4k chars each, schema-validated | 5.13 🟡 | **AcoBot has no cap on history length.** | Long chats cost tokens on every call. | Keep the last 12 messages and cap each at 4k characters. |

## 6. Frontend / React

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [~] the biggest offender split: attendance-manager-dialog 2,600 → 7 files ≤610 lines (8070d563), export-utils 3,200 → 5 modules, leave route 1,600 → per method. The ~35 left are single 1,000-line components; splitting them means extracting sub-components by hand and checking each screen — not safe blind | 6.1 🟠 | **40 files exceed 880 lines.** Top: `admin/hr/lunch/view.tsx` 2,917, `attendance-manager-dialog.tsx` 2,590, `admin-assets-content.tsx` 1,847, `department-documents-browser.tsx` 1,832. | Regressions breed here, and no reviewer can hold them in their head. | Split them into `_components/` + `_hooks/use-…-query.ts` + a pure `lib/` logic module. Target under 400 lines per file. |
| [x] every data load is a useQuery (≈40 commits, f56fa247…d61b0562); shared hooks: use-requisitions, use-performance-cycles, use-portfolios, use-hr-profiles, use-my-profile, use-weekly-report-*, use-department-code; lint rule is now an error. Remaining effects are real side effects (timers, auth hand-off, view tracking, debounced action) | 6.2 🟠 | **Two data-fetching styles.** React Query is in 109 files; 33 still `fetch` in `useEffect`; 281 `useEffect` calls in total. | Race conditions, no caching, and loading/error handled differently on every screen. | Everything goes through react-query hooks keyed from `lib/query-keys.ts` (which exists). The existing lint rule is a *warn*; make it an *error*. |
| [x] all React-19 hook rules on as errors. set-state-in-effect went 155 → 0 (02cc9ab2, 83042b82): seeded/derived state adjusts during render (lib/utils/deps-changed.ts), mounted flags and the mobile breakpoint use useSyncExternalStore (hooks/use-mounted.ts, hooks/use-mobile.ts), and the ~20 real external syncs (timers, localStorage, object URLs, window.location) carry a reasoned disable comment | 6.3 🟠 | **ESLint turns off the React-19 safety rules**: `purity`, `immutability`, `set-state-in-effect`, `static-components`, `error-boundaries`, `preserve-manual-memoization`, and `reportUnusedDisableDirectives: off`. | These rules catch real bugs: impure render, mutated state, effect loops. Turning them off hid the problems instead of fixing them. | Turn them back on as `warn`, fix them folder by folder, then switch to `error`. Set `reportUnusedDisableDirectives: "error"` to clear stale disables. |
| [~] compiler installed in opt-in annotation mode (75775a64). Now unblocked: the hook rules it depends on are all clean (6.3). Switching to infer mode compiles every component, so do it with a local click-through first | 6.4 🟠 | **1,150 manual `useMemo`/`useCallback`.** | Noise, and wrong dependency arrays (18 `exhaustive-deps` disables). | Enable the **React Compiler** (`reactCompiler: true` in next.config), then delete most manual memoisation over time. |
| [x] done — Radix toast removed | 6.5 🟡 | **Two toast systems**: sonner (222 files) and Radix toast + `hooks/use-toast` (2 files). | Inconsistent toasts. | Delete `components/ui/toast.tsx`, `toaster.tsx` and `hooks/use-toast.ts`; migrate the 2 callers to sonner. |
| [x] (3c904806) — editable/reorderable lists now keyed by stable ids; the remaining index keys are static skeleton/read-only arrays where an index is correct; Math.random ids already replaced (only visual animation randomness remains) | 6.6 🟡 | **70 `key={index}`** and 18 `Math.random` ids. | List items swap state when rows reorder. | Use stable ids; `crypto.randomUUID()` for temporary ones. |
| [x] done — 7 unused deps removed, @types → devDeps, dead hooks deleted | 6.7 🟡 | **Unused dependencies**: `@neondatabase/serverless`, `react-resizable-panels`, `embla-carousel-react`, `input-otp`, `@ai-sdk/openai`. `@types/*` sit in `dependencies`. `hooks/use-async-state.ts` is dead. | Bigger installs, and unused packages still raise security alerts. | `npx knip` and remove what it reports. Move `@types/*` to devDependencies. |
| [~] server prefetch + HydrationBoundary (lib/query/prefetch.ts) on the busiest staff pages that loaded in the browser: directory (6e1efbe6), weekly reports (6691c60c), action tracker (04f9663f), requisitions (e053a913) — each page's API logic moved into a shared server loader. Profile and notifications already loaded on the server. ~50 pages still fetch in the browser, mostly admin screens with few users; peer feedback and development plans are hidden from menus | 6.8 🟡 | **484 `"use client"` files**, often whole pages. | Larger JS bundles and slower first paint on phones. | Keep pages and layouts as server components that fetch data. Push `"use client"` down to the interactive leaf (filter bar, dialog). |
| [x] done (090548bc) | 6.9 🟡 | **No `.gitattributes`.** | Every diff warns about LF/CRLF and mixed endings. | Add `* text=auto eol=lf`. |

## 7. Data tables

What you have: `components/ui/data-table/data-table.tsx` (**1,952 lines**) plus `data-table-page.tsx`, used by **106 pages**. It is genuinely feature-rich (URL sync in 66 pages, mobile card/contacts view, column resize/reorder, row expansion, selection, a mobile detail sheet). The concept is good; the implementation and the edges are not.

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [~] split into focused files (data-table.tsx 2,000 → 192 lines; state, toolbar, table/card/contacts views, pagination, detail sheet; 884d4684), public API unchanged. Not on TanStack: an unused TanStack instance was removed in review (2026-10-04) — the engine is still the hand-written one | 7.1 🟠 | **A single 1,952-line component** holds filtering, sorting, pagination, column ordering, resizing, selection, mobile grouping, sticky offsets, the detail sheet, its own skeleton and its own empty state. | Every table bug fix risks all 106 pages, and nobody can review it. | Rebuild the internals on **TanStack Table v8** (headless: sorting, filtering, pagination, selection, column order/visibility/sizing are all built in) and keep your public `DataTableColumn`/`DataTableFilter` API as an adapter. Split the UI into `data-table/toolbar.tsx`, `desktop-table.tsx`, `mobile-list.tsx`, `detail-sheet.tsx` and `pagination.tsx`. |
| [~] blocked — every large table is already capped server-side (audit log newest 500, login logs 1,000, notifications 300, attendance per month); real paging with search/filters needs the RPCs changed (DB migration, not done) | 7.2 🟠 | **Everything is client-side.** Only **2** of 106 tables use `serverSide` pagination; the rest download whole tables. | Fine for 117 staff, but bad for audit logs (19.6k rows), notifications, attendance events and customers (2.2k). It drives egress and slow loads. | Any table that can exceed ~500 rows uses server pagination, sort and filter: the API accepts `?page&pageSize&sort&q&filters` and returns `{ data, total }`. TanStack Table supports this with `manualPagination` / `manualSorting`. |
| [~] a table with no pagination pages at 50 once it passes 200 rows. A virtual list for the grouped mobile view was tried and removed in review (broke sticky headers and expanded rows); still open | 7.3 🟠 | **No virtualisation.** | Rendering 2,000 rows freezes low-end phones. | Add `@tanstack/react-virtual` to the list body when rows exceed 200. |
| [x] (3c95e76a) | 7.4 🟡 | **Its own `TableSkeleton` (line 122) and `EmptyState` (line 1926)** duplicate `components/skeletons/table-page-skeleton.tsx` and `ui/patterns/empty-state.tsx`. | Two looks for the same state. | Import the shared ones. |
| [x] (3c95e76a) | 7.5 🟡 | **Dynamic Tailwind class** `min-w-[${minWidth}]` (line 1208). | Tailwind can't see runtime strings, so the class never exists (the inline style happens to cover it). That is a "looks fine, isn't" patch. | Delete the `className`; keep the `style`. |
| [~] reviewed all 27: the help-desk queue table was dead and is gone (87b0c4b9); most of the rest are legitimately raw — email/PDF/print layouts, invoice & PO line items, heat-map matrix, nested expanded rows, editable rows in dialogs. Left to move: EmployeeDetailTabs' record lists and the PMS table page | 7.6 🟡 | **Bypassers.** 13 files use raw shadcn `<Table>` primitives and 21 use raw HTML `<table>`, e.g. `payroll/calculator`, `help-desk/ticket-queue-table.tsx`, `EmployeeDetailTabs.tsx`, `admin/hr/departments/view.tsx`, `admin/hr/offices-rooms/view.tsx`, `pms-table-page.tsx`, `action-tracker`. | These lists look and behave differently (no search, export or mobile view). | Lists of records move to `DataTable`. Fixed-shape breakdowns (payslip lines, heat-maps, PDF templates) can stay raw tables. |
| [x] (3c95e76a) | 7.7 🟡 | **Row-click detection** uses `target.closest("[role='menuitem']")` chains (lines 1288 and 1758, duplicated). | Fragile: every new interactive cell needs another selector. | Stop propagation in interactive cells, or mark them with `data-row-click="ignore"` and check one attribute. |
| [x] the 3 users were not tables; moved to PageWrapper+PageHeader, both wrappers deleted (28ef2ec3) | 7.8 🟡 | **`AdminTablePage`** (4 users) is a parallel wrapper beside `DataTablePage` (106). | Two page shells. | Migrate the 4 and delete `components/admin/admin-table-page.tsx`. |
| [x] table-native CSV/XLSX/PDF export with filtered + sorted rows, RFC 4180 CSV protection and tests (5ed763f2) | 7.9 🟡 | **Export is per-page** via `lib/export-utils.ts` (3,206 lines) plus `AssetExportDialog` and `EmployeeExportDialog` (88% identical). | Every table re-implements export. | Have the table export its own `visibleColumns × filteredRows` to CSV/XLSX/PDF, driven by column `accessor`s. Delete the per-entity dialogs. |

## 8. Skeletons and loading states

What you have: a decent shared skeleton set in `components/skeletons/` (Table ×168, Form ×18, CardGrid ×18, Detail ×15, Dashboard ×12, Auth ×12), plus `ui/query-states.tsx` with `PageLoader` (13 users).

| Status | # | Problem | Why it matters | Fix |
|---|---|---|---|---|
| [x] done — 25 loading.tsx added (e51445f0); full-screen birthday/launch/lunch-share pages intentionally skipped | 8.1 🟠 | **42 pages have no `loading.tsx`**, including `/goals`, `/md-desk`, `/survey`, `/settings/*`, `/tools/media`, `/admin/payroll*`, `/admin/security*`, `/admin/md-desk`, `/admin/pms/goals` and `/lunch/[date]`. (Some are redirect-only, which is fine.) | A blank screen or a frozen previous page while the server renders. | Add `loading.tsx` for every non-redirect page, using the matching shared skeleton. Your `npm run ui:ensure-loading` script exists; run it in CI so it fails the build. |
| [~] each table route has a colocated _layout.ts used by both loading.tsx and the page (prop, or TablePageLayoutProvider for shared components; 63f8ea8e); DataTablePage warns in dev, once per page, when tabs, stat badges, back link, spacing or inline actions drift. Filters, columns and stat-card counts are not checked yet | 8.2 🟠 | **Skeletons drift from the real layout.** `TablePageSkeleton` has 12 props (`statCards`, `tabs`, `filters`, `statBadges`, `list`, …) that each page must keep in sync with its `DataTablePage` props by hand. Its own JSDoc warns "mirror it here or the page visibly jumps". | Layout shift when the real page loads, which looks cheap. | **Derive the skeleton from the same config.** Export a `pageConfig` (stats count, tabs, filters, view mode) from the page's `_lib`, and pass it to both `<DataTablePage {...config}>` and `<TablePageSkeleton {...config}>`. Or let `DataTablePage` render its own skeleton when `isLoading`. |
| [x] PageLoader now renders the page skeleton (cef37ee9), and the spinners that stood in for content are skeletons; the Loader2 uses left are inside buttons or show real in-progress work (file preview, imports) | 8.3 🟠 | **81 files show `Loader2` spinners**, some full-page. | Spinners feel slower than skeletons and cause layout jump. | Spinners only *inside buttons* while submitting. Content areas use skeletons; full pages use `loading.tsx` or a `<Suspense fallback={<XSkeleton/>}>`. |
| [x] done — components/skeletons.tsx barrel deleted | 8.4 🟡 | **Two barrels**: `components/skeletons.tsx` *and* `components/skeletons/index.ts`, exporting slightly different sets (`StatCardSkeleton` is only in the folder). | `@/components/skeletons` resolves to the *file*, not the folder, which is surprising and a trap for new code. | Delete `components/skeletons.tsx`. The folder's `index.ts` becomes the single barrel. |
| [x] ProfileSkeleton + NotificationListSkeleton in components/skeletons (fdb61ed8); remaining loading files are short and page-specific | 8.5 🟡 | **21 `loading.tsx` files hand-roll skeletons** (up to 90 lines, e.g. `(app)/profile/loading.tsx`) and 7 content files use `<Skeleton>` inline. | Duplicate shapes that drift from the page. | Add a `ProfileSkeleton` and `NotificationListSkeleton` to `components/skeletons/` and use them. |
| [x] removed the 3 loading.tsx identical to their nearest ancestor (which Next already inherits); the other copies sit under parents with a different shape (dashboard hub over table pages), so they are needed | 8.6 🟡 | **Many `loading.tsx` files are byte-identical** (34 share one body, 16 another, 10 another). | Not wrong, but it is noise. | Put one `loading.tsx` at the route-group level (e.g. `app/admin/hr/loading.tsx`) where children share the same shape, and delete the copies. |
| [~] the landing page's real cost was ~16 queries run one after another; profile now loads them in parallel (501afe16), as does admin assets (ff015849) — no other server page had the pattern. Per-section Suspense streaming not added: with the queries parallel, the page waits on its single slowest query | 8.7 🟡 | **No streaming.** Pages await all data before rendering anything. | The slowest query blocks the whole page. | Render the shell immediately, and wrap slow sections (stats, charts) in `<Suspense>` with section skeletons. |

## 9. Reuse and duplicates

### 9a. Near-duplicate files (line-level similarity I measured)

| Status | Sim. | Files | Fix |
|---|---|---|---|
| [x] done — components/reports/pptx-mode-dialog.tsx (bdf8b3be) | 93% | `(app)/reports/weekly-reports/_components/pptx-mode-dialog.tsx` ↔ `admin/reports/weekly-reports/_components/pptx-mode-dialog.tsx` | Move to `components/reports/pptx-mode-dialog.tsx` |
| [x] resolved — the dummy copy was unreachable dead code and is deleted | 88% | `admin/payroll/calculator/view.tsx` (1,439) ↔ `admin/payroll/dummy/view.tsx` (1,348) | One `PayrollCalculator` with `mode="live" \| "sandbox"` |
| [x] done — components/admin/export-columns-dialog.tsx | 88% | `components/assets/AssetExportDialog.tsx` ↔ `components/employees/EmployeeExportDialog.tsx` | Generic `ExportDialog<T>` (or table-native export, 7.9) |
| [x] done — components/payments/payment-detail-view.tsx (486de908); also fixed admin edit dropping payment_type | 85% | `(app)/accounts/payments/[id]/page.tsx` ↔ `admin/accounts/payments/[id]/page.tsx` | `components/payments/payment-detail.tsx` + `scope` |
| [x] done — DiagnosticsPanel (3 panels) | 82% | `admin/dev/tests/_components/HelpDeskRouteDiagnosticsPanel.tsx` ↔ `RouteDiagnosticsPanel.tsx` | One panel taking a route list |
| [x] (71fb6fad) bonus variant | 79% | `components/pms/cbt-question-manager.tsx` ↔ `admin/pms/cbt/extra/page.tsx` | The page renders the component |
| [x] done — components/admin/audit-stream-view.tsx (136666ea) | 77% | `admin/dev/role-escalations/…-content.tsx` ↔ `admin/dev/security-events/…-content.tsx` | One `SecurityLogViewer` with `source` prop |
| [x] one ProjectContent with an admin mode (f3d94843); admin gains lazy charts, avatars and the portfolio filter | 77% | `(app)/projects/project-content.tsx` ↔ `admin/projects/_components/project-admin-content.tsx` | Shared + scope |
| [~] data layer shared via hooks/use-requisitions (7110b7a3); screens still separate | 72% | `dept/[dept_id]/accounts/requisitions/…` ↔ `(app)/accounts/requisitions/page.tsx` | Shared + scope |
| [x] both files were unused — deleted (33842293) | 71% | `(app)/reports/weekly-reports/_components/weekly-report-filters.tsx` ↔ `admin/reports/action-tracker/_components/action-tracker-filters.tsx` | One `ReportWeekFilters` |
| [x] no logic left to share — both render the shared hub grid; the overlap is audience-specific card copy and links | 70% | `(app)/reports/general-meeting/page.tsx` ↔ `admin/reports/general-meeting/page.tsx` | Shared + scope |
| [x] one loadHelpDeskConsole(scope) (58f68be0); both routes are thin scope wrappers | 70% | `admin/help-desk/page.tsx` ↔ `dept/[dept_id]/help-desk/page.tsx` | Shared + scope |
| [~] dialogs, lock state, tracker status and seed queries now shared (96792b60, 59984ee6); the two table screens remain separate — their filters, permissions and exports genuinely differ | 66% | `admin/reports/weekly-reports/…-content.tsx` (691) ↔ `(app)/reports/weekly-reports/page.tsx` (828) | Shared + scope |
| [~] due-date/status/badge helpers and the lock query shared (5156013b, 96792b60); the two screens remain separate — staff has per-item edit rules the admin view does not | 65% | `admin/reports/action-tracker/…-content.tsx` (1,271) ↔ `(app)/reports/action-tracker/page.tsx` (1,229) | Shared + scope: **saves about 1,200 lines** |

**Root cause and the one fix for all of these:** each staff, admin and dept screen was built by copying. You already have `admin-scope-context` and `dept-scope-context`. Make one feature component per screen under `components/<feature>/`. Each route file (`app/(app)/…`, `app/admin/…`, `app/dept/…`) becomes about 10 lines that render it inside its scope provider. The API route decides what data that scope may see.

### 9b. Helpers redefined across files

| Status | Helper | Copies | Fix |
|---|---|---|---|
| [x] 14 wrappers identical to lib/format replaced (df2e1d2d); the rest are deliberate variants (2-digit day, weekday, long month) built on formatWATDate | `formatDate` | 23 | `lib/format.ts`: `formatDate`, `formatDateTime`, `formatTime`, `formatClockTime`, `formatMeetingDate`, all `en-NG` and `Africa/Lagos` |
| [x] done — 17 copies → lib/format (19a2a580) | `formatCurrency` | 8 (+13 inline variants) | `lib/format.ts`: `formatNaira(n, { compact? })` |
| [x] done — lib/admin/require-admin-role.ts | `ensureAdmin` | 11 | Delete; use `requireApiAdminScope` |
| [x] done — lib/security/bearer-auth.ts | `safeCompare` | 10 | `lib/security/cron-auth.ts` |
| [x] client copies → personName (eea624f6); server-side mail/notify helpers keep their own fallbacks | `formatName`/`displayName`/`employeeName` | 6/7/4 | `lib/people/name.ts`: `fullName(profile)` and `initials(profile)` |
| [x] eleven local colour maps → statusToneClass / draftToneClass with domain overrides in lib/status-tones.ts; off-token purples gone | `getStatusColor`/`statusLabel` | 6/4 (15 incl. variants) | `StatusBadge` + `lib/status.ts` map |
| [x] done — payments → lib/payments/department.ts | `normalizeDepartment` | 6 | `shared/departments.ts`, which already exists, so use it |
| [x] done — lib/admin/rbac.ts | `hasGlobalReportsWriteAccess` | 6 | `lib/admin/rbac.ts` |
| [x] done — lib/email-templates/utils.ts | `escapeHtml` | 5 | `lib/email-templates/utils.ts` (one copy exists there; import it) |
| [x] done — lib/pms/reviews.ts + tests; fixed staff/admin drift (0b89db93) | `pickCanonicalReview`/`reviewStatusPriority` | 4/4 | `lib/pms/reviews.ts`. This is **business logic** with 4 copies, so a bug fix will miss 3 of them. |
| [x] `lib/export/csv.ts` with RFC 4180, UTF-8 BOM and formula protection (5ed763f2) | `toCsv` | 4 | Table-native export (7.9) |
| [x] month-grid helpers → lib/utils/calendar-grid.ts (tested); the addDays variants take different input types (Date vs date string) on purpose | `buildCalendarCells`/`addDays`/`monBasedDay` | 4/4/4 | `lib/utils/date.ts` (exists), or `date-fns` (installed) |
| [~] capitalize + 5 formatPercent copies → lib/format (formatScore keeps unrounded scores); 4 getInitials variants left (different input shapes) | `capitalize`/`formatPercent`/`getInitials` | 5/5/5 | `lib/format.ts` |

**Prevent it from coming back:** add `jscpd` (copy-paste detector) to CI with a threshold of about 3%, and `knip` for unused exports.

### 9c. Shared components you built but barely use

| Status | Component | Users | Should be used by |
|---|---|---|---|
| [x] superseded — the base DialogContent is responsive now | `ui/patterns/responsive-modal.tsx` | 1 | Every form dialog (157) |
| [~] nearly every list is a DataTable with built-in paging; the few card grids left page their own | `ui/patterns/pagination-controls.tsx` | 1 | Every non-DataTable list |
| [~] ListToolbar built with shared URL sync (3b4187c7); only the department documents browser uses it so far | `ui/patterns/list-toolbar.tsx` | 1 | Card/grid pages with search |
| [~] DataTable renders query errors with retry for every table; card screens use QueryError | `ui/patterns/error-state.tsx` | 3 | Every query error |
| [~] PageLoader now renders the page skeleton for all its users; QueryError still used by 2 | `ui/query-states.tsx` | 12 | Every react-query screen |
| [x] done — deleted | `components/ui/empty-state.tsx` | **0** | Delete; `patterns/empty-state` is the real one |

## 10. Use a library instead of hand-rolling

| Status | Hand-rolled | Use | What you gain |
|---|---|---|---|
| [ ] | 1,952-line `DataTable` engine | **TanStack Table** + **TanStack Virtual** | Tested sort, filter, pagination, selection and sizing; server mode; virtual rows |
| [~] see 2.5 — forms with real validation needs converted or fixed; the rest already meet the bar | ~147 `useState` forms | **react-hook-form + zod + shadcn `Form`** (installed) | One validation UX, shared schemas, a11y wiring |
| [~] DataTable's urlSync already keeps search/filters/sort/page in the URL for every table; nuqs would type it — not added | Filter/tab state in components | **nuqs** | Type-safe URL state, shareable links, Back works |
| [ ] | Hand-written `types/database.ts` | **`supabase gen types`** | Typed queries; most `any` gone |
| [ ] | HTML-string email templates (`lib/email-templates/*.ts`) | **React Email** | Components, preview server, Outlook-safe output |
| [ ] | Every-minute cron pollers + custom retry | **Supabase Queues (pgmq)**, Inngest or Trigger.dev | Retries, backoff, DLQ, a dashboard |
| [x] see 2.8 | 117 `toLocale*` calls | **`Intl.DateTimeFormat`** helper or **`@date-fns/tz`** | Consistent dates for everyone |
| [x] providers/confirm-provider.tsx (7acbad31) | `confirm()`/`alert()` | **AlertDialog** + a `useConfirm()` hook | Consistent and accessible |
| [x] see 1.11 — done in DialogContent rather than a vaul Drawer per call site | Centred dialogs on phones | **shadcn Drawer** (vaul installed) | Native-feeling bottom sheets |
| [x] see 2.3 — folded into the existing ⌘K search rather than a second palette | Searching 81 sidebar links | **shadcn Command** (cmdk installed) | ⌘K palette |
| [ ] | A DB table for client errors | **Sentry** | Stack traces, releases, alerts, session replay |
| [x] lib/utils/random.ts | `Math.random` passwords/shuffles | **Web Crypto** (`crypto.getRandomValues`) | Secure, unbiased |
| [x] both recharts screens now read --chart-* / status chart tokens (project charts already did; login-log charts fixed) | Charts with ad-hoc colours | **shadcn Chart** (Recharts wrapper with `--chart-*` tokens) | Consistent, themed charts |
| [ ] | Password + OTP auth | **Microsoft Entra ID SSO** via Supabase Azure provider | MFA, offboarding and no passwords (§15) |
| [x] jscpd guard (threshold = today's 1.4%) + knip report in CI (5e679ec8); knip's 77 unused files deleted (33842293) | Copy-paste checks by eye | **jscpd** + **knip** in CI | Duplicates and dead code blocked automatically |

## 11. Patches and workarounds

These are places where a symptom was patched instead of fixing the cause. Outsiders read these as "nobody understood the system".

| Status | # | Patch | The real problem underneath | Proper fix |
|---|---|---|---|---|
| [x] done | 11.1 | Placeholder dimmed with `muted-foreground/50` (`b1066f66`) | `--muted-foreground` token is wrong (1.1) | Fix the token and revert the patch |
| [~] see 1.6: status colours are tokens; ~517 dark: overrides remain, mostly tinted icon chips where emerald means brand in some places and success in others, so they need a person's call per screen | 11.2 | 1,349 `dark:` overrides | Hardcoded palette instead of tokens (1.6) | Semantic tokens |
| [x] see 6.3 | 11.3 | 7 React-19 lint rules turned **off**, plus `reportUnusedDisableDirectives: off` | The code violates them | Re-enable and fix (6.3) |
| [~] 45 dead disable comments removed and reportUnusedDisableDirectives is now an error (bf1469eb); the ~30 left are justified (signed-URL <img>, intentional effect deps) or wait on generated types (no-explicit-any) | 11.4 | 89 `eslint-disable` comments (45 for `no-explicit-any`, 18 for `exhaustive-deps`, 16 for `no-img-element`) | Missing generated types, misuse of effects, raw images | 4.2, 6.2, 1.10 |
| [ ] | 11.5 | 63 `as unknown as` double-casts (10 in `lib/acobot/context.ts`) | Untyped Supabase results | Generated types (4.2) |
| [~] see 5.9 | 11.6 | 21× `42P01` and 9× `42703` "table/column missing → return empty" | Schema drift between code and prod, no staging | Staging + types, then remove (5.9) |
| [x] done | 11.7 | ESLint "**temporary allowlist**" for direct Supabase use in admin | Admin pages were never migrated to API routes | Migrate the 3 files and delete the block (5.1) |
| [x] (3c95e76a) | 11.8 | `min-w-[${minWidth}]` alongside inline `style` | A dynamic Tailwind class never generates | Delete the className (7.5) |
| [~] see 8.2 | 11.9 | `TablePageSkeleton` "mirror it here or the page visibly jumps" | Skeleton config duplicated by hand | Shared page config (8.2) |
| [x] done — 19 legacy routes → next.config redirects(); 2 dead views behind them deleted (2,467 lines) | 11.10 | **28 redirect-only `page.tsx` files** (`/hr/payroll→/payroll`, `/goals→/pms/kpi`, `/project→/projects`…) | Old routes kept as pages | Move them all into `next.config.mjs` `redirects()` (which exists) and delete the folders |
| [~] nonce CSP built (lib/security/csp.ts, proxy.ts, themed script nonce) behind CSP_NONCE=on, default off — one un-nonced inline script would blank the app, so test locally then enable in Vercel. 'unsafe-eval' stays for xlsx/jspdf/docx | 11.11 | CSP keeps `unsafe-inline` + `unsafe-eval` with "remove once Next supports nonces" | Next has supported nonces since 13.4 | Nonce CSP generated in `proxy.ts`. Lazy-load the export libraries so only export pages need `unsafe-eval`, or switch to eval-free builds |
| [ ] | 11.12 | `profiles.department` text plus a sync trigger | Department FK migration was never finished | Finish it (3.4) |
| [~] legacy overload dropped in migration 20261002100400 (unapplied) after callers moved to the 11-arg version | 11.13 | Two `create_notification` overloads | A new signature was added without removing the old | Consolidate (3.9) |
| [~] staff_directory slimmed to work fields in migration 20261002100100 (unapplied) | 11.14 | `security_definer` `staff_directory` view | Profiles RLS too tight for name lookups | A narrow definer function returning work fields only (3.3) |
| [-] Supabase/env config (revisit) | 11.15 | Rate limiter "falling back to in-memory — not suitable for production" | Upstash optional in prod | Make `UPSTASH_*` required in prod and fail closed |
| [x] still in use (2026 is the anniversary year); gated on isAnniversaryPeriod() so routes, cards and nav retire on 1 Jan 2027 (e92260df) | 11.16 | Anniversary signature tools ("temporary 10th anniversary") still routed | One-off campaign never removed | Feature-flag it or delete it |

## 12. Modern practices

Where you are vs. what a strong 2026 Next.js + Supabase codebase looks like.

| Status | Area | You today | 2026 standard | How to get there |
|---|---|---|---|---|
| [ ] | Rendering | 484 client files, 210 `force-dynamic` | Server Components by default, client leaves only | Move data fetching into `page.tsx`; pass data to small client components |
| [ ] | Caching | None | Next 16 **Cache Components**: `"use cache"`, `cacheTag`, `cacheLife`, `revalidateTag` on mutation | Enable `cacheComponents: true`; cache reference data and dashboards per scope |
| [ ] | Mutations | `fetch('/api/...')` + manual state | **Server Actions** + `useActionState` / `useOptimistic` (React 19) for forms; API routes kept for external callers | Start with simple forms (profile, preferences, feedback) |
| [~] see 6.4 | Memoisation | 1,150 manual `useMemo`/`useCallback` | **React Compiler** | `reactCompiler: true`, then delete over time |
| [ ] see 8.7 | Streaming | All-or-nothing pages | `<Suspense>` per section with skeletons | 8.7 |
| [ ] | Types | 4/175 tables typed, 214 `any` | Generated DB types + zod at every boundary + `noUncheckedIndexedAccess` | 4.2, 5.2 |
| [~] React-19 hook rules on (b0b49ae8), fetch-in-effect + no-console are errors; strict-type-checked waits on generated types | Lint | `core-web-vitals` only, hook rules off | `typescript-eslint` `strict-type-checked`, React-19 hook rules on, `no-console`, import sorting | 6.3 |
| [ ] | Data access | Mixed browser and server writes | All writes server-side; browser reads only where RLS is airtight | 5.1 |
| [ ] | DB security | App-layer checks, loose RLS/grants | RLS + column grants + `REVOKE … FROM PUBLIC` on every definer function, **tested in CI** | A + §14 |
| [ ] | Tests | 38 unit files, 4 e2e not in CI | Unit for logic, **pgTAP / SQL tests for RLS**, Playwright smoke tests per module in CI, **axe** a11y checks, visual snapshots | Start with RLS tests and 10 smoke flows |
| [ ] | Envs | Prod only | Local Supabase + preview branch DB per PR + prod | 4.3 |
| [ ] | Observability | DB-table logging | Sentry + Vercel logs/alerts + cron health alerts | 5.11 |
| [ ] | Background jobs | 3 runtimes, cron polling | Queue with retries/DLQ (pgmq, Inngest) | 4.4 |
| [ ] | Auth | Password/OTP, 0 MFA | SSO (Entra) + MFA (`aal2`) for privileged roles | A10, §15 |
| [x] dependabot.yml + knip/jscpd + npm audit in CI | Dependencies | Mixed pinning, no bot | Renovate + `npm audit` in CI + `knip` | §13 |
| [ ] | Design system | Tokens partly bypassed | Tokens-only colours, components documented on a `/design` page or Storybook | 1.6 |
| [x] icon buttons labelled (6587ef36), 12px floor and contrast tokens (1.7) | Accessibility | 76 unlabeled icon buttons, 10px text | WCAG 2.2 AA: labels, focus, 12px floor, contrast checks | 1.7, 2.6 |
| [~] PR template + commitlint; branch split is yours (13.7) | Commits/PRs | Mostly conventional, long-lived mixed branches | Small PRs, one feature per branch, squash-merge, PR template | §13 |

## 13. Professional presentation

What an outsider sees in the first five minutes, and how to fix it.

| Status | # | What they see | Fix |
|---|---|---|---|
| [x] done — README rewritten (c59cb1c5) | 13.1 | **The README is the default `create-next-app` text** ("You can start editing… `app/page.tsx`") | Rewrite it: what Matrix is, a screenshot, module list, architecture diagram (Next.js → API routes → Supabase; cron/queues; Microsoft Graph), local setup (`.env.example`, `supabase start`, seed), scripts, deploy, and links to `docs/`. |
| [-] account-level change — rename the GitHub repo yourself (GitHub redirects old URLs) | 13.2 | **The repo is named `ACOB-Signature-Creator`** for a full ERP called "matrix" | Rename the GitHub repo to `matrix` or `acob-matrix`; GitHub redirects old URLs. (Confirm before doing it; it is an account-level change.) |
| [x] done — business files untracked + .gitignore rules (a5ec5c73) | 13.3 | **A junk-drawer root**: `10 years aniversary.jpg`, PDFs, `spa_birthday_voucher*.html/pdf/png`, `*.docx`/`*.xlsx` inventories, a `~$…xlsx` lock file, `tmp-action-points.docx`, `tsconfig.tsbuildinfo`, tracked `test-results/`, `deno.lock`, `launch-video/` | Move business documents to SharePoint. `git rm` the clutter and add `.gitignore` rules (`~$*`, `*.tsbuildinfo`, `test-results/`, `*.docx`, `*.xlsx`, `*.pdf` at the root). |
| [x] done — docs/ restructured into guides/runbooks/integrations/architecture/audit; prompts + status dumps removed (c59cb1c5) | 13.4 | **`docs/` mixes runbooks with AI prompts** (`codex-hardening-prompt.md`, `codex-rate-limit-prompt.md`, `codex-renaming-directions.md`) and status dumps (`COMPLETION_SUMMARY.md`, `*_SUMMARY.md`) | Restructure as `docs/architecture/`, `docs/runbooks/`, `docs/modules/<module>.md` and `docs/adr/` (architecture decision records). Delete agent prompts and old summaries; git history has them. |
| [x] done — 70 one-offs → scripts/archive + README (95648bd7) | 13.5 | **`scripts/` holds 74 one-offs**: Python report generators, `fix_constraint.ts`, `fix_assets_constraint_final.js`, `001_create_tables.sql`, `__pycache__` | Keep maintained tooling in `scripts/` with a README. Move one-offs to `scripts/archive/` or delete them. |
| [~] untracked going forward (a5ec5c73); purging it from history needs a force-push — your call | 13.6 | **`supabase/backups/…email_wipe_rollback.sql` is tracked** (it holds staff emails) | Remove it from the repo and from history (`git filter-repo`), and store backups in private storage. |
| [ ] | 13.7 | **Five features in one dirty branch** (`perf/supabase-egress-network-archive`, 78 files) plus 4 unapplied migrations | Split into feature branches/PRs (attendance appeals, lunch share, profile activity, acobot model, egress). Apply or delete the migrations. |
| [x] done — AGENTS.md/CLAUDE.md aligned (0b0caa86); shortening AGENTS.md still open | 13.8 | **AGENTS.md (976 lines) contradicts CLAUDE.md** on building | Fix it (§14.1). Shorten to under 300 lines: hard rules first, details linked. |
| [x] PR template, SECURITY.md, dependabot.yml, and CODEOWNERS (@CMI-James, with security paths called out) | 13.9 | No `CODEOWNERS`, PR template, `CONTRIBUTING.md`, `SECURITY.md` or Renovate config | Add them. They are small files and big professionalism signals. |
| [x] header-max-length 72 already enforced by commitlint | 13.10 | Commit subjects longer than 72 characters (21 of the last 300) and mixed scopes (`style(sidebar)` vs `style(admin-sidebar)`) | Commitlint is already installed; add a `scope-enum` and `header-max-length`. |
| [x] done | 13.11 | `test:risk-register` exists but is **not in `npm test`**, so CI never runs it | Add it to the chain; better, glob `lib/**/__tests__/*.test.ts` in one script. |
| [~] anniversary tools + dummy payroll still routed (payroll files have another session's uncommitted work) | 13.12 | Leftover "temporary" anniversary tools and the "dummy" payroll in the nav | Remove or flag them (2.9, 11.16). |

## 14. What went wrong

This is about process, not blame.

1. **AI agents ran without one source of truth.** AGENTS.md says "Pre-push must pass `npm run build`. Confirm the build passes locally", while CLAUDE.md and the real hook say *never build*. AGENTS.md also says "always commit", yet 78 files are uncommitted. Codex, ChatGPT and Claude each followed different rules and each copied rather than reused. **Fix:** one short AGENTS.md, consistent with CLAUDE.md, enforced by CI (jscpd, knip, lint rules), not by prose.
2. **Breadth over depth.** Nearly 300 pages for 117 staff, but the core loops are not closed: approvals go unread, 61 accounts are dormant, and 47 people have no department. **Fix:** measure route usage, then merge or delete pages nobody opens. Finish fewer things better.
3. **Security lived in the app layer.** API routes check roles properly (`requireApiAdminScope` is good). The same powers were left open at the DB layer (A1–A6), which anyone can call directly with the public anon key. Your own AGENTS.md rules 4–5 describe this risk; nothing tested it. **Fix:** RLS and grant tests in CI.
4. **Symptoms were patched instead of causes** (§11).
5. **No staging and no generated types**, so drift appears as `42P01` swallows and `as unknown as`.
6. **Law and money were hardcoded** (tax bands in TypeScript constants).
7. **The repo doubled as a file share** (§13.3).

## 15. Recommendations

**Security and compliance**
- **NDPA 2023 (Nigeria Data Protection Act).** You hold bank details, dates of birth, addresses, customer PII, AcoBot logs with IPs and biometric-device swipe logs. **Fix:** a staff privacy notice, a retention policy (e.g. network logs 90 d, AcoBot 180 d, audit 7 y), a named data-protection contact, and a check on whether NDPC registration applies. Get a short legal review.
- **Point-in-time recovery + a tested restore.** **Fix:** enable PITR and do one restore into a branch DB each quarter.
- **A tamper-evident audit log.** **Fix:** add a `prev_hash`/`hash` chain column to `audit_logs`, and revoke UPDATE/DELETE on it from everyone except a break-glass role.
- **RLS/grant test suite.** **Fix:** `supabase/tests/*.sql` (pgTAP) asserting, for each sensitive table and RPC, that `SET ROLE authenticated` is denied. Run it in CI on a branch DB. It would have caught every item in §A.

**Product**
- **Microsoft Entra ID SSO.** You already use Graph, SharePoint and OneDrive. Staff log in with their M365 account, MFA comes from Entra, and disabling someone in M365 locks them out of Matrix. It also fixes the 7-day Safari cookie limit you documented and most password resets.
- **"My Day" home.** Clock-in status, things waiting on me (leave, requisitions, reviews, asset handovers), today's tasks, the lunch vote and who is away. Make it the landing page.
- **One approvals inbox** across leave, requisitions, assets and correspondence, with **one-tap approve/reject from email and push** (signed, single-use, expiring links).
- **WhatsApp Business notifications** for action-tier items only. HR already shares lunch links on WhatsApp.
- **Offline PWA attendance** for field staff: GPS check-ins queue offline and sync later (after A7).
- **Org chart** from `department_id` and lead data, and **self-service letters** (employment confirmation, visa or embassy letters) generated from profile data.
- **Bank-change approval flow** (A2), with a notification to the old email address.

**Payroll** (if this becomes real payroll)
- Tax tables in the DB with `effective_from`. Generate the PenCom pension schedule, NHF schedule, bank payment file and payslip PDFs. A signed-off test pack.

**Engineering**
- **Usage analytics per route** (Vercel Analytics is in; PostHog if you want funnels). Delete what nobody uses after 60 days.
- **Playwright + axe** in CI on 10 key flows, plus screenshot diffs.
- **Renovate + knip + jscpd** on every PR.
- **A `/design` page** (or Storybook) showing tokens, buttons, badges, the table, skeletons and empty states, so new screens copy the system and not each other.

## 16. Order of work

1. **Today (security):** A1 column grants + guard trigger, A3/A5/A6 revokes, the A4 requisitions policy, A7 geolocation, leaked-password protection on. Then check `audit_logs` for past `role` changes on `profiles`.
2. **This week:** rotate the service key and webhook secret into Vault (A9); MFA for admins (A10); private `requisition_documents` + size limits; the bank-change approval flow (A2); tax review (A8); `crypto` passwords (A11); webhook hardening (A12); split the dirty tree into PRs and resolve the 4 pending migrations; fix AGENTS.md.
3. **Next 2 weeks (foundations):** `supabase gen types` + CI drift check; staging branch DB; Sentry; theme token fixes (1.1–1.5); `lib/format.ts`, `StatusBadge` map, `cron-auth`; delete the dead code (accounts API, csrf, access-policy, toast, `tailwind.config.ts`, the unused `empty-state`, the skeleton barrel, unused deps); a README rewrite; root cleanup.
4. **This month (UX):** notification tiers + "Needs you" inbox; "My Day" home; role-based sidebar + ⌘K; `loading.tsx` for the 42 pages; skeleton-from-config; `IconButton` with a required label; `ResponsiveModal` everywhere.
5. **This quarter (structure):** merge the duplicate screens (§9a) behind scope; TanStack Table internals + server pagination for large tables; RHF everywhere; React Compiler + re-enable the hook rules; move 13 browser writes to the server; RLS test suite; Entra SSO.
