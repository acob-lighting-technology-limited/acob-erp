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

/** A document as save_site takes it: blanks are null, and a label only for "other". */
function documentRow(doc: SiteFields["documents"][number]) {
  return {
    id: doc.id ?? null,
    document_type: doc.document_type,
    label: doc.document_type === "other" ? blankToNull(doc.label) : null,
    status: doc.status,
    reference: blankToNull(doc.reference),
    issued_on: blankToNull(doc.issued_on),
    expires_on: blankToNull(doc.expires_on),
    notes: blankToNull(doc.notes),
  }
}

/**
 * Create (`siteId` null) or update a site and make its documents exactly
 * `input.documents` — in one transaction, via the save_site function, so a
 * failure part way leaves the site and its documents as they were. Returns
 * the site's id. Errors carry the Postgres code (23505 duplicate name,
 * P0002 site not found).
 */
export async function saveSite(client: SupabaseClient, siteId: string | null, input: SiteFields, userId: string) {
  const { data, error } = await client.rpc("save_site", {
    p_site_id: siteId,
    p_site: siteRow(input),
    p_documents: input.documents.map(documentRow),
    p_actor: userId,
  })
  if (error) throw error
  return data as string
}
