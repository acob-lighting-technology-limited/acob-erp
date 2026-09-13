import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import {
  CONTROLLED_DOC_COLUMNS,
  canViewDocument,
  resolveControlledDocActor,
  type ControlledDocDbRow,
} from "@/lib/documentation/controlled-server"

const log = logger("controlled-documents-summary")

export interface ControlledDocSummary {
  policies: number
  policiesPendingAcknowledgement: number
  sops: number
}

const EMPTY: ControlledDocSummary = { policies: 0, policiesPendingAcknowledgement: 0, sops: 0 }

/** Counts for the documentation landing cards: what the user can read, and what still needs their acknowledgement. */
export async function getControlledDocSummary(db: SupabaseClient, userId: string): Promise<ControlledDocSummary> {
  try {
    const actor = await resolveControlledDocActor(db, userId)
    if (!actor) return EMPTY

    const { data, error } = await db
      .from("controlled_documents")
      .select(CONTROLLED_DOC_COLUMNS)
      .eq("status", "published")
    if (error) throw error

    const visible = ((data || []) as ControlledDocDbRow[]).filter((doc) => canViewDocument(actor, doc))
    const policies = visible.filter((doc) => doc.doc_type === "policy")
    const policyVersionIds = policies.map((doc) => doc.current_version_id).filter((id): id is string => Boolean(id))

    let acknowledged = 0
    if (policyVersionIds.length > 0) {
      const { count } = await db
        .from("controlled_document_acknowledgements")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("version_id", policyVersionIds)
      acknowledged = count ?? 0
    }

    return {
      policies: policies.length,
      policiesPendingAcknowledgement: Math.max(0, policyVersionIds.length - acknowledged),
      sops: visible.length - policies.length,
    }
  } catch (err) {
    log.error({ err: String(err) }, "Failed to summarise controlled documents")
    return EMPTY
  }
}
