import { NextResponse } from "next/server"
import { listBanks } from "@/lib/requisitions/paystack"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

/** GET /api/requisitions/banks: Nigerian banks with Paystack's codes, for the beneficiary picker. */
export async function GET() {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  try {
    return NextResponse.json({ data: await listBanks() })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load banks")
  }
}
