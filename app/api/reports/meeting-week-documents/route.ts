import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { resolveAdminScope, getDepartmentScope, normalizeDepartmentName } from "@/lib/admin/rbac"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { REPORT_DOC_MAX_SIZE_BYTES, formatLimitMb } from "@/lib/reports/document-upload-limits"
import { logger } from "@/lib/logger"

const log = logger("api-reports-meeting-week-documents")
const BUCKET = "meeting_documents"

type DocumentType = "knowledge_sharing_session" | "minutes" | "action_points"

const KSS_ALLOWED = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
])

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore write attempts from server component contexts.
        }
      },
    },
  })
}

function normalizeDepartment(value: string): string {
  return normalizeDepartmentName(String(value || "").trim())
}

function sanitizeName(name: string): string {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_")
}

function dateStamp(input = new Date()): string {
  const y = input.getFullYear()
  const m = String(input.getMonth() + 1).padStart(2, "0")
  const d = String(input.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function resolveExtension(file: File): string {
  const raw = file.name || ""
  const dotIdx = raw.lastIndexOf(".")
  if (dotIdx > -1) return raw.slice(dotIdx + 1).toLowerCase()
  if (file.type === "application/pdf") return "pdf"
  if (file.type === "application/vnd.ms-powerpoint") return "ppt"
  if (file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx"
  return "bin"
}

function hasGlobalReportsWriteAccess(scope: NonNullable<Awaited<ReturnType<typeof resolveAdminScope>>>): boolean {
  return getDepartmentScope(scope, "general") === null
}

function parseDocumentType(value: unknown): DocumentType | null {
  if (value === "knowledge_sharing_session" || value === "minutes" || value === "action_points") return value
  return null
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const week = Number(searchParams.get("week") || "")
    const year = Number(searchParams.get("year") || "")
    const docType = parseDocumentType(searchParams.get("documentType"))
    const currentOnly = searchParams.get("currentOnly") === "true"

    let query = supabase
      .from("meeting_week_documents")
      .select(
        "id, meeting_week, meeting_year, document_type, department, presenter_id, notes, file_name, file_path, mime_type, file_size, version_no, is_current, replaced_by, uploaded_by, created_at, updated_at"
      )
      .order("meeting_year", { ascending: false })
      .order("meeting_week", { ascending: false })
      .order("created_at", { ascending: false })

    if (Number.isFinite(week) && week > 0) query = query.eq("meeting_week", week)
    if (Number.isFinite(year) && year > 0) query = query.eq("meeting_year", year)
    if (docType) query = query.eq("document_type", docType)
    if (currentOnly) query = query.eq("is_current", true)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = data || []
    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { data: signed, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.file_path, 3600)
        return {
          ...row,
          signed_url: signedError ? null : (signed?.signedUrl ?? null),
        }
      })
    )

    return NextResponse.json({ data: withUrls })
  } catch (error) {
    log.error({ err: String(error) }, "GET /api/reports/meeting-week-documents failed")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!hasGlobalReportsWriteAccess(scope)) {
      return NextResponse.json({ error: "Only reports admins can upload meeting documents" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const meetingWeek = Number(formData.get("meetingWeek"))
    const meetingYear = Number(formData.get("meetingYear"))
    const documentType = parseDocumentType(formData.get("documentType"))
    const notes = formData.get("notes") ? String(formData.get("notes")) : null
    const presenterId = formData.get("presenterId") ? String(formData.get("presenterId")) : null
    const rawDept = formData.get("department") ? String(formData.get("department")) : ""
    const department = rawDept ? normalizeDepartment(rawDept) : null

    if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 })
    if (file.size > REPORT_DOC_MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds max size of ${formatLimitMb(REPORT_DOC_MAX_SIZE_BYTES)}` },
        { status: 400 }
      )
    }
    if (!Number.isFinite(meetingWeek) || meetingWeek < 1 || meetingWeek > 53) {
      return NextResponse.json({ error: "meetingWeek must be between 1 and 53" }, { status: 400 })
    }
    if (!Number.isFinite(meetingYear) || meetingYear < 2000 || meetingYear > 2100) {
      return NextResponse.json({ error: "meetingYear must be between 2000 and 2100" }, { status: 400 })
    }
    if (!documentType) return NextResponse.json({ error: "Invalid documentType" }, { status: 400 })

    if (documentType === "knowledge_sharing_session") {
      if (!department) {
        return NextResponse.json(
          { error: "department is required for Knowledge Sharing Session documents" },
          { status: 400 }
        )
      }
      if (!presenterId) {
        return NextResponse.json(
          { error: "presenterId is required for Knowledge Sharing Session documents" },
          { status: 400 }
        )
      }
      if (!KSS_ALLOWED.has(file.type)) {
        return NextResponse.json({ error: "Knowledge Sharing Session file must be PPT/PPTX/PDF" }, { status: 400 })
      }
    } else {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "Minutes and action points must be PDF" }, { status: 400 })
      }
    }

    let normalizedFileName = file.name
    if (documentType === "knowledge_sharing_session") {
      const { data: presenter, error: presenterError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", presenterId)
        .single()
      if (presenterError || !presenter?.full_name) {
        return NextResponse.json({ error: "Presenter not found" }, { status: 400 })
      }
      const ext = resolveExtension(file)
      const submitted = dateStamp()
      normalizedFileName = `Knowledge Sharing Session - ${department} - ${presenter.full_name} - Week ${meetingWeek} ${meetingYear} - Submitted ${submitted}.${ext}`
    }

    const deptPath = department ? sanitizeName(department) : "all"
    const safeName = sanitizeName(normalizedFileName)
    const filePath = `${meetingYear}/week-${meetingWeek}/${documentType}/${deptPath}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: currentRows, error: currentError } = await supabase
      .from("meeting_week_documents")
      .select("id, version_no")
      .eq("meeting_week", meetingWeek)
      .eq("meeting_year", meetingYear)
      .eq("document_type", documentType)
      .eq("department", department)
      .eq("is_current", true)
      .order("version_no", { ascending: false })

    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 })
    }

    const current = currentRows?.[0] || null
    const nextVersion = (current?.version_no || 0) + 1

    if (current?.id) {
      const { error: clearCurrentError } = await supabase
        .from("meeting_week_documents")
        .update({ is_current: false })
        .eq("id", current.id)
      if (clearCurrentError) return NextResponse.json({ error: clearCurrentError.message }, { status: 500 })
    }

    const { data: saved, error: saveError } = await supabase
      .from("meeting_week_documents")
      .insert({
        meeting_week: meetingWeek,
        meeting_year: meetingYear,
        document_type: documentType,
        department,
        presenter_id: documentType === "knowledge_sharing_session" ? presenterId : null,
        notes,
        file_name: normalizedFileName,
        file_path: filePath,
        mime_type: file.type,
        file_size: file.size,
        version_no: nextVersion,
        is_current: true,
        replaced_by: null,
        uploaded_by: user.id,
      })
      .select(
        "id, meeting_week, meeting_year, document_type, department, presenter_id, notes, file_name, file_path, mime_type, file_size, version_no, is_current, replaced_by, uploaded_by, created_at, updated_at"
      )
      .single()

    if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })

    if (current?.id) {
      await supabase.from("meeting_week_documents").update({ replaced_by: saved.id }).eq("id", current.id)
    }

    await writeAuditLog(
      supabase as any,
      {
        action: "create",
        entityType: "mail_summary",
        entityId: saved.id,
        metadata: {
          event: "meeting_week_document_uploaded",
          meeting_week: meetingWeek,
          meeting_year: meetingYear,
          document_type: documentType,
          department,
          presenter_id: presenterId,
          version_no: nextVersion,
        },
        context: {
          actorId: user.id,
          source: "api",
          route: "/api/reports/meeting-week-documents",
          department,
        },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: saved }, { status: 201 })
  } catch (error) {
    log.error({ err: String(error) }, "POST /api/reports/meeting-week-documents failed")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!hasGlobalReportsWriteAccess(scope)) {
      return NextResponse.json({ error: "Only reports admins can update meeting documents" }, { status: 403 })
    }

    const body = await request.json()
    const id = String(body?.id || "")
    const makeCurrent = body?.makeCurrent !== false

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { data: doc, error: fetchError } = await supabase
      .from("meeting_week_documents")
      .select(
        "id, meeting_week, meeting_year, document_type, department, presenter_id, notes, file_name, file_path, mime_type, file_size, version_no, is_current, replaced_by, uploaded_by, created_at, updated_at"
      )
      .eq("id", id)
      .single()

    if (fetchError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })

    if (makeCurrent) {
      const { error: clearError } = await supabase
        .from("meeting_week_documents")
        .update({ is_current: false })
        .eq("meeting_week", doc.meeting_week)
        .eq("meeting_year", doc.meeting_year)
        .eq("document_type", doc.document_type)
        .eq("department", doc.department)

      if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 })
    }

    const patch: Record<string, unknown> = {}
    if (makeCurrent) patch.is_current = true
    if (body?.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No patch fields provided" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("meeting_week_documents")
      .update(patch)
      .eq("id", id)
      .select(
        "id, meeting_week, meeting_year, document_type, department, presenter_id, notes, file_name, file_path, mime_type, file_size, version_no, is_current, replaced_by, uploaded_by, created_at, updated_at"
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(
      supabase as any,
      {
        action: "update",
        entityType: "mail_summary",
        entityId: updated.id,
        metadata: {
          event: "meeting_week_document_updated",
          patch,
        },
        context: {
          actorId: user.id,
          source: "api",
          route: "/api/reports/meeting-week-documents",
          department: updated.department,
        },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updated })
  } catch (error) {
    log.error({ err: String(error) }, "PATCH /api/reports/meeting-week-documents failed")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!hasGlobalReportsWriteAccess(scope)) {
      return NextResponse.json({ error: "Only reports admins can delete meeting documents" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get("id") || "")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const { data: doc, error: fetchError } = await supabase
      .from("meeting_week_documents")
      .select("id, meeting_week, meeting_year, document_type, department, file_path")
      .eq("id", id)
      .single()

    if (fetchError || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })

    if (doc.file_path) {
      await supabase.storage.from(BUCKET).remove([doc.file_path])
    }

    const { error: deleteError } = await supabase.from("meeting_week_documents").delete().eq("id", id)
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    await writeAuditLog(
      supabase as any,
      {
        action: "delete",
        entityType: "mail_summary",
        entityId: id,
        metadata: {
          event: "meeting_week_document_deleted",
          meeting_week: doc.meeting_week,
          meeting_year: doc.meeting_year,
          document_type: doc.document_type,
          department: doc.department,
        },
        context: {
          actorId: user.id,
          source: "api",
          route: "/api/reports/meeting-week-documents",
          department: doc.department,
        },
      },
      { failOpen: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: String(error) }, "DELETE /api/reports/meeting-week-documents failed")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
