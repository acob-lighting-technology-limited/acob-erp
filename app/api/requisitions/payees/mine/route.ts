import { NextResponse } from "next/server"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import type { BeneficiaryDetail } from "@/lib/requisitions/types"

/**
 * GET /api/requisitions/payees/mine — accounts this person has paid on their own
 * requisitions, newest first, so the form can fill a beneficiary in one pick.
 * Only their own history: the full payee register stays with Accounts.
 */
export async function GET() {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  try {
    const { data, error } = await auth.admin
      .from("requisitions")
      .select("beneficiary_details, created_at")
      .eq("user_id", auth.user.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(100)
    if (error) throw error

    const seen = new Set<string>()
    const saved: Pick<BeneficiaryDetail, "account_name" | "account_number" | "bank_name" | "bank_code">[] = []
    for (const row of data || []) {
      for (const b of (row.beneficiary_details || []) as BeneficiaryDetail[]) {
        if (!b.bank_code || !/^\d{10}$/.test(String(b.account_number))) continue
        const key = `${b.bank_code}:${b.account_number}`
        if (seen.has(key)) continue
        seen.add(key)
        saved.push({
          account_name: b.verified_account_name || b.account_name,
          account_number: String(b.account_number),
          bank_name: b.bank_name,
          bank_code: b.bank_code,
        })
      }
    }
    return NextResponse.json({ data: saved.slice(0, 30) })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load saved beneficiaries")
  }
}
