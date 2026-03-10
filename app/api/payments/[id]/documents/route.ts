import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getOneDriveService } from "@/lib/onedrive"
import { getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

function createClient() {
  const cookieStore = cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore errors
        }
      },
    },
  })
}

function normalizeDepartment(value: string | null | undefined): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
  if (normalized === "finance") return "accounts"
  return normalized
}

function isFinanceDepartment(value: string | null | undefined): boolean {
  return normalizeDepartment(value) === "accounts"
}

async function assertPaymentAccess(supabase: ReturnType<typeof createClient>, userId: string, paymentId: string) {
  const scope = await resolveAdminScope(supabase as any, userId)
  const { data: profile } = await supabase.from("profiles").select("department").eq("id", userId).single()
  const dataClient = getServiceRoleClientOrFallback(supabase as any)

  const { data: payment } = await dataClient
    .from("department_payments")
    .select("department:departments(name)")
    .eq("id", paymentId)
    .single()

  const paymentDepartment = Array.isArray((payment as any)?.department)
    ? (payment as any)?.department?.[0]?.name
    : (payment as any)?.department?.name

  if (!paymentDepartment) {
    return { allowed: false as const, status: 404, error: "Payment not found" }
  }

  if (scope) {
    const scopedDepartments = getDepartmentScope(scope, "finance")
    if (scopedDepartments) {
      const inScope = scopedDepartments.some(
        (dept) => normalizeDepartment(dept) === normalizeDepartment(paymentDepartment)
      )
      if (!inScope) {
        return { allowed: false as const, status: 403, error: "Forbidden: outside your finance scope" }
      }
    }
    return { allowed: true as const }
  }

  if (!isFinanceDepartment(profile?.department)) {
    return { allowed: false as const, status: 403, error: "Forbidden: finance access required" }
  }

  if (normalizeDepartment(profile?.department) !== normalizeDepartment(paymentDepartment)) {
    return { allowed: false as const, status: 403, error: "Forbidden: Department mismatch" }
  }

  return { allowed: true as const }
}

// GET /api/payments/[id]/documents - List all documents for a payment
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { id: paymentId } = params
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get("includeArchived") === "true"

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await assertPaymentAccess(supabase, user.id, paymentId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    let query = supabase
      .from("payment_documents")
      .select("*")
      .eq("payment_id", paymentId)
      .order("created_at", { ascending: false })

    if (!includeArchived) {
      query = query.eq("is_archived", false)
    }

    const { data: documents, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: documents })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}

// POST /api/payments/[id]/documents - Upload a new document (with optional replacement)
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { id: paymentId } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await assertPaymentAccess(supabase, user.id, paymentId)
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const documentType = formData.get("document_type") as string
    const applicableDate = (formData.get("applicable_date") as string) || null
    const replaceDocumentId = formData.get("replace_document_id") as string | null

    if (!file || !documentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Upload to Storage
    const sanitizedName = file.name.replace(/[^\x00-\x7F]/g, "")
    const filePath = `${paymentId}/${Date.now()}-${sanitizedName}`

    const { error: uploadError } = await supabase.storage.from("payment_documents").upload(filePath, file)

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 })
    }

    // Insert new document record
    const { data: newDocument, error: dbError } = await supabase
      .from("payment_documents")
      .insert({
        payment_id: paymentId,
        document_type: documentType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        uploaded_by: user.id,
        applicable_date: applicableDate,
        mime_type: file.type,
        is_archived: false,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database insert error:", dbError)
      return NextResponse.json({ error: dbError.message || "Failed to save document record" }, { status: 500 })
    }

    // If replacing an existing document, archive the old one
    if (replaceDocumentId) {
      const { error: archiveError } = await supabase
        .from("payment_documents")
        .update({
          is_archived: true,
          replaced_by: newDocument.id,
          archived_at: new Date().toISOString(),
        })
        .eq("id", replaceDocumentId)

      if (archiveError) {
        console.error("Error archiving old document:", archiveError)
        // Don't fail the request, the new document was created successfully
      }
    }

    // Sync to OneDrive if enabled
    try {
      const onedrive = getOneDriveService()
      if (onedrive.isEnabled()) {
        // Get payment details for folder structure
        const { data: payment } = await supabase
          .from("department_payments")
          .select("id, title, department:departments(name)")
          .eq("id", paymentId)
          .single()

        if (payment?.department) {
          const departmentName =
            typeof payment.department === "object" && "name" in payment.department
              ? (payment.department as { name: string }).name
              : "General"

          // Create folder and upload file
          const onedrivePath = onedrive.getPaymentsPath(departmentName, paymentId, file.name)

          // Convert file to Uint8Array
          const arrayBuffer = await file.arrayBuffer()

          await onedrive.uploadFile(onedrivePath, arrayBuffer, file.type)
          console.log(`Synced document to OneDrive: ${onedrivePath}`)
        }
      }
    } catch (onedriveError) {
      // Log but don't fail the request - OneDrive sync is best effort
      console.error("OneDrive sync error (non-fatal):", onedriveError)
    }

    return NextResponse.json({ data: newDocument }, { status: 201 })
  } catch (error: unknown) {
    console.error("Upload handler error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
