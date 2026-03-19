import { normalizeRecipientEmails } from "./notification-gateway.ts"

export type CanonicalAssetMailEvent =
  | "asset_assigned"
  | "asset_transfer_outgoing"
  | "asset_transfer_incoming"
  | "asset_returned"
  | "asset_status_alert"

const ASSET_EVENT_ALIASES: Record<string, CanonicalAssetMailEvent> = {
  asset_assignment: "asset_assigned",
  asset_assigned: "asset_assigned",
  asset_transfer_outgoing: "asset_transfer_outgoing",
  asset_transfer_incoming: "asset_transfer_incoming",
  asset_returned: "asset_returned",
  asset_status_alert: "asset_status_alert",
  asset_status_fixed: "asset_status_alert",
  system_restored: "asset_status_alert",
}

type SupabaseEdgeClient = {
  auth: {
    admin: {
      getUserById: (
        userId: string
      ) => Promise<{ data: { user: { email?: string | null } | null } | null; error: unknown }>
    }
  }
  from: (table: string) => {
    select: (query: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        single: () => Promise<{
          data: {
            full_name?: string | null
            department?: string | null
            additional_email?: string | null
            employment_status?: string | null
          } | null
          error: unknown
        }>
      }
    }
  }
}

export function normalizeAssetMailEventType(rawType: string | null | undefined): CanonicalAssetMailEvent | null {
  const normalized = String(rawType || "")
    .trim()
    .toLowerCase()
  return ASSET_EVENT_ALIASES[normalized] || null
}

export async function resolveAssetMailRecipientContext(supabase: SupabaseEdgeClient, userId: string) {
  const { data: recipientUser, error: userError } = await supabase.auth.admin.getUserById(userId)
  if (userError || !recipientUser?.user) return null

  const { data: recipientProfile } = await supabase
    .from("profiles")
    .select("full_name, department, additional_email, employment_status")
    .eq("id", userId)
    .single()

  if (!recipientProfile || recipientProfile.employment_status !== "active") return null

  const recipientName = recipientProfile.full_name || "Staff Member"

  return {
    recipientEmails: normalizeRecipientEmails([recipientUser.user.email, recipientProfile.additional_email]),
    recipientName,
    recipientFirstName: recipientName.split(" ")[0] || "Staff",
    recipientDept: recipientProfile.department || "Unassigned",
  }
}
