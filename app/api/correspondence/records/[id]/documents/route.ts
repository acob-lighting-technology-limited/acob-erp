import { NextResponse } from "next/server"
import {
  getAuthContext,
  canAccessRecord,
  appendCorrespondenceEvent,
  appendCorrespondenceAuditLog,
} from "@/lib/correspondence/server"

const BUCKET = "correspondence_documents"

type DocumentType = "draft" | "proof" | "supporting"

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: record, error: recordError } = await supabase
      .from("correspondence_records")
      .select("*")
      .eq("id", params.id)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    if (!canAccessRecord(profile, user.id, record)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: versions, error: versionError } = await supabase
      .from("correspondence_versions")
      .select("*")
      .eq("correspondence_id", record.id)
      .order("version_no", { ascending: false })

    if (versionError) {
      return NextResponse.json({ error: versionError.message }, { status: 500 })
    }

    const files = [] as Array<Record<string, unknown>>

    for (const version of versions || []) {
      if (!version.file_path) continue

      const { data: signed, error: signedError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(version.file_path, 3600)

      files.push({
        kind: "draft",
        version_no: version.version_no,
        file_path: version.file_path,
        signed_url: signedError ? null : signed?.signedUrl || null,
        created_at: version.created_at,
      })
    }

    if (record.proof_of_delivery_path) {
      const { data: proofSigned, error: proofError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(record.proof_of_delivery_path, 3600)

      files.push({
        kind: "proof",
        file_path: record.proof_of_delivery_path,
        signed_url: proofError ? null : proofSigned?.signedUrl || null,
        created_at: record.sent_at || record.updated_at,
      })
    }

    return NextResponse.json({ data: files })
  } catch (error: any) {
    console.error("Error in GET /api/correspondence/records/[id]/documents:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, user, profile } = await getAuthContext()

    if (!user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: record, error: recordError } = await supabase
      .from("correspondence_records")
      .select("*")
      .eq("id", params.id)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    if (!canAccessRecord(profile, user.id, record)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const documentType = String(formData.get("document_type") || "draft").toLowerCase() as DocumentType
    const changeSummary = formData.get("change_summary") ? String(formData.get("change_summary")) : null

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    if (!["draft", "proof", "supporting"].includes(documentType)) {
      return NextResponse.json({ error: "document_type must be draft, proof, or supporting" }, { status: 400 })
    }

    const safeName = sanitizeName(file.name)
    const basePath =
      documentType === "proof"
        ? `${record.id}/proof`
        : documentType === "supporting"
          ? `${record.id}/supporting`
          : `${record.id}/drafts`
    const filePath = `${basePath}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file)

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Failed to upload file" }, { status: 500 })
    }

    if (documentType === "proof") {
      const { data: updatedRecord, error: updateError } = await supabase
        .from("correspondence_records")
        .update({ proof_of_delivery_path: filePath })
        .eq("id", record.id)
        .select("*")
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      await appendCorrespondenceEvent({
        correspondenceId: record.id,
        actorId: user.id,
        eventType: "proof_uploaded",
        oldStatus: record.status,
        newStatus: updatedRecord.status,
        details: { file_path: filePath },
      })

      await appendCorrespondenceAuditLog({
        actorId: user.id,
        action: "correspondence_proof_uploaded",
        recordId: record.id,
        oldValues: { proof_of_delivery_path: record.proof_of_delivery_path },
        newValues: { proof_of_delivery_path: filePath },
      })

      return NextResponse.json({ data: { file_path: filePath, kind: "proof" } }, { status: 201 })
    }

    const nextVersion = Number(record.current_version || 1) + 1

    const [{ data: versionRow, error: versionError }, { error: recordUpdateError }] = await Promise.all([
      supabase
        .from("correspondence_versions")
        .insert({
          correspondence_id: record.id,
          version_no: nextVersion,
          file_path: filePath,
          change_summary: changeSummary,
          uploaded_by: user.id,
        })
        .select("*")
        .single(),
      supabase.from("correspondence_records").update({ current_version: nextVersion }).eq("id", record.id),
    ])

    if (versionError) {
      return NextResponse.json({ error: versionError.message }, { status: 500 })
    }

    if (recordUpdateError) {
      return NextResponse.json({ error: recordUpdateError.message }, { status: 500 })
    }

    await appendCorrespondenceEvent({
      correspondenceId: record.id,
      actorId: user.id,
      eventType: documentType === "supporting" ? "supporting_document_uploaded" : "draft_version_uploaded",
      oldStatus: record.status,
      newStatus: record.status,
      details: {
        file_path: filePath,
        version_no: nextVersion,
        document_type: documentType,
      },
    })

    await appendCorrespondenceAuditLog({
      actorId: user.id,
      action: "correspondence_version_uploaded",
      recordId: record.id,
      oldValues: { current_version: record.current_version },
      newValues: { current_version: nextVersion, file_path: filePath, document_type: documentType },
    })

    return NextResponse.json({ data: versionRow }, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/correspondence/records/[id]/documents:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
