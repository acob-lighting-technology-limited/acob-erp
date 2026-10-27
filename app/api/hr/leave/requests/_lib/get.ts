/** GET /api/hr/leave/requests (split from route.ts, audit 5.10). */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { enforceRouteAccessV2, requireAccessContextV2 } from "@/lib/admin/api-guard-v2"
import { applyDataScopeV2 } from "@/lib/admin/policy-v2"
import { getRequestScope } from "@/lib/admin/api-scope"
import { areRequiredDocumentsVerified, getLeavePolicy } from "@/lib/hr/leave-workflow"
import { getLeaveEntitlements } from "@/lib/hr/leave-entitlement"
import { getPaginationRange, PaginationSchema } from "@/lib/pagination"
import { toLocalISODate } from "@/lib/utils/date"
import {
  log,
  ProfileReferenceRow,
  LeaveTypeReferenceRow,
  LeaveEvidenceRow,
  LeaveApprovalRow,
  LeaveRequestRow,
  LeavePolicySummary,
  RelieverOption,
  RelieverDebug,
  normalizeDepartment,
  buildProfileLabel,
} from "./shared"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const dataClient = getServiceRoleClientOrFallback(supabase)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = request.nextUrl
    const paginationParsed = PaginationSchema.safeParse({
      page: searchParams.get("page") || "1",
      per_page: searchParams.get("limit") || "20",
    })
    if (!paginationParsed.success) {
      return NextResponse.json({ error: "Invalid pagination params" }, { status: 400 })
    }
    const wantsPage = searchParams.has("page") || searchParams.has("limit")
    const status = searchParams.get("status")
    const userId = searchParams.get("user_id")
    const all = searchParams.get("all") === "true"
    let scopedMode: "all" | "dept" | "none" = "all"
    let scopedDepartments: string[] = []

    // Read via the service-role client. Department scoping is enforced in code below
    // (applyDataScopeV2), and the non-admin path is guarded — so this does NOT widen
    // access; it only lets every admin tier (developer/super_admin/lead), not just the
    // exact `admin` role, see leave that RLS would otherwise hide.
    let query = dataClient
      .from("leave_requests")
      .select(
        `
        *,
        user:profiles!leave_requests_user_id_profiles_fkey (
          id, full_name, first_name, last_name, company_email, department
        ),
        leave_type:leave_types!leave_requests_leave_type_id_fkey (
          id, name
        ),
        approvals:leave_approvals (
          id, approver_id, status, stage_code, approved_at, comments
        ),
        leave_request_segments (
          start_date, end_date, days_count, segment_order
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)

    const targetUserId = userId || user.id

    if (all) {
      const contextResult = await requireAccessContextV2()
      if (!contextResult.ok) {
        return contextResult.response
      }
      const routeAccess = enforceRouteAccessV2(contextResult.context, "hr.leave")
      if (!routeAccess.ok) {
        return routeAccess.response
      }
      if (routeAccess.dataScope === "none") {
        return NextResponse.json({ data: [], meta: { total: 0, page: 1, per_page: 20 } })
      }
      if (routeAccess.dataScope !== "all") {
        scopedMode = "dept"
        scopedDepartments = routeAccess.dataScope
      }
    } else {
      // Non-admin path: a caller may only read their OWN requests unless admin-like.
      // (We now read with the service-role client, so RLS no longer guards this.)
      if (userId && userId !== user.id) {
        const requesterScope = await getRequestScope()
        if (!requesterScope?.isAdminLike) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
      query = query.eq("user_id", targetUserId)
    }

    const { from, to } = getPaginationRange(paginationParsed.data)
    const { data: requests, error, count } = wantsPage ? await query.range(from, to) : await query
    if (error) {
      return NextResponse.json({ error: `Failed to fetch leave requests: ${error.message}` }, { status: 500 })
    }

    const requestRows = ((requests || []) as LeaveRequestRow[]).filter((row) =>
      all ? true : row.user_id === targetUserId
    )
    const requestIds = requestRows.map((row) => row.id).filter(Boolean)

    // Derived from the leave type allowance minus this user's requests — see
    // lib/hr/leave-entitlement.ts. Shaped like the stored rows this used to read so the
    // response contract is unchanged.
    const balanceRows = (await getLeaveEntitlements(dataClient, targetUserId)).map((e) => ({
      user_id: targetUserId,
      leave_type_id: e.leaveTypeId,
      allocated_days: e.entitlementDays,
      used_days: e.usedDays,
      pending_days: e.pendingDays,
      carry_forward_days: 0,
      balance_days: e.remainingDays,
    }))

    let evidenceRows: LeaveEvidenceRow[] = []
    let approvalRows: LeaveApprovalRow[] = []

    if (requestIds.length > 0) {
      const [{ data: evidenceData }, { data: approvalsData }] = await Promise.all([
        dataClient
          .from("leave_evidence")
          .select("id, leave_request_id, document_type, file_url, status, verified_by, verified_at, notes, created_at")
          .in("leave_request_id", requestIds),
        dataClient
          .from("leave_approvals")
          .select(
            "id, leave_request_id, approver_id, approval_level, status, comments, approved_at, stage_code, stage_order, superseded, reliever_revision"
          )
          .in("leave_request_id", requestIds),
      ])

      evidenceRows = evidenceData || []
      approvalRows = approvalsData || []
    }

    const profileIdSet = new Set<string>()
    for (const row of requestRows) {
      if (row.user_id) profileIdSet.add(row.user_id)
      if (row.reliever_id) profileIdSet.add(row.reliever_id)
      if (row.supervisor_id) profileIdSet.add(row.supervisor_id)
      if (row.approved_by) profileIdSet.add(row.approved_by)
      if (row.current_approver_user_id) profileIdSet.add(row.current_approver_user_id)
    }
    for (const approval of approvalRows) {
      if (approval.approver_id) profileIdSet.add(approval.approver_id)
    }

    const leaveTypeIdSet = new Set<string>()
    for (const row of requestRows) {
      if (row.leave_type_id) leaveTypeIdSet.add(row.leave_type_id)
    }
    for (const balance of balanceRows) {
      if (balance.leave_type_id) leaveTypeIdSet.add(balance.leave_type_id)
    }

    let profileRows: ProfileReferenceRow[] = []
    let leaveTypeRows: LeaveTypeReferenceRow[] = []

    const profileIds = Array.from(profileIdSet)
    const leaveTypeIds = Array.from(leaveTypeIdSet)

    if (profileIds.length > 0) {
      const { data } = await dataClient
        .from("profiles")
        .select("id, first_name, last_name, full_name, company_email, department_id, department")
        .in("id", profileIds)
      profileRows = data || []
    }

    if (leaveTypeIds.length > 0) {
      const { data, error: leaveTypeError } = await dataClient
        .from("leave_types")
        .select("id, name, code, max_days, requires_approval")
        .in("id", leaveTypeIds)
      // Don't fail silently: an unselectable column here used to blank the leave
      // type on every row in the UI with no trace of why.
      if (leaveTypeError) {
        log.error("[hr/leave/requests] leave_types lookup failed:", leaveTypeError.message)
      }
      leaveTypeRows = data || []
    }

    const profileMap = new Map((profileRows || []).map((row) => [row.id, row] as const))
    const leaveTypeMap = new Map((leaveTypeRows || []).map((row) => [row.id, row] as const))

    const filteredRequestRows =
      all && scopedMode === "dept"
        ? applyDataScopeV2(requestRows, scopedDepartments, (row) =>
            row.user_id ? profileMap.get(row.user_id)?.department || null : null
          )
        : requestRows
    const evidenceByRequest = new Map<string, LeaveEvidenceRow[]>()
    const approvalsByRequest = new Map<string, Array<LeaveApprovalRow & { approver: ProfileReferenceRow | null }>>()

    for (const evidence of evidenceRows) {
      const rows = evidenceByRequest.get(evidence.leave_request_id) || []
      rows.push(evidence)
      evidenceByRequest.set(evidence.leave_request_id, rows)
    }

    for (const approval of approvalRows) {
      const rows = approvalsByRequest.get(approval.leave_request_id) || []
      rows.push({
        ...approval,
        approver: approval.approver_id ? profileMap.get(approval.approver_id) || null : null,
      })
      approvalsByRequest.set(approval.leave_request_id, rows)
    }

    // Pre-fetch all leave policies in parallel (one per unique leave_type_id)
    // instead of fetching inside the map (which would be N sequential queries).
    const uniqueLeaveTypeIds = Array.from(new Set(requestRows.map((r) => r.leave_type_id).filter(Boolean)))
    const policyEntries = await Promise.all(
      uniqueLeaveTypeIds.map(async (ltId) => {
        const policy = await getLeavePolicy(supabase, ltId as string)
        return [ltId, policy] as const
      })
    )
    const policyMap = new Map(policyEntries)

    // Check evidence completeness for all requests in parallel
    const enriched = await Promise.all(
      filteredRequestRows.map(async (leaveRequest) => {
        const policy = (policyMap.get(leaveRequest.leave_type_id) ?? { required_documents: [] }) as LeavePolicySummary
        const requiredDocs = policy.required_documents || []
        const evidence = await areRequiredDocumentsVerified(supabase, leaveRequest.id, requiredDocs)
        return {
          ...leaveRequest,
          user: leaveRequest.user_id ? profileMap.get(leaveRequest.user_id) || null : null,
          reliever: leaveRequest.reliever_id ? profileMap.get(leaveRequest.reliever_id) || null : null,
          supervisor: leaveRequest.supervisor_id ? profileMap.get(leaveRequest.supervisor_id) || null : null,
          approved_by_profile: leaveRequest.approved_by ? profileMap.get(leaveRequest.approved_by) || null : null,
          current_approver: leaveRequest.current_approver_user_id
            ? profileMap.get(leaveRequest.current_approver_user_id) || null
            : null,
          leave_type:
            (leaveRequest.leave_type_id ? leaveTypeMap.get(leaveRequest.leave_type_id) : null) ??
            (leaveRequest as { leave_type?: LeaveTypeReferenceRow | null }).leave_type ??
            null,
          evidence: evidenceByRequest.get(leaveRequest.id) || [],
          approvals: approvalsByRequest.get(leaveRequest.id) || [],
          required_documents: requiredDocs,
          evidence_complete: evidence.complete,
          missing_documents: evidence.missing,
        }
      })
    )

    const balances = balanceRows.map((row) => ({
      ...row,
      leave_type: row.leave_type_id ? leaveTypeMap.get(row.leave_type_id) || null : null,
    }))

    let relieverCommitments: LeaveRequestRow[] = []
    if (!all) {
      const todayIsoDate = toLocalISODate()
      const { data: relieverRows } = await supabase
        .from("leave_requests")
        .select(
          `
          id,
          user_id,
          leave_type_id,
          start_date,
          end_date,
          resume_date,
          days_count,
          status,
          user:profiles!leave_requests_user_id_profiles_fkey(id, full_name, company_email),
          leave_type:leave_types!leave_requests_leave_type_id_fkey(id, name)
        `
        )
        .eq("reliever_id", targetUserId)
        .neq("user_id", targetUserId)
        .in("status", ["pending", "pending_evidence", "approved"])
        .gte("end_date", todayIsoDate)
        .order("start_date", { ascending: true })

      relieverCommitments = relieverRows || []
    }

    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("id, department_id, department")
      .eq("id", user.id)
      .maybeSingle<ProfileReferenceRow>()

    const requesterDepartment = requesterProfile?.department || null
    const requesterDepartmentId = requesterProfile?.department_id || null
    const requesterProfileId = requesterProfile?.id || user.id

    const relieverCandidatesById = new Map<string, ProfileReferenceRow>()
    let totalProfilesScanned = 0

    if (requesterDepartmentId) {
      const { data: byDeptId } = await dataClient
        .from("profiles")
        .select("id, first_name, last_name, full_name, company_email, department_id, department")
        .eq("department_id", requesterDepartmentId)
        .neq("id", requesterProfileId)
        .order("first_name", { ascending: true })
      const rows = (byDeptId as ProfileReferenceRow[] | null) || []
      totalProfilesScanned += rows.length
      for (const row of rows) {
        if (row.id) relieverCandidatesById.set(row.id, row)
      }
    }

    if (requesterDepartment) {
      const { data: byDeptName } = await dataClient
        .from("profiles")
        .select("id, first_name, last_name, full_name, company_email, department_id, department")
        .eq("department", requesterDepartment)
        .neq("id", requesterProfileId)
        .order("first_name", { ascending: true })
      const rows = (byDeptName as ProfileReferenceRow[] | null) || []
      totalProfilesScanned += rows.length
      for (const row of rows) {
        if (row.id) relieverCandidatesById.set(row.id, row)
      }
    }

    const requesterDepartmentName = normalizeDepartment(requesterDepartment)
    const relieverRows = Array.from(relieverCandidatesById.values()).filter((row) => {
      const sameDepartmentId = Boolean(requesterDepartmentId && row.department_id === requesterDepartmentId)
      const sameDepartmentName =
        requesterDepartmentName.length > 0 && normalizeDepartment(row.department) === requesterDepartmentName
      return sameDepartmentId || sameDepartmentName
    })

    const relieverOptions: RelieverOption[] = relieverRows
      .map((row) => ({ value: row.id, label: buildProfileLabel(row) }))
      .filter((row) => Boolean(row.value))

    const relieverDebug: RelieverDebug = {
      reason: !requesterDepartment && !requesterDepartmentId ? "requester_has_no_department" : undefined,
      user_id: user.id,
      requester_profile_id: requesterProfileId || null,
      requester_department: requesterDepartment,
      requester_department_id: requesterDepartmentId,
      resolution_source: "requests_get_profile",
      total_profiles_scanned: totalProfilesScanned,
      matched_profiles: relieverRows.length,
      options_count: relieverOptions.length,
    }

    return NextResponse.json({
      data: enriched,
      balances: balances || [],
      reliever_options: relieverOptions,
      reliever_debug: relieverDebug,
      reliever_commitments: relieverCommitments,
      pagination: {
        page: paginationParsed.data.page,
        limit: wantsPage ? paginationParsed.data.per_page : count || enriched.length || paginationParsed.data.per_page,
        total: count || 0,
        total_pages: wantsPage && count ? Math.ceil(count / paginationParsed.data.per_page) : count ? 1 : 0,
      },
    })
  } catch (error) {
    log.error({ err: String(error) }, "Unhandled error in GET")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
