import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { AssetsContent } from "./assets-content"

import { logger } from "@/lib/logger"
import { acceptanceRespondBy, type AcceptanceStatus } from "@/lib/assets/acceptance"
import type { AssetRecordReportKind } from "@/lib/assets/asset-reports"
import { loadApprovedLeaveDates, loadHolidays } from "@/lib/hr/non-working-days"
import { addIsoDays } from "@/lib/hr/leave-days"
import { nonWorkingDaysFor } from "@/lib/tasks/overdue"
import { toLocalISODate } from "@/lib/utils/date"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Assets" }

const log = logger("assets")

export interface Asset {
  id: string
  unique_code: string
  asset_type: string
  asset_model?: string
  serial_number?: string
  status: string
  acquisition_year?: number
  assignment_type?: "individual" | "department" | "office"
  department?: string
  office_location?: string
}

export interface AssetAssignment {
  id: string
  assigned_at: string
  assignment_notes?: string
  assigned_by: string
  asset: Asset
  assigner?: {
    first_name: string
    last_name: string
  }
  department?: string
  acceptance_status: AcceptanceStatus
  /** While acceptance is pending: the last day to respond before it counts as received. */
  respond_by: string | null
  /** A record problem this person reported and an admin has not decided yet. */
  open_report_kind: AssetRecordReportKind | null
}

type AssetsPageClient = Awaited<ReturnType<typeof createClient>>

type IndividualAssignmentRow = {
  id: string
  assigned_at: string
  assignment_notes?: string | null
  assigned_by?: string | null
  asset_id: string
  department?: string | null
  acceptance_status: AcceptanceStatus
  created_at: string
}

const isDefined = <T,>(value: T | null | undefined): value is T => value != null

async function getAssetsData() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase as AssetsPageClient)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  let loadError: string | null = null

  // Fetch individual assignments only
  const { data: individualAssignments, error: individualError } = await dataClient
    .from("asset_assignments")
    .select(
      `
      id,
      assigned_at,
      assignment_notes,
      assigned_by,
      asset_id,
      department,
      acceptance_status,
      created_at
    `
    )
    .eq("assigned_to", user.id)
    .eq("is_current", true)
    .order("assigned_at", { ascending: false })

  if (individualError) {
    log.error("Error loading individual assignments:", individualError)
    loadError = "Failed to load some asset data"
  }

  const assignmentsList = (individualAssignments || []) as IndividualAssignmentRow[]

  // Fetch Asset and assigner details for individual assignments
  const assignmentsWithDetails = await Promise.all(
    assignmentsList.map(async (assignment) => {
      const [assetResult, assignerResult] = await Promise.all([
        dataClient
          .from("assets")
          .select("id, unique_code, asset_type, asset_model, serial_number, status, acquisition_year")
          .eq("id", assignment.asset_id)
          .is("deleted_at", null)
          .single(),
        assignment.assigned_by
          ? dataClient.from("profiles").select("first_name, last_name").eq("id", assignment.assigned_by).single()
          : Promise.resolve({ data: null }),
      ])

      return {
        ...assignment,
        asset: assetResult.data,
        assigner: assignerResult.data,
      }
    })
  )

  // Open reports, so a row shows "report sent" instead of inviting a second one.
  const { data: openReports } = await dataClient
    .from("asset_reports")
    .select("assignment_id, kind")
    .eq("reported_by", user.id)
    .eq("status", "open")
  const openReportByAssignment = new Map(
    ((openReports || []) as { assignment_id: string | null; kind: AssetRecordReportKind }[])
      .filter((report) => report.assignment_id)
      .map((report) => [report.assignment_id as string, report.kind])
  )

  // The respond-by date skips weekends, holidays and this person's own leave, as the daily job does.
  const pendingEntered = assignmentsList
    .filter((a) => a.acceptance_status === "pending")
    .map((a) => toLocalISODate(new Date(a.created_at)))
    .sort()
  let respondByFor = (_enteredIso: string): string | null => null
  if (pendingEntered.length > 0) {
    const start = pendingEntered[0]
    const end = addIsoDays(toLocalISODate(), 60)
    const [holidays, leave] = await Promise.all([
      loadHolidays(dataClient, start, end),
      loadApprovedLeaveDates(dataClient, [user.id], start, end),
    ])
    const excluded = nonWorkingDaysFor(holidays, leave.get(user.id) ?? [])
    respondByFor = (enteredIso) => acceptanceRespondBy(enteredIso, excluded)
  }

  const assignments = assignmentsWithDetails
    .map((entry): AssetAssignment | null => {
      if (!entry.asset) return null

      return {
        id: entry.id,
        assigned_at: entry.assigned_at,
        assignment_notes: entry.assignment_notes || undefined,
        assigned_by: entry.assigned_by || "",
        asset: entry.asset,
        assigner: entry.assigner || undefined,
        department: entry.department || undefined,
        acceptance_status: entry.acceptance_status,
        respond_by:
          entry.acceptance_status === "pending" ? respondByFor(toLocalISODate(new Date(entry.created_at))) : null,
        open_report_kind: openReportByAssignment.get(entry.id) ?? null,
      }
    })
    .filter(isDefined)

  return {
    assignments,
    loadError,
  }
}

export default async function AssetsPage() {
  const data = await getAssetsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const assetsData = data as { assignments: AssetAssignment[]; loadError?: string | null }

  return <AssetsContent initialAssignments={assetsData.assignments} initialError={assetsData.loadError} />
}
