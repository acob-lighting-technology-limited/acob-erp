import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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

    return NextResponse.json({ data: newDocument }, { status: 201 })
  } catch (error: any) {
    console.error("Upload handler error:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
