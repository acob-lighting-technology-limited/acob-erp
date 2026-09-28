import { NextRequest, NextResponse } from "next/server"
import { getRequestScope } from "@/lib/admin/api-scope"
import { checkRequestSize } from "@/lib/api/request-size"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { markDuplicateRisks, parseRiskRegisterWorkbook, RiskImportBatchSchema } from "@/lib/risk-register/import"
import { RISK_COLUMNS, type RiskRow } from "@/lib/risk-register/model"
import { createClient } from "@/lib/supabase/server"

const log = logger("corporate-services:risk-register-import")
const MAX_WORKBOOK_BYTES = 2 * 1024 * 1024

function forbidden(scope: Awaited<ReturnType<typeof getRequestScope>>) {
  return !scope?.isAdminLike || scope.scopeMode !== "global"
}

export async function POST(request: NextRequest) {
  try {
    const sizeError = checkRequestSize(request, MAX_WORKBOOK_BYTES + 128 * 1024)
    if (sizeError) return sizeError

    const scope = await getRequestScope()
    if (forbidden(scope))
      return NextResponse.json({ error: "Only global administrators can import risks" }, { status: 403 })

    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Select an Excel workbook" }, { status: 400 })
    }
    if (file.size > MAX_WORKBOOK_BYTES) {
      return NextResponse.json({ error: "The workbook exceeds the 2 MB limit" }, { status: 413 })
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Only .xlsx workbooks are supported" }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return NextResponse.json({ error: "The uploaded file is not a valid Excel workbook" }, { status: 400 })
    }

    const preview = parseRiskRegisterWorkbook(bytes, file.name)
    const supabase = await createClient()
    const { data, error } = await supabase.from("risk_register").select("department, risk_name")
    if (error) throw error

    return NextResponse.json({ data: markDuplicateRisks(preview, data || []) })
  } catch (error: unknown) {
    log.error({ err: String(error) }, "Failed to preview risk-register import")
    return NextResponse.json({ error: "The workbook could not be read" }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const sizeError = checkRequestSize(request, 2 * 1024 * 1024)
    if (sizeError) return sizeError

    const scope = await getRequestScope()
    if (forbidden(scope) || !scope) {
      return NextResponse.json({ error: "Only global administrators can import risks" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const parsed = RiskImportBatchSchema.safeParse(body?.rows)
    const fileName = typeof body?.fileName === "string" ? body.fileName.trim().slice(0, 255) : "risk-register.xlsx"
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid import rows" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc("import_risk_register_batch", { p_rows: parsed.data })
    if (error) {
      const duplicate = error.code === "23505"
      log.warn({ err: error.message, code: error.code }, "Risk-register batch import rejected")
      return NextResponse.json(
        {
          error: duplicate
            ? "The register changed after preview. Preview the workbook again to remove duplicates."
            : "Import failed",
        },
        { status: duplicate ? 409 : 500 }
      )
    }

    const risks = (data || []) as RiskRow[]
    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "risk_register_import",
        entityId: risks[0]?.id || scope.userId,
        newValues: { fileName, count: risks.length, riskIds: risks.map((risk) => risk.id) },
        context: { actorId: scope.userId, source: "api", route: "/api/corporate-services/risk-register/import" },
      },
      { failOpen: true }
    )

    const { data: refreshed, error: selectError } = await supabase
      .from("risk_register")
      .select(RISK_COLUMNS)
      .in(
        "id",
        risks.map((risk) => risk.id)
      )
    if (selectError) throw selectError

    return NextResponse.json({ data: (refreshed || []) as RiskRow[], imported: risks.length })
  } catch (error: unknown) {
    log.error({ err: String(error) }, "Failed to import risk-register workbook")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
