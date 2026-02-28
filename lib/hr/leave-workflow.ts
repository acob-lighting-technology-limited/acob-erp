import { sendLeaveWorkflowEmail } from "@/lib/leave-mailer"

type SupabaseClient = any

export const LEAVE_PENDING_STAGES = {
  RELIEVER: "reliever_pending",
  SUPERVISOR: "supervisor_pending",
  HR: "hr_pending",
} as const

export type LeavePendingStage = (typeof LEAVE_PENDING_STAGES)[keyof typeof LEAVE_PENDING_STAGES]

export type LeaveEligibilityStatus = "eligible" | "not_eligible" | "missing_evidence"

export interface LeavePolicyRecord {
  leave_type_id: string
  annual_days: number
  eligibility: string
  min_tenure_months: number
  notice_days: number
  accrual_mode: "calendar_days" | "business_days"
  is_active: boolean
  eligibility_conditions?: Record<string, any>
  required_documents?: string[]
  frequency_rules?: Record<string, any>
  override_allowed?: boolean
}

export interface LeaveEligibilityResult {
  status: LeaveEligibilityStatus
  reason: string | null
  requiredDocuments: string[]
  missingDocuments: string[]
}

const APPROVAL_LEVELS: Record<string, number> = {
  reliever_pending: 1,
  supervisor_pending: 2,
  hr_pending: 3,
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DAY_MS = 24 * 60 * 60 * 1000

export function isValidUUID(value: string) {
  return UUID_REGEX.test(value)
}

export function parseISODate(dateString: string) {
  const parsed = new Date(`${dateString}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format")
  }
  return parsed
}

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

export function diffMonths(fromDate: Date, toDate: Date) {
  const years = toDate.getUTCFullYear() - fromDate.getUTCFullYear()
  const months = toDate.getUTCMonth() - fromDate.getUTCMonth()
  return years * 12 + months
}

function isWeekend(date: Date) {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

async function hasLifeEvent(
  supabase: SupabaseClient,
  employeeId: string,
  eventTypes: string[],
  windowDays?: number
): Promise<boolean> {
  let query = supabase
    .from("employee_life_events")
    .select("id, event_date")
    .eq("employee_id", employeeId)
    .in("event_type", eventTypes)
    .order("event_date", { ascending: false })
    .limit(1)

  if (windowDays && Number.isFinite(windowDays) && windowDays > 0) {
    const earliest = addDays(new Date(), -windowDays)
    query = query.gte("event_date", toISODate(earliest))
  }

  const { data } = await query
  return Boolean(data && data.length)
}

export async function getHolidaySet(supabase: SupabaseClient, location: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from("holiday_calendar")
    .select("holiday_date, is_business_day")
    .eq("location", location)
    .gte("holiday_date", startDate)
    .lte("holiday_date", endDate)

  if (error) {
    throw new Error("Failed to fetch holiday calendar")
  }

  const holidaySet = new Set<string>()
  for (const row of data || []) {
    if (!row.is_business_day) {
      holidaySet.add(row.holiday_date)
    }
  }

  return holidaySet
}

function isBusinessDay(date: Date, holidaySet: Set<string>) {
  if (isWeekend(date)) return false
  return !holidaySet.has(toISODate(date))
}

export async function computeLeaveDates(params: {
  supabase: SupabaseClient
  startDate: string
  daysCount: number
  accrualMode: "calendar_days" | "business_days"
  location?: string | null
}) {
  const start = parseISODate(params.startDate)

  if (params.daysCount <= 0) {
    throw new Error("Number of days must be greater than zero")
  }

  if (params.accrualMode === "calendar_days") {
    const end = addDays(start, params.daysCount - 1)
    const resume = addDays(end, 1)

    return {
      endDate: toISODate(end),
      resumeDate: toISODate(resume),
    }
  }

  const searchEnd = addDays(start, Math.max(120, params.daysCount * 4))
  const holidaySet = await getHolidaySet(
    params.supabase,
    params.location || "global",
    toISODate(start),
    toISODate(searchEnd)
  )

  let current = new Date(start)
  let counted = 0

  while (counted < params.daysCount) {
    if (isBusinessDay(current, holidaySet)) {
      counted += 1
      if (counted === params.daysCount) break
    }
    current = addDays(current, 1)
  }

  const end = current
  let resume = addDays(end, 1)
  while (!isBusinessDay(resume, holidaySet)) {
    resume = addDays(resume, 1)
  }

  return {
    endDate: toISODate(end),
    resumeDate: toISODate(resume),
  }
}

export async function resolveProfileByIdentifier(
  supabase: SupabaseClient,
  identifier: string,
  label: string
): Promise<{ id: string; full_name: string | null; company_email: string | null; department_id: string | null }> {
  const input = identifier.trim()
  if (!input) throw new Error(`${label} is required`)

  if (isValidUUID(input)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, company_email, department_id")
      .eq("id", input)
      .maybeSingle()

    if (error) throw new Error(`Failed to resolve ${label}`)
    if (!data) throw new Error(`${label} not found`)
    return data
  }

  const isEmail = input.includes("@")
  if (isEmail) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, company_email, department_id")
      .ilike("company_email", input)

    if (error) throw new Error(`Failed to resolve ${label}`)
    if (!data?.length) throw new Error(`${label} email not found`)
    if (data.length > 1) throw new Error(`${label} email resolved to multiple records`)
    return data[0]
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, company_email, department_id")
    .ilike("full_name", input)

  if (error) throw new Error(`Failed to resolve ${label}`)
  if (!data?.length) throw new Error(`${label} name not found`)
  if (data.length > 1) throw new Error(`${label} name is ambiguous. Use email or ID.`)
  return data[0]
}

export async function getSupervisorForUser(supabase: SupabaseClient, userId: string) {
  const { data: userProfile, error: userProfileError } = await supabase
    .from("profiles")
    .select("department_id")
    .eq("id", userId)
    .single()

  if (userProfileError || !userProfile?.department_id) {
    throw new Error("Cannot determine your department for supervisor mapping")
  }

  const { data: supervisor, error: supervisorError } = await supabase
    .from("profiles")
    .select("id, full_name, company_email, department_id")
    .eq("department_id", userProfile.department_id)
    .eq("is_department_lead", true)
    .limit(1)
    .maybeSingle()

  if (supervisorError) {
    throw new Error("Failed to resolve supervisor")
  }

  if (!supervisor) {
    throw new Error("No department lead configured for your department")
  }

  return supervisor
}

export async function getLeavePolicy(supabase: SupabaseClient, leaveTypeId: string): Promise<LeavePolicyRecord> {
  const { data, error } = await supabase
    .from("leave_policies")
    .select(
      "leave_type_id, annual_days, eligibility, min_tenure_months, notice_days, accrual_mode, is_active, eligibility_conditions, required_documents, frequency_rules, override_allowed"
    )
    .eq("leave_type_id", leaveTypeId)
    .maybeSingle()

  // Backward compatibility: some environments may still run an older leave_policies schema.
  // If the governance columns are not present yet, re-query the legacy column set.
  if (error) {
    const missingGovernanceColumn =
      typeof error.message === "string" &&
      (error.message.includes("eligibility_conditions") ||
        error.message.includes("required_documents") ||
        error.message.includes("frequency_rules") ||
        error.message.includes("override_allowed"))

    if (!missingGovernanceColumn) {
      throw new Error("Failed to load leave policy")
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("leave_policies")
      .select("leave_type_id, annual_days, eligibility, min_tenure_months, notice_days, accrual_mode, is_active")
      .eq("leave_type_id", leaveTypeId)
      .maybeSingle()

    if (legacyError) throw new Error("Failed to load leave policy")

    if (legacyData?.is_active) {
      return {
        ...legacyData,
        eligibility_conditions: {},
        required_documents: [],
        frequency_rules: {},
        override_allowed: true,
      }
    }
  }

  if (data?.is_active) {
    return {
      ...data,
      eligibility_conditions: data.eligibility_conditions || {},
      required_documents: toStringArray(data.required_documents),
      frequency_rules: data.frequency_rules || {},
      override_allowed: data.override_allowed ?? true,
    }
  }

  const { data: leaveType, error: leaveTypeError } = await supabase
    .from("leave_types")
    .select("max_days")
    .eq("id", leaveTypeId)
    .single()

  if (leaveTypeError || !leaveType) {
    throw new Error("Leave type not found")
  }

  return {
    leave_type_id: leaveTypeId,
    annual_days: leaveType.max_days,
    eligibility: "all",
    min_tenure_months: 0,
    notice_days: 0,
    accrual_mode: "calendar_days",
    is_active: true,
    eligibility_conditions: {},
    required_documents: [],
    frequency_rules: {},
    override_allowed: true,
  }
}

export async function evaluateLeaveEligibility(params: {
  supabase: SupabaseClient
  policy: LeavePolicyRecord
  requesterProfile: {
    id: string
    gender: string | null
    employment_date: string | null
    employment_type?: string | null
    marital_status?: string | null
    has_children?: boolean | null
    pregnancy_status?: string | null
  }
  leaveType: { code?: string | null; name?: string | null }
  startDate: string
  daysCount: number
}): Promise<LeaveEligibilityResult> {
  const { supabase, policy, requesterProfile, leaveType, startDate, daysCount } = params
  const missingDocuments = new Set<string>()
  const requiredDocuments = new Set<string>(toStringArray(policy.required_documents))

  const normalizedGender = (requesterProfile.gender || "unspecified").toLowerCase()

  if (policy.eligibility === "female_only" && normalizedGender !== "female") {
    return {
      status: "not_eligible",
      reason: "This leave type is only available to female employees.",
      requiredDocuments: Array.from(requiredDocuments),
      missingDocuments: [],
    }
  }

  if (policy.eligibility === "male_only" && normalizedGender !== "male") {
    return {
      status: "not_eligible",
      reason: "This leave type is only available to male employees.",
      requiredDocuments: Array.from(requiredDocuments),
      missingDocuments: [],
    }
  }

  if (policy.min_tenure_months > 0) {
    if (!requesterProfile.employment_date) {
      return {
        status: "not_eligible",
        reason: "Employment date is required to validate tenure policy.",
        requiredDocuments: Array.from(requiredDocuments),
        missingDocuments: [],
      }
    }

    const hireDate = parseISODate(requesterProfile.employment_date)
    const leaveDate = parseISODate(startDate)
    const months = diffMonths(hireDate, leaveDate)

    if (months < policy.min_tenure_months) {
      return {
        status: "not_eligible",
        reason: `This leave type requires at least ${policy.min_tenure_months} months tenure.`,
        requiredDocuments: Array.from(requiredDocuments),
        missingDocuments: [],
      }
    }
  }

  if (policy.notice_days > 0) {
    const today = new Date()
    const todayIso = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())))
    const minDate = addDays(parseISODate(todayIso), policy.notice_days)
    const leaveStart = parseISODate(startDate)

    if (leaveStart < minDate) {
      return {
        status: "not_eligible",
        reason: `This leave type requires at least ${policy.notice_days} days notice.`,
        requiredDocuments: Array.from(requiredDocuments),
        missingDocuments: [],
      }
    }
  }

  const conditions = (policy.eligibility_conditions || {}) as Record<string, any>
  const frequencyRules = (policy.frequency_rules || {}) as Record<string, any>

  if (Array.isArray(conditions.allowed_employment_types) && conditions.allowed_employment_types.length > 0) {
    if (
      !requesterProfile.employment_type ||
      !conditions.allowed_employment_types.includes(requesterProfile.employment_type)
    ) {
      return {
        status: "not_eligible",
        reason: "Your employment type is not eligible for this leave type.",
        requiredDocuments: Array.from(requiredDocuments),
        missingDocuments: [],
      }
    }
  }

  if (Array.isArray(conditions.requires_marital_status_in) && conditions.requires_marital_status_in.length > 0) {
    if (
      !requesterProfile.marital_status ||
      !conditions.requires_marital_status_in.includes(requesterProfile.marital_status)
    ) {
      return {
        status: "not_eligible",
        reason: "Marital status requirement is not satisfied for this leave type.",
        requiredDocuments: Array.from(requiredDocuments),
        missingDocuments: [],
      }
    }
  }

  if (conditions.requires_has_children === true && !requesterProfile.has_children) {
    return {
      status: "not_eligible",
      reason: "This leave type requires employees with children.",
      requiredDocuments: Array.from(requiredDocuments),
      missingDocuments: [],
    }
  }

  const eventWindow = Number(conditions.event_window_days || 365)

  if (conditions.requires_pregnancy_event === true) {
    const profileSatisfies = ["pregnant", "postpartum"].includes(
      (requesterProfile.pregnancy_status || "").toLowerCase()
    )
    const hasEvent = await hasLifeEvent(supabase, requesterProfile.id, ["pregnancy", "childbirth"], eventWindow)

    if (!profileSatisfies && !hasEvent) {
      missingDocuments.add("medical_confirmation")
      requiredDocuments.add("medical_confirmation")
    }
  }

  if (conditions.requires_childbirth_or_adoption_event === true) {
    const hasEvent = await hasLifeEvent(supabase, requesterProfile.id, ["childbirth", "adoption"], eventWindow)
    if (!hasEvent) {
      missingDocuments.add("birth_or_adoption_proof")
      requiredDocuments.add("birth_or_adoption_proof")
    }
  }

  if (conditions.requires_bereavement_event === true) {
    const hasEvent = await hasLifeEvent(supabase, requesterProfile.id, ["bereavement"], eventWindow)
    if (!hasEvent) {
      missingDocuments.add("bereavement_declaration")
      requiredDocuments.add("bereavement_declaration")
    }
  }

  if (conditions.requires_study_purpose === true) {
    missingDocuments.add("admission_or_exam_letter")
    requiredDocuments.add("admission_or_exam_letter")
  }

  const medicalThreshold = Number(frequencyRules.medical_certificate_after_days || 0)
  if (medicalThreshold > 0 && daysCount > medicalThreshold) {
    requiredDocuments.add("medical_certificate")
    missingDocuments.add("medical_certificate")
  }

  const maxDaysPerRequest = Number(frequencyRules.max_days_per_request || 0)
  if (maxDaysPerRequest > 0 && daysCount > maxDaysPerRequest) {
    return {
      status: "not_eligible",
      reason: `This leave type allows at most ${maxDaysPerRequest} days per request.`,
      requiredDocuments: Array.from(requiredDocuments),
      missingDocuments: [],
    }
  }

  if (missingDocuments.size > 0) {
    const leaveName = leaveType.name || leaveType.code || "this leave type"
    return {
      status: "missing_evidence",
      reason: `Additional evidence is required before ${leaveName} can proceed for approval.`,
      requiredDocuments: Array.from(requiredDocuments),
      missingDocuments: Array.from(missingDocuments),
    }
  }

  return {
    status: "eligible",
    reason: null,
    requiredDocuments: Array.from(requiredDocuments),
    missingDocuments: [],
  }
}

export async function areRequiredDocumentsVerified(
  supabase: SupabaseClient,
  leaveRequestId: string,
  requiredDocuments: string[]
) {
  if (!requiredDocuments.length) {
    return { complete: true, missing: [] as string[] }
  }

  const { data: evidenceRows } = await supabase
    .from("leave_evidence")
    .select("document_type, status")
    .eq("leave_request_id", leaveRequestId)

  const verifiedSet = new Set(
    (evidenceRows || [])
      .filter((row: { status: string }) => row.status === "verified")
      .map((row: { document_type: string }) => row.document_type)
  )

  const missing = requiredDocuments.filter((doc) => !verifiedSet.has(doc))
  return {
    complete: missing.length === 0,
    missing,
  }
}

export async function assertNoOverlap(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
  excludeRequestId?: string
) {
  let query = supabase
    .from("leave_requests")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["pending", "pending_evidence", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)

  if (excludeRequestId) {
    query = query.neq("id", excludeRequestId)
  }

  const { data, error } = await query.limit(1)

  if (error) throw new Error("Failed to validate overlapping leave")
  if (data && data.length > 0) {
    throw new Error("You already have an overlapping leave request for this date range")
  }
}

export async function assertRelieverAvailability(
  supabase: SupabaseClient,
  relieverId: string,
  startDate: string,
  endDate: string,
  excludeRequestId?: string
) {
  let query = supabase
    .from("leave_requests")
    .select("id")
    .eq("user_id", relieverId)
    .in("status", ["pending", "pending_evidence", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)

  if (excludeRequestId) {
    query = query.neq("id", excludeRequestId)
  }

  const { data, error } = await query.limit(1)

  if (error) throw new Error("Failed to validate reliever availability")
  if (data && data.length > 0) {
    throw new Error("Selected reliever is unavailable in the requested date range")
  }
}

function buildNotificationRows(params: {
  userIds: string[]
  title: string
  message: string
  actorId?: string
  linkUrl?: string
  entityId?: string
}) {
  return params.userIds.map((userId) => ({
    user_id: userId,
    type: "approval_request",
    category: "approvals",
    title: params.title,
    message: params.message,
    priority: "high",
    link_url: params.linkUrl || "/dashboard/leave",
    actor_id: params.actorId || null,
    entity_type: "leave_request",
    entity_id: params.entityId || null,
  }))
}

export async function notifyUsers(
  supabase: SupabaseClient,
  params: {
    userIds: string[]
    title: string
    message: string
    actorId?: string
    linkUrl?: string
    entityId?: string
    emailSubject?: string
    emailTitle?: string
    emailMessage?: string
  }
) {
  const uniqueIds = Array.from(new Set(params.userIds.filter(Boolean)))
  if (!uniqueIds.length) return

  const rows = buildNotificationRows({
    userIds: uniqueIds,
    title: params.title,
    message: params.message,
    actorId: params.actorId,
    linkUrl: params.linkUrl,
    entityId: params.entityId,
  })

  await supabase.from("notifications").insert(rows)

  const { data: recipients } = await supabase
    .from("profiles")
    .select("company_email, additional_email")
    .in("id", uniqueIds)

  const emails: string[] = Array.from(
    new Set(
      ((recipients || []) as { company_email?: string | null; additional_email?: string | null }[])
        .flatMap((profile) => [profile.company_email, profile.additional_email])
        .filter((email): email is string => typeof email === "string" && email.length > 0)
    )
  )

  if (emails.length) {
    await sendLeaveWorkflowEmail({
      to: emails,
      subject: params.emailSubject || params.title,
      title: params.emailTitle || params.title,
      message: params.emailMessage || params.message,
      ctaPath: params.linkUrl,
    })
  }
}

export async function createApprovalRecord(
  supabase: SupabaseClient,
  params: {
    leaveRequestId: string
    approverId: string
    stage: string
    action: "approved" | "rejected"
    comments?: string | null
  }
) {
  const approvalLevel = APPROVAL_LEVELS[params.stage] || 1

  await supabase.from("leave_approvals").insert({
    leave_request_id: params.leaveRequestId,
    approver_id: params.approverId,
    approval_level: approvalLevel,
    status: params.action,
    comments: params.comments || null,
    approved_at: new Date().toISOString(),
  })
}

export async function syncAttendanceForApprovedLeave(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
  mode: "set" | "clear"
) {
  const start = parseISODate(startDate)
  const end = parseISODate(endDate)

  if (mode === "set") {
    const rows = []
    let current = new Date(start)

    while (current <= end) {
      rows.push({
        user_id: userId,
        date: toISODate(current),
        status: "on_leave",
        notes: "Auto-generated from approved leave",
      })
      current = addDays(current, 1)
    }

    if (rows.length) {
      await supabase.from("attendance_records").upsert(rows, { onConflict: "user_id,date", ignoreDuplicates: false })
    }

    return
  }

  await supabase
    .from("attendance_records")
    .delete()
    .eq("user_id", userId)
    .eq("status", "on_leave")
    .gte("date", startDate)
    .lte("date", endDate)
}
