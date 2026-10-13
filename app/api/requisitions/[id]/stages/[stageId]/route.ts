import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { notifyRequisitionEvent } from "@/lib/requisitions/notify"
import { ReassignStageSchema } from "@/lib/requisitions/schemas"
import { currentStage, loadRequisition } from "@/lib/requisitions/server"
import {
  canManageRequisitionSettings,
  requireRequisitionUser,
  requisitionErrorResponse,
} from "@/lib/requisitions/route-helpers"

/**
 * PATCH /api/requisitions/[id]/stages/[stageId] — a finance admin hands a
 * pending stage to someone else (the holder is on leave, has left, or the role
 * had nobody when the requisition was raised).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin, supabase } = auth
  const { id, stageId } = await params

  if (!(await canManageRequisitionSettings())) {
    return apiError("Only finance admins can reassign a stage.", ApiErrorCode.FORBIDDEN, 403)
  }

  const parsed = ReassignStageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "Invalid request", ApiErrorCode.VALIDATION_ERROR, 400)
  }

  try {
    const req = await loadRequisition(admin, id)
    const stage = req?.stages?.find((s) => s.id === stageId)
    if (!req || !stage) return apiError("Stage not found", ApiErrorCode.NOT_FOUND, 404)
    if (req.status !== "pending" || stage.state !== "pending") {
      return apiError("Only a stage still waiting can be reassigned.", ApiErrorCode.VALIDATION_ERROR, 409)
    }
    if (parsed.data.assignee_id === req.user_id) {
      return apiError("The requester cannot sign their own requisition.", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    const { data: person } = await admin
      .from("profiles")
      .select("id, employment_status")
      .eq("id", parsed.data.assignee_id)
      .maybeSingle()
    if (!person || (person.employment_status && person.employment_status !== "active")) {
      return apiError("Pick an active member of staff.", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    const { error } = await admin
      .from("requisition_stages")
      .update({ assignee_id: parsed.data.assignee_id, state_note: "Reassigned by an admin" })
      .eq("id", stageId)
      .eq("state", "pending")
    if (error) throw error

    const updated = await loadRequisition(admin, id)
    // Only the stage it is waiting on has someone to tell now.
    if (updated && currentStage(updated)?.id === stageId) {
      await notifyRequisitionEvent(admin, { kind: "submitted", req: updated })
    }

    await writeAuditLog(
      supabase,
      {
        action: "assign",
        entityType: "requisition",
        entityId: id,
        oldValues: { stage: stage.stage_code, assignee_id: stage.assignee_id },
        newValues: { stage: stage.stage_code, assignee_id: parsed.data.assignee_id },
        context: { actorId: user.id, source: "api", route: `/api/requisitions/${id}/stages/${stageId}` },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: updated })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to reassign stage")
  }
}
