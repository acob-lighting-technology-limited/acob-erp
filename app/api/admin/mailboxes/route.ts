import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { CpanelError, createMailbox, getMailbox, isCpanelConfigured } from "@/lib/cpanel/client"
import { loadMailboxReport } from "@/lib/cpanel/mailboxes"
import { DEFAULT_MAILBOX_QUOTA_MB } from "@/lib/cpanel/quota"
import { logger } from "@/lib/logger"
import { ORG_STAFF_DOMAIN } from "@/lib/org-config"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const log = logger("admin-mailboxes-api")

const CreateMailboxSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .refine((e) => e.endsWith(`@${ORG_STAFF_DOMAIN.toLowerCase()}`), `Mailbox must be on @${ORG_STAFF_DOMAIN}`),
  password: z.string().min(8, "Password must be at least 8 characters long").max(128, "Password too long"),
  quotaMb: z.coerce
    .number()
    .int("Quota must be a whole number of megabytes")
    .min(100, "Minimum quota is 100 MB")
    .max(500 * 1024, "Maximum quota is 500 GB")
    .optional(),
  quotaGb: z.coerce.number().min(0.1, "Minimum quota is 100 MB").max(500, "Maximum quota is 500 GB").optional(),
  linkType: z.enum(["staff", "project", "none"]),
  profileId: z.string().uuid("Invalid employee ID").optional().nullable(),
  projectId: z.string().uuid("Invalid project ID").optional().nullable(),
})

/**
 * GET /api/admin/mailboxes — every cPanel mailbox matched against staff
 * profiles, projects, plus staff with no mailbox and account-wide inode usage.
 */
export async function GET() {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!isCpanelConfigured()) {
    return NextResponse.json({ error: "cPanel is not configured on this server" }, { status: 503 })
  }

  try {
    const report = await loadMailboxReport(getServiceRoleClientOrFallback(auth.supabase))
    return NextResponse.json({ data: report })
  } catch (err) {
    log.error({ err: String(err) }, "Failed to load mailbox report")
    const message = err instanceof CpanelError ? err.message : "Failed to load mailboxes"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/**
 * POST /api/admin/mailboxes — create a new mailbox on cPanel and link it
 * to a staff member, project, or leave as a shared account.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`admin-mailbox-create:${getClientId(request)}`, { limit: 15, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 })
  }

  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!isCpanelConfigured()) {
    return NextResponse.json({ error: "cPanel is not configured on this server" }, { status: 503 })
  }

  const json = await request.json().catch(() => null)
  const parsed = CreateMailboxSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
  }

  const { email, password, quotaMb: rawQuotaMb, quotaGb: rawQuotaGb, linkType, profileId, projectId } = parsed.data
  const quotaMb = rawQuotaMb ?? (rawQuotaGb != null ? Math.round(rawQuotaGb * 1024) : DEFAULT_MAILBOX_QUOTA_MB)
  const quotaGb = Math.round((quotaMb / 1024) * 100) / 100

  if (linkType === "staff" && !profileId) {
    return NextResponse.json({ error: "Please select an employee to link this mailbox to" }, { status: 400 })
  }
  if (linkType === "project" && !projectId) {
    return NextResponse.json({ error: "Please select a project to link this mailbox to" }, { status: 400 })
  }

  const serviceClient = getServiceRoleClientOrFallback(auth.supabase)

  try {
    const existing = await getMailbox(email)
    if (existing) {
      return NextResponse.json({ error: `Mailbox ${email} already exists on cPanel` }, { status: 409 })
    }

    await createMailbox(email, password, quotaMb)

    if (linkType === "staff" && profileId) {
      const { error: profileErr } = await serviceClient
        .from("profiles")
        .update({ company_email: email, mailbox_status: "created", mailbox_error: null })
        .eq("id", profileId)

      if (profileErr) {
        log.error({ err: profileErr.message, profileId, email }, "Failed to update employee profile email")
      }
    } else if (linkType === "project" && projectId) {
      const { error: projectErr } = await serviceClient
        .from("project_mailboxes")
        .insert({ project_id: projectId, email, created_by: auth.scope.userId })

      if (projectErr) {
        log.error({ err: projectErr.message, projectId, email }, "Failed to link mailbox to project")
      }
    }

    await writeAuditLog(
      auth.supabase,
      {
        action: "create",
        entityType: "mailbox",
        entityId: email,
        newValues: {
          email,
          quota_mb: quotaMb,
          quota_gb: quotaGb,
          link_type: linkType,
          profile_id: profileId ?? null,
          project_id: projectId ?? null,
        },
        context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/mailboxes" },
      },
      { failOpen: true }
    )

    return NextResponse.json(
      {
        data: {
          email,
          quotaMb,
          quotaGb,
          linkType,
          profileId: profileId ?? null,
          projectId: projectId ?? null,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    log.error({ err: String(err), email }, "Failed to create mailbox")
    const message = err instanceof CpanelError ? err.message : "Failed to create mailbox on cPanel"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
