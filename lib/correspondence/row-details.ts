import type { SupabaseClient } from "@supabase/supabase-js"
import type { CorrespondenceApproval, CorrespondenceVersion } from "@/types/correspondence"

export interface CorrespondenceRowDetails {
  approvals: CorrespondenceApproval[]
  versions: Pick<CorrespondenceVersion, "id" | "version_no" | "file_path" | "change_summary" | "created_at">[]
}

/**
 * Adds each record's approval stages (with the approver's name) and document versions,
 * so the list's expanded row shows them straight away instead of loading on open.
 * Two queries for the whole page, plus one name lookup.
 */
export async function withCorrespondenceRowDetails<T extends { id: string }>(
  client: SupabaseClient,
  records: T[]
): Promise<(T & CorrespondenceRowDetails)[]> {
  if (records.length === 0) return []
  const ids = records.map((r) => r.id)

  const [{ data: approvals }, { data: versions }] = await Promise.all([
    client
      .from("correspondence_approvals")
      .select(
        "id, correspondence_id, approval_stage, approver_id, status, comments, requested_at, decided_at, created_at, updated_at"
      )
      .in("correspondence_id", ids)
      .order("created_at", { ascending: true }),
    client
      .from("correspondence_versions")
      .select("id, correspondence_id, version_no, file_path, change_summary, created_at")
      .in("correspondence_id", ids)
      .order("version_no", { ascending: false }),
  ])

  const approverIds = Array.from(
    new Set((approvals || []).map((a) => a.approver_id as string | null).filter((id): id is string => Boolean(id)))
  )
  const names = new Map<string, string>()
  if (approverIds.length) {
    const { data: staff } = await client.from("staff_directory").select("id, full_name").in("id", approverIds)
    for (const person of staff || []) names.set(person.id as string, person.full_name as string)
  }

  const approvalsByRecord = new Map<string, CorrespondenceApproval[]>()
  for (const a of (approvals || []) as CorrespondenceApproval[]) {
    const list = approvalsByRecord.get(a.correspondence_id) || []
    list.push({ ...a, approver_name: a.approver_id ? (names.get(a.approver_id) ?? null) : null })
    approvalsByRecord.set(a.correspondence_id, list)
  }
  const versionsByRecord = new Map<string, CorrespondenceRowDetails["versions"]>()
  for (const v of versions || []) {
    const key = v.correspondence_id as string
    const list = versionsByRecord.get(key) || []
    list.push({
      id: v.id as string,
      version_no: v.version_no as number,
      file_path: (v.file_path as string | null) ?? null,
      change_summary: (v.change_summary as string | null) ?? null,
      created_at: v.created_at as string,
    })
    versionsByRecord.set(key, list)
  }

  return records.map((r) => ({
    ...r,
    approvals: approvalsByRecord.get(r.id) || [],
    versions: versionsByRecord.get(r.id) || [],
  }))
}
