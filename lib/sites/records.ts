import type { SupabaseClient } from "@supabase/supabase-js"
import type { SiteDocumentStatus, SiteDocumentType } from "./conveyance"
import type { SiteFields } from "./schemas"

export type SiteDocumentRecord = {
  id: string
  site_id: string
  document_type: SiteDocumentType
  label: string | null
  status: SiteDocumentStatus
  reference: string | null
  issued_on: string | null
  expires_on: string | null
  notes: string | null
}

export type SiteRecord = {
  id: string
  name: string
  lga: string | null
  state: string | null
  date_signed: string | null
  portfolio_id: string | null
  project_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  portfolio: { id: string; name: string; code: string | null } | null
  project: { id: string; project_name: string } | null
  documents: SiteDocumentRecord[]
}

export type SitesPayload = { data: SiteRecord[]; canEdit: boolean }

const SITE_COLUMNS = `id, name, lga, state, date_signed, portfolio_id, project_id, notes, created_at, updated_at,
  portfolio:portfolios(id, name, code),
  project:projects(id, project_name),
  documents:site_documents(id, site_id, document_type, label, status, reference, issued_on, expires_on, notes)`

/**
 * The register is read whole: the conveyance filters work on a status derived
 * from every document's expiry date, which cannot be pushed into a server-side
 * page query. Bounded well above the few hundred sites the company holds; move
 * to server-side paging if it ever nears the cap.
 */
const SITES_LIMIT = 2000

type Joined<T> = T | T[] | null

/** The row as PostgREST returns it: without generated types, a to-one join may be typed as an array. */
type RawSiteRow = Omit<SiteRecord, "portfolio" | "project"> & {
  portfolio: Joined<NonNullable<SiteRecord["portfolio"]>>
  project: Joined<NonNullable<SiteRecord["project"]>>
}

const one = <T>(value: Joined<T>): T | null => (Array.isArray(value) ? (value[0] ?? null) : value)

function toSiteRecord(row: RawSiteRow): SiteRecord {
  return { ...row, portfolio: one(row.portfolio), project: one(row.project), documents: row.documents ?? [] }
}

export async function loadSites(client: SupabaseClient, filter: { portfolioId?: string | null } = {}) {
  let query = client.from("sites").select(SITE_COLUMNS).order("name", { ascending: true }).limit(SITES_LIMIT)
  if (filter.portfolioId) query = query.eq("portfolio_id", filter.portfolioId)
  const { data, error } = await query.returns<RawSiteRow[]>()
  if (error) throw error
  return (data || []).map(toSiteRecord)
}

export async function loadSite(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("sites")
    .select(SITE_COLUMNS)
    .eq("id", id)
    .returns<RawSiteRow[]>()
    .maybeSingle()
  if (error) throw error
  return data ? toSiteRecord(data) : null
}

const blankToNull = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null)

/** The sites row for an insert or update, from the parsed form body. */
export function siteRow(input: SiteFields) {
  return {
    name: input.name,
    lga: blankToNull(input.lga),
    state: blankToNull(input.state),
    date_signed: blankToNull(input.date_signed),
    portfolio_id: blankToNull(input.portfolio_id),
    project_id: blankToNull(input.project_id),
    notes: blankToNull(input.notes),
  }
}

/**
 * Make the site's documents match `documents`: update the ones that carry an
 * id, insert the new ones, then delete whatever the form no longer lists.
 * Deleting last means a failed write leaves the old documents in place rather
 * than an empty list.
 */
export async function syncSiteDocuments(
  client: SupabaseClient,
  siteId: string,
  documents: SiteFields["documents"],
  userId: string
) {
  const { data: existing, error: existingError } = await client
    .from("site_documents")
    .select("id")
    .eq("site_id", siteId)
  if (existingError) throw existingError
  const existingIds = new Set((existing || []).map((row: { id: string }) => row.id))

  const now = new Date().toISOString()
  const rows = documents.map((doc) => ({
    site_id: siteId,
    document_type: doc.document_type,
    label: doc.document_type === "other" ? blankToNull(doc.label) : null,
    status: doc.status,
    reference: blankToNull(doc.reference),
    issued_on: blankToNull(doc.issued_on),
    expires_on: blankToNull(doc.expires_on),
    notes: blankToNull(doc.notes),
    updated_by: userId,
    updated_at: now,
  }))

  const keptIds = new Set<string>()
  for (const [index, doc] of documents.entries()) {
    // An id that is not this site's is treated as a new document, never as a
    // way to edit another site's paperwork.
    if (doc.id && existingIds.has(doc.id)) {
      keptIds.add(doc.id)
      const { error } = await client.from("site_documents").update(rows[index]).eq("id", doc.id).eq("site_id", siteId)
      if (error) throw error
    }
  }

  const inserts = documents
    .map((doc, index) => ({ doc, row: rows[index] }))
    .filter(({ doc }) => !(doc.id && existingIds.has(doc.id)))
    .map(({ row }) => ({ ...row, created_by: userId }))
  if (inserts.length > 0) {
    const { error } = await client.from("site_documents").insert(inserts)
    if (error) throw error
  }

  const removed = [...existingIds].filter((id) => !keptIds.has(id))
  if (removed.length > 0) {
    const { error } = await client.from("site_documents").delete().in("id", removed).eq("site_id", siteId)
    if (error) throw error
  }
}
