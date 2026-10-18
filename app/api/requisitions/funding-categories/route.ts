import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { canManageRequisitionSettings } from "@/lib/requisitions/route-helpers"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { apiError, ApiErrorCode, validationError } from "@/lib/api/errors"
import { CreateFundingCategorySchema, UpdateFundingCategorySchema } from "@/lib/requisitions/schemas"

const log = logger("api-requisition-funding-categories")

/** Row shape selected from `requisition_funding_categories` (not in generated types). */
type FundingCategoryRow = {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
}

const SELECT_COLUMNS = "id, code, name, description, is_active, sort_order"

function slugifyCode(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

/** Only finance admins may curate the funder list. */
const canManageFundingCategories = canManageRequisitionSettings

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)

    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true"
    const dataClient = getServiceRoleClientOrFallback(supabase)

    let query = dataClient
      .from("requisition_funding_categories")
      .select(SELECT_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })

    if (!includeInactive) {
      query = query.eq("is_active", true)
    }

    const { data, error } = await query

    if (error) {
      log.error({ err: error.message }, "Failed to load funding categories")
      return apiError(error.message, ApiErrorCode.INTERNAL_ERROR, 500)
    }

    return NextResponse.json({ data: (data || []) as FundingCategoryRow[] })
  } catch (err) {
    log.error({ err: String(err) }, "Unexpected error in GET /api/requisitions/funding-categories")
    return apiError("Internal Server Error", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)
    if (!(await canManageFundingCategories())) return apiError("Forbidden", ApiErrorCode.FORBIDDEN, 403)

    const parsed = CreateFundingCategorySchema.safeParse(await request.json())
    if (!parsed.success) {
      return validationError(parsed.error.issues)
    }

    const code = parsed.data.code || slugifyCode(parsed.data.name)
    if (!code) {
      return apiError("Could not derive a code from that name", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const { data, error } = await dataClient
      .from("requisition_funding_categories")
      .insert({
        code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        sort_order: parsed.data.sort_order ?? 100,
      })
      .select(SELECT_COLUMNS)
      .single()

    if (error) {
      if (error.code === "23505") {
        return apiError("A funding category with that code already exists", ApiErrorCode.VALIDATION_ERROR, 409)
      }
      log.error({ err: error.message }, "Failed to create funding category")
      return apiError(error.message, ApiErrorCode.INTERNAL_ERROR, 500)
    }

    await writeAuditLog(
      supabase,
      {
        action: "create",
        entityType: "requisition_funding_category",
        entityId: data.id,
        newValues: { code: data.code, name: data.name },
        context: { actorId: user.id, source: "api", route: "/api/requisitions/funding-categories" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: data as FundingCategoryRow }, { status: 201 })
  } catch (err) {
    log.error({ err: String(err) }, "Unexpected error in POST /api/requisitions/funding-categories")
    return apiError("Internal Server Error", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return apiError("Unauthorized", ApiErrorCode.UNAUTHORIZED, 401)
    if (!(await canManageFundingCategories())) return apiError("Forbidden", ApiErrorCode.FORBIDDEN, 403)

    const parsed = UpdateFundingCategorySchema.safeParse(await request.json())
    if (!parsed.success) {
      return validationError(parsed.error.issues)
    }

    const { id, ...changes } = parsed.data
    if (Object.keys(changes).length === 0) {
      return apiError("No changes supplied", ApiErrorCode.VALIDATION_ERROR, 400)
    }

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const { data, error } = await dataClient
      .from("requisition_funding_categories")
      .update(changes)
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single()

    if (error || !data) {
      log.error({ err: error?.message }, "Failed to update funding category")
      return apiError(error?.message || "Funding category not found", ApiErrorCode.INTERNAL_ERROR, 500)
    }

    await writeAuditLog(
      supabase,
      {
        action: "update",
        entityType: "requisition_funding_category",
        entityId: id,
        newValues: changes,
        context: { actorId: user.id, source: "api", route: "/api/requisitions/funding-categories" },
      },
      { failOpen: true }
    )

    return NextResponse.json({ data: data as FundingCategoryRow })
  } catch (err) {
    log.error({ err: String(err) }, "Unexpected error in PATCH /api/requisitions/funding-categories")
    return apiError("Internal Server Error", ApiErrorCode.INTERNAL_ERROR, 500)
  }
}
