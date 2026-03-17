/**
 * Audit log normalisation utilities.
 *
 * Single source of truth for converting raw DB rows into a consistent
 * AuditLog shape consumed by both the server page and client component.
 * Previously this logic was duplicated across:
 *   - app/admin/audit-logs/page.tsx  (server-side first pass)
 *   - app/admin/audit-logs/admin-audit-logs-content.tsx (client-side second pass)
 */

export interface RawAuditLogRow {
  id: string
  user_id: string
  action?: string | null
  operation?: string | null
  entity_type?: string | null
  table_name?: string | null
  entity_id?: string | null
  record_id?: string | null
  new_values?: unknown
  old_values?: unknown
  created_at: string
  department?: string | null
  changed_fields?: string[]
  metadata?: Record<string, unknown>
}

export interface NormalizedAuditLogRow extends Omit<RawAuditLogRow, "new_values" | "old_values"> {
  action: string
  entity_type: string
  entity_id: string | null
  new_values: Record<string, unknown>
  old_values: Record<string, unknown>
}

/**
 * Safely parse a value that may be a JSON string, a plain object, or null.
 * Returns an empty object on any parse failure.
 */
function parseJsonColumn(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {}
  if (typeof raw === "object") return raw as Record<string, unknown>
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Normalise a single raw audit_logs row into a consistent shape.
 *
 * Handles:
 * - JSON string → object coercion for new_values / old_values
 * - Metadata fallback when top-level values columns are empty
 * - Legacy column aliases (table_name → entity_type, record_id → entity_id, operation → action)
 */
export function normalizeAuditLogRow(row: RawAuditLogRow): NormalizedAuditLogRow {
  let new_values = parseJsonColumn(row.new_values)
  let old_values = parseJsonColumn(row.old_values)

  // Fall back to metadata sub-keys when top-level columns are empty
  if (Object.keys(new_values).length === 0 && row.metadata?.new_values) {
    new_values = parseJsonColumn(row.metadata.new_values)
  }
  if (Object.keys(old_values).length === 0 && row.metadata?.old_values) {
    old_values = parseJsonColumn(row.metadata.old_values)
  }

  return {
    ...row,
    action: row.action || row.operation || "unknown",
    entity_type: (row.entity_type || row.table_name || "unknown").toLowerCase(),
    entity_id: row.entity_id || row.record_id || null,
    new_values,
    old_values,
  }
}

/**
 * Normalise an array of raw rows. Convenience wrapper around normalizeAuditLogRow.
 */
export function normalizeAuditLogRows(rows: RawAuditLogRow[]): NormalizedAuditLogRow[] {
  return rows.map(normalizeAuditLogRow)
}
