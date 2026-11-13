import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { buildBankWorkbookFile } from "@/lib/requisitions/bank-workbook"
import { bankCodeForName } from "@/lib/requisitions/bank-file"
import { canViewRequisition, getViewerContext, loadRequisition } from "@/lib/requisitions/server"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"

const ParamsSchema = z.object({ id: z.string().uuid() })

/**
 * GET /api/requisitions/[id]/beneficiary-spreadsheet
 *
 * Bulk requisitions carry their full beneficiary list in the same columns as
 * the Accounts bank workbook. This is generated from the approved record, so
 * it cannot drift from the PDF form.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const parsed = ParamsSchema.safeParse(await params)
  if (!parsed.success) return apiError("Requisition not found", ApiErrorCode.NOT_FOUND, 404)

  try {
    const [requisition, viewer] = await Promise.all([
      loadRequisition(auth.admin, parsed.data.id),
      getViewerContext(auth.admin, auth.user.id),
    ])
    if (!requisition || !canViewRequisition(requisition, viewer)) {
      return apiError("Requisition not found", ApiErrorCode.NOT_FOUND, 404)
    }
    if (requisition.beneficiary_details.length <= 4) {
      return apiError("This requisition has no bulk beneficiary spreadsheet", ApiErrorCode.NOT_FOUND, 404)
    }

    const date = requisition.created_at.slice(0, 10)
    const rows = requisition.beneficiary_details.map((beneficiary, index) => ({
      transaction_ref: `${requisition.requisition_number.replace(/[^A-Za-z0-9]/g, "")}${index + 1}`.slice(0, 30),
      account_name: beneficiary.account_name,
      amount: Number(beneficiary.amount ?? 0),
      beneficiary_code: `REQ${requisition.id.slice(0, 8)}${index + 1}`,
      account_number: beneficiary.account_number,
      bank_code: beneficiary.bank_code || bankCodeForName(beneficiary.bank_name) || "0",
    }))
    const workbook = await buildBankWorkbookFile(rows, date, "")
    const name = `${requisition.requisition_number.replace(/\//g, "-")}-beneficiaries.xlsx`
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to create beneficiary spreadsheet")
  }
}
