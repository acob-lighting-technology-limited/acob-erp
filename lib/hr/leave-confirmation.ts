import { getServiceClient } from "@/lib/supabase/admin"
import type { LeaveConfirmationState } from "@/lib/hr/leave-probation"

/**
 * Probation state for the rule in leave-probation.ts. Read with the service client so the
 * answer does not depend on which client the caller holds (callers mix user and service).
 */
export async function getLeaveConfirmationState(userId: string): Promise<LeaveConfirmationState> {
  const service = getServiceClient()
  if (!service) throw new Error("Service client unavailable for confirmation check")
  const { data, error } = await service
    .from("profiles")
    .select("confirmation_date")
    .eq("id", userId)
    .maybeSingle<{ confirmation_date: string | null }>()
  if (error) throw new Error("Failed to load confirmation status")
  return { confirmationDate: data?.confirmation_date ?? null }
}
