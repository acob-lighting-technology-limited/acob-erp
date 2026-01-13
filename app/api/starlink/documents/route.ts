import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get("payment_id")
    const documentType = searchParams.get("document_type")

    let query = supabase
      .from("starlink_documents")
      .select(
        `
        *,
        payment:starlink_payments (
          id,
          invoice_number,
          site:starlink_sites (
            site_name,
            state
          )
        )
      `
      )
      .order("uploaded_at", { ascending: false })

    if (paymentId) {
      query = query.eq("payment_id", paymentId)
    }

    if (documentType) {
      query = query.eq("document_type", documentType)
    }

    const { data: documents, error } = await query

    if (error) {
      console.error("Error fetching starlink documents:", error)
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }

    return NextResponse.json({ data: documents })
  } catch (error) {
    console.error("Error in GET /api/starlink/documents:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || !["super_admin", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const paymentId = formData.get("payment_id") as string
    const documentType = formData.get("document_type") as string
    const description = formData.get("description") as string

    if (!file || !paymentId || !documentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Upload file to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`
    const filePath = `starlink/${documentType}/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      console.error("Error uploading file:", uploadError)
      return NextResponse.json({ error: "Failed to upload file", details: uploadError.message }, { status: 500 })
    }

    // Create document record
    const { data: newDocument, error: dbError } = await supabase
      .from("starlink_documents")
      .insert({
        payment_id: paymentId,
        document_type: documentType,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        description,
        uploaded_by: user.id,
      })
      .select(
        `
        *,
        payment:starlink_payments (
          id,
          invoice_number,
          site:starlink_sites (
            site_name,
            state
          )
        )
      `
      )
      .single()

    if (dbError) {
      console.error("Error creating document record:", dbError)
      // Try to delete the uploaded file
      await supabase.storage.from("documents").remove([uploadData.path])
      return NextResponse.json({ error: "Failed to create document record" }, { status: 500 })
    }

    return NextResponse.json({
      data: newDocument,
      message: "Document uploaded successfully",
    })
  } catch (error) {
    console.error("Error in POST /api/starlink/documents:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check user role
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (!profile || !["super_admin", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    // Get document to find file path
    const { data: document } = await supabase.from("starlink_documents").select("file_path").eq("id", id).single()

    if (document) {
      // Delete file from storage
      await supabase.storage.from("documents").remove([document.file_path])
    }

    // Delete document record
    const { error } = await supabase.from("starlink_documents").delete().eq("id", id)

    if (error) {
      console.error("Error deleting starlink document:", error)
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
    }

    return NextResponse.json({ message: "Document deleted successfully" })
  } catch (error) {
    console.error("Error in DELETE /api/starlink/documents:", error)
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
