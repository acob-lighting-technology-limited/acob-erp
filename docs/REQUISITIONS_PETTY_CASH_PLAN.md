# Requisitions: Payment Request + Petty Cash — Implementation Plan

Status: **approved, in progress** · 2026-10-13
Source forms: *ACOB Requisition Form.pdf* (Payment Request Form) and the
*Petty-Cash Voucher* sheet.

---

## 1. What we are building

`/accounts/requisitions` stays as the hub (no rename). "New requisition" asks
which form, then opens it.

| | Payment Request | Petty Cash |
|---|---|---|
| Reference | `REQ-2026-0001` | `PCV-2026-0001` |
| Amount allowed | **₦30,000 and above** | **Up to ₦50,000** |
| Outside range | Refused: "Under ₦30,000 — use Petty Cash" | Refused: "Over ₦50,000 — use a Payment Request" |
| Body | Project, purpose, amount, amount in words, site location (optional text) | Line items (S/N, description, amount); total and words computed |
| Beneficiaries | 1–4 (account name, account no, bank) | 1–2 |
| Funding category | Optional | Optional |
| Attachments | Optional | Optional |
| Sign-off | Reviewed → Authorized → Verified → Approved | Authorized → Approved |
| After sign-off | Processed (payment) | Processed (payment) |

The ₦30k–₦50k band may use either form. A boundary value is allowed on both
sides (₦30,000 on a Payment Request, ₦50,000 on Petty Cash).

---

## 2. Approval routes

### 2.1 Payment Request

| Requester's department | 1. Reviewed | 2. Authorized | 3. Verified | 4. Approved |
|---|---|---|---|---|
| Project, Technical, Operations & Maintenance | *Not required* | Own department lead | Accounts Lead | MD |
| Every other department | HR Lead | HCS | Accounts Lead | MD |

### 2.2 Petty Cash

| Requester | 1. Authorized | 2. Approved |
|---|---|---|
| Anyone | HR Lead | Own department lead |

### 2.3 Nobody signs their own request

Applied after the table above, in this order:

| Form | Requester | Change |
|---|---|---|
| Payment | Project / Technical / O&M lead | Authorized → **HCS** |
| Payment | HR Lead | Reviewed → *Not required* |
| Payment | HCS | Authorized → **MD** (MD then also approves) |
| Payment | Accounts Lead | Verified stays; Accounts Lead cannot sign it — MD's approval bypasses it |
| Payment | MD | Approved → *Not required (MD's own request)* |
| Petty cash | Any department lead | Approved → **HCS** |
| Petty cash | Admin & HR staff | Approved → **HCS** (HR Lead would sign twice) |
| Petty cash | HR Lead | Authorized → **HCS**, Approved → HCS fallback rule ⇒ **MD** |
| Petty cash | HCS | Approved → **MD** |

Role holders are resolved from department leads (reusing
`profileLeadsDepartment` in `lib/asset-mail-routing.ts`):
HR Lead = lead of *Admin and HR*; HCS = lead of *Corporate Services*;
Accounts Lead = lead of *Accounts*; MD = lead of *Executive Management*.

Assignees are **resolved at submission and stored on each stage**, so the
record shows who it was waiting on. An admin can reassign a pending stage
(person on leave / left). If a role has no lead at submission, the stage is
created unassigned and admins are notified.

### 2.4 Bypass

- Any assignee of a **later** stage may sign while earlier stages are pending.
  Every earlier pending stage becomes **Bypassed** (by whom, when).
- A comment is optional.
- The skipped assignees get a notification.
- The old **Emergency** route is removed. Past emergency requisitions keep
  their badge and history.

### 2.5 Reject

The current assignee, or any later assignee, may reject. A reason is
compulsory (as today).

### 2.6 Amount changes

- Any signer may change the amount while signing. **Reason compulsory.**
- Petty cash: they edit line amounts; the total is recomputed.
- Several beneficiaries: the split must add up to the new total.
- Amount in words is regenerated. The original requested amount is kept.
- Timeline shows "₦X → ₦Y by <name>: <reason>". Requester is notified.
- Petty cash cannot be raised above ₦50,000.
- A Payment Request *may* be reduced below ₦30,000 (it was valid when raised).

### 2.7 Processed By (payment)

Not a chain stage — it follows the final approval.

- **Payment processors** are set in admin settings (Simon now). The
  **Accounts Lead is always a fallback** processor.
- Fully signed ⇒ status **Awaiting payment**; processors are notified.
- **Mark as paid**: date, method (transfer / cash), reference, optional
  receipt. Pre-filled with the outstanding amount.
- Payments are stored as a list: a smaller amount ⇒ **Partly paid
  ₦X of ₦Y**; reaching the total ⇒ **Paid**. Overpaying is blocked.
- A processor cannot change the amount — they send it back to a signer.
- A processor cannot process their own request ⇒ Accounts Lead.
- Requester is notified on every payment.

### 2.8 Statuses

`pending` → `awaiting_payment` → `partly_paid` → `paid`, or `rejected`.

---

## 3. Signing security

Every signer and every processor must have, before their first action:

1. **A signature image** — upload (PNG/JPG) or draw on screen. Stored in a
   new **private** `signatures` bucket; served only through short-lived
   signed URLs into the detail view and the PDF.
2. **A 6-digit approval PIN.**

Every sign / reject / bypass / amount change / payment requires the PIN in
the same request.

- Stored only as a salted `scrypt` hash (Node built-in — no new package).
  Unreadable by anyone, admins included.
- Verified on the server, inside the action's own route. The PIN travels with
  the action, so it confirms exactly that action.
- 5 wrong attempts ⇒ locked 15 minutes. Attempts and lockouts are audit-logged.
- **Forgot PIN** ⇒ 6-digit code to the person's own email (10-minute expiry,
  hashed, single use). Admins cannot set or reset someone's PIN.
- Without a signature and PIN the action buttons say what is missing and link
  to the setup page.

Setup lives at **Profile → Signing setup**.

**Passkeys (Face ID / fingerprint)** are a separate follow-up: Supabase
passkeys enabled once for both login and approvals, PIN kept as the backup.
Not in this release.

---

## 4. Problems in today's code this work fixes

Found while reading the current implementation. These are fixed as part of
this work, the way `docs/audit/2026-10-01-full-repo-critique.md` describes:

1. **Any logged-in user can approve any stage.**
   `app/api/requisitions/[id]/approve/route.ts` never checks that the caller
   is the stage's approver (only emergency requisitions are gated).
2. **Any employee can edit any requisition** — RLS `users_update_requisitions`
   is `UPDATE … USING (true)` (audit #2).
3. **Any employee can read every requisition, bank details included** —
   `users_select_requisitions` is `SELECT … USING (true)`.
4. **`requisition_documents` bucket is public** (audit #9).
5. **Requester notifications are probably being dropped.** The route sends
   `requisition_rejected` / `requisition_approved` / `requisition_stage_passed`,
   which are not in `notifications_type_check` as of the repo's latest
   migration, and the insert error is swallowed.
6. **Every new requisition notifies every admin and every department lead**,
   not the person whose stage it is.

Items 1–4 are security holes. **Live check 2026-10-13: production has 0
requisitions and 0 help desk tickets** — the feature has never been used — so
they are fixed by the rebuild itself rather than patched in the old route.

---

## 5. Data model

One migration. The live `requisitions` table is empty (checked 2026-10-13),
so old columns are dropped instead of kept for compatibility.

**`requisitions` (existing) — add / change**
- `form_type text not null default 'payment_request'`
  check in (`payment_request`, `petty_cash`)
- `site_location text null`
- `line_items jsonb not null default '[]'` (petty cash: `{description, amount}`)
- `original_amount numeric(12,2) not null`
- `amount_paid numeric(12,2) not null default 0`
- `project_name`, `purpose` → nullable, with a check that a Payment Request has them
- `status` check becomes `pending, awaiting_payment, partly_paid, paid, rejected`
- `requisition_number` set by a `BEFORE INSERT` trigger from a per-year
  counter (see **Numbering** below); the old column default and
  `requisition_number_seq` are dropped
- checks: petty cash ≤ 50,000 on insert; payment request ≥ 30,000 on insert
  (enforced in the API, as amount changes may later move it)
- **dropped:** `reviewed_* / authorized_* / verified_* / approved_*`,
  `rejected_*`, `current_stage_code`, `is_emergency`,
  `emergency_justification`, `bypassed_stages` (replaced by
  `requisition_stages`); `rejection_reason` kept

**`requisition_stages`** (new) — one row per stage
`id, requisition_id, position, stage_code (reviewed|authorized|verified|approved),
role_label, assignee_id, state (pending|signed|bypassed|not_required|rejected),
acted_by, acted_at, comments, bypassed_by_stage_id`

**`requisition_amount_changes`** (new)
`id, requisition_id, stage_id, changed_by, old_amount, new_amount,
old_line_items, new_line_items, old_beneficiaries, new_beneficiaries,
reason not null, created_at`

**`requisition_payments`** (new)
`id, requisition_id, amount > 0, paid_on, method (transfer|cash), reference,
receipt_path, recorded_by, created_at`

**`requisition_payment_processors`** (new) — `profile_id pk, added_by, created_at`

**`approval_signing_credentials`** (new) — one row per user
`user_id pk, signature_path, pin_hash, pin_set_at, failed_attempts,
locked_until, updated_at`. Self-SELECT only, with `pin_hash`,
`failed_attempts` and `locked_until` column-revoked from `authenticated`.

**`approval_pin_reset_codes`** (new) — `user_id, code_hash, expires_at, used_at`.
No policies for `authenticated`; service role only.

**RLS (all tables, per AGENTS.md Database Security Standard)**
- `requisitions` SELECT: requester, any stage assignee, payment processors,
  admin-like. Drop the `USING (true)` SELECT and UPDATE policies.
  All writes go through API routes with the service-role client.
- Child tables: SELECT follows the parent; no INSERT/UPDATE/DELETE for
  `authenticated`.
- `requisition_documents` bucket → private; signed URLs.
- Any `SECURITY DEFINER` helper gets `REVOKE EXECUTE … FROM anon, PUBLIC`.
- Verified after push with `SET LOCAL ROLE anon` / a plain employee.

**Numbering** (decided 2026-10-13)
- Format `REQ-YYYY-NNNN` / `PCV-YYYY-NNNN`, each form its own counter,
  restarting at 0001 every January. Grows to 5 digits only past 9,999.
- `requisition_number_counters (form_type, year, last_value)`, primary key
  `(form_type, year)`. The trigger does
  `INSERT … ON CONFLICT DO UPDATE SET last_value = last_value + 1 RETURNING`,
  which is atomic, so concurrent submissions cannot collide. Year is taken in
  `Africa/Lagos` time so a 31 Dec 11:30pm request is numbered in that year.
- Counter table: RLS on, no policies for `authenticated` — only the trigger
  writes it.
- No existing rows to renumber: the first real reference is `REQ-2026-0001`.


---

## 6. Code layout

**`lib/requisitions/`**
- `routing.ts` — pure `resolveStages(formType, requester, roleHolders)`
  implementing §2.1–2.3. Unit-tested.
- `limits.ts` — `PAYMENT_REQUEST_MIN = 30_000`, `PETTY_CASH_MAX = 50_000`,
  form-choice messages.
- `actions.ts` — sign / bypass / reject / amount change, with row locking
  (`SELECT … FOR UPDATE` via RPC) so two signers can't race.
- `payments.ts` — record payment, recompute `amount_paid` / status.
- `signing.ts` — PIN hash / verify / lockout / reset codes; signature upload.
- `export.ts` — list export (ExportOptionsDialog).
- `workflow.ts` — emergency code removed; stage labels kept.
- `schemas.ts` — zod for every route; the two inline duplicate schemas in
  `app/api/requisitions/route.ts` replaced by these.
- `__tests__/` — routing table, self-sign rules, bypass, limits, payments.
  New `test:requisitions` script.

**API routes** (zod on every body, service-role writes, audit log on every action)
- `POST /api/requisitions` — both forms
- `POST /api/requisitions/[id]/act` — `{action: sign|reject, pin, comments,
  amount_change?}` (replaces `/approve`; old route returns 410)
- `POST /api/requisitions/[id]/payments` — `{amount, paid_on, method, reference, receipt?, pin}`
- `PATCH /api/requisitions/[id]/stages/[stageId]` — admin reassign
- `GET/POST/DELETE /api/requisitions/payment-processors` — admin
- `/api/me/signing` — signature upload, set/change PIN, request + confirm reset

**Screens** (one component per screen across staff / admin / dept)
- **List** (`DataTablePage` + `DataTable`): tabs All / Payment Requests /
  Petty Cash; status and stage filters; stats cards; Export in header.
  Admin and dept surfaces add a **Needs my action** tab and, for processors,
  **Awaiting payment**.
- **New requisition**: form chooser → Payment Request form (existing dialog
  updated: site location, optional funding category, emergency removed) or
  Petty Cash form (line items, live total + words).
- **Detail**: stage timeline (signed / bypassed / not required / pending,
  with signature thumbnails), amount-change history, payments list, and the
  action panel with the PIN dialog.
- **Profile → Signing setup**: signature, PIN, forgot PIN.
- **Admin settings**: payment processors, next to funding categories.
- **PDFs**: two templates laid out like the paper sheets, with names,
  signatures, dates, "Bypassed" / "Not required" in empty slots, and
  "Processed by … on … ref …". Built from the existing
  `requisition-pdf-document.tsx`.

**Notifications** — use the standard types (`approval_request`,
`approval_granted`, `approval_rejected`) sent only to the relevant person:
next assignee, bypassed assignees, requester (stage passed, amount changed,
rejected, fully signed, paid), processors (awaiting payment).
Every notification to the next signer and to processors also goes by
**email** (decided), through the existing email gateway with matching in-app
parity per AGENTS.md. MD's Desk queue updated to the new stage model.

---

## 7. Help desk becomes support-only (decided 2026-10-13)

Today the help desk has its own **Procurement** ticket type with a separate
approval chain (`pending_approval` → `approved_for_procurement`), plus a
"Pivot to procurement" action that turns a support ticket into one. That is a
second way to approve spending, outside requisitions. The create dialog
already tells people to use Requisitions, but the API, pivot route and
approval route still work.

**Change**
- Remove the Procurement type from the create dialog; the API rejects
  `request_type: "procurement"` for new tickets.
- Remove the "Pivot to procurement" action and route
  (`app/api/help-desk/tickets/[id]/pivot`) — returns 410.
- Remove the procurement approval route
  (`app/api/help-desk/tickets/[id]/approvals`) and its UI — there are no
  tickets in production, so nothing is waiting on it.
- New **"Raise requisition"** button on a ticket (handler or requester):
  opens the form chooser with the ticket number and title pre-filled into the
  purpose. Amount decides the form, as everywhere else.
- `requisitions.help_desk_ticket_id uuid null` (FK, set null on delete).
  The ticket shows linked requisitions with number, amount and status; the
  requisition detail links back to the ticket.
- Ticket notifications: the ticket's people get "REQ-2026-0012 raised for
  this ticket" and "… paid", so they know when they can proceed.
- Help desk statuses `pending_approval` / `approved_for_procurement` stay
  valid for historic rows only; no code path sets them.


---

## 8. Build order

Each phase is one or more commits once tsc, eslint and tests pass.

| Phase | Content |
|---|---|
| 1 | Migration (**shown to you before it touches the live DB**) |
| 2 | `routing.ts`, `limits.ts` + tests |
| 3 | Signing setup: signature, PIN, reset, profile page |
| 4 | Create / act / payment API routes |
| 5 | Screens: chooser, petty cash form, payment form changes, detail, queues |
| 6 | PDFs + export |
| 7 | Notifications (in-app + email) + MD's Desk |
| 8 | Help desk: remove procurement, "Raise requisition", ticket ↔ requisition link |
| Later | Passkeys for login + approvals |

Live state checked 2026-10-13: 0 requisitions, 4 funding categories, 0 help desk tickets.

---

## 9. Decisions log (2026-10-13)

- Notifications to signers and processors go by email and in-app.
- Signature: upload **and** draw on screen.
- Numbering: per-form, per-year counters from 0001.
- Help desk becomes support-only.
- Existing-data decisions (approved → Awaiting payment, pending re-routed,
  renumbering) were made, then found moot: production has no requisitions.
