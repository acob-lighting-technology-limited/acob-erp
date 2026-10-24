import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { isCpanelConfigured } from "@/lib/cpanel/client"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const log = logger("admin-mailboxes-link-api")

const LinkMailboxSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  linkType: z.enum(["staff", "project", "none"]),
  profileId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
})

/**
 * POST /api/admin/mailboxes/link — link an existing mailbox to staff, a project, or unlink it.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`admin-mailbox-link:${getClientId(request)}`, { limit: 30, windowSec: 60 })
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
  const parsed = LinkMailboxSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
  }

  const { email, linkType, profileId, projectId } = parsed.data
  const serviceClient = getServiceRoleClientOrFallback(auth.supabase)

  try {
    // 1. Remove any existing project link for this email
    await serviceClient.from("project_mailboxes").delete().ilike("email", email)

    // 2. Apply new link
    if (linkType === "staff") {
      if (!profileId) {
        return NextResponse.json({ error: "Please select an employee" }, { status: 400 })
      }
      const { error: profileErr } = await serviceClient
        .from("profiles")
        .update({ company_email: email, mailbox_status: "created", mailbox_error: null })
        .eq("id", profileId)

      if (profileErr) {
        log.error({ err: profileErr.message, profileId, email }, "Failed to update profile email")
        return NextResponse.json({ error: "Failed to link mailbox to staff" }, { status: 500 })
      }
    } else if (linkType === "project") {
      if (!projectId) {
        return NextResponse.json({ error: "Please select a project" }, { status: 400 })
      }
      const { error: projectErr } = await serviceClient
        .from("project_mailboxes")
        .insert({ project_id: projectId, email, created_by: auth.scope.userId })

      if (projectErr) {
        log.error({ err: projectErr.message, projectId, email }, "Failed to link mailbox to project")
        return NextResponse.json({ error: "Failed to link mailbox to project" }, { status: 500 })
      }
    }

    await writeAuditLog(
      auth.supabase,
      {
        action: "update",
        entityType: "mailbox",
        entityId: email,
        newValues: { email, link_type: linkType, profile_id: profileId ?? null, project_id: projectId ?? null },
        context: { actorId: auth.scope.userId, source: "api", route: "/api/admin/mailboxes/link" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: { email, linkType, profileId, projectId } })
  } catch (err) {
    log.error({ err: String(err), email }, "Failed to update mailbox link")
    return NextResponse.json({ error: "Failed to update mailbox assignment" }, { status: 500 })
  }
}
