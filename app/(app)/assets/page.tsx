import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { AssetsContent } from "./assets-content"

import { logger } from "@/lib/logger"

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
}

type AssetsPageClient = Awaited<ReturnType<typeof createClient>>

type AssetProfileRow = {
  department?: string | null
  department_id?: string | null
  office_location?: string | null
}

type SharedAssetRow = Asset & {
  created_at?: string | null
}

type SharedAssignmentRow = {
  id: string
  assigned_at: string
  assignment_notes?: string | null
  assigned_by?: string | null
  asset_id: string
  department?: string | null
  asset?: Asset | null
  assigner?: { first_name: string; last_name: string } | null
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

  // Get user's department and office location
  const { data: profile } = await dataClient
    .from("profiles")
    .select("department, department_id, office_location")
    .eq("id", user.id)
    .single()

  const typedProfile = profile as AssetProfileRow | null
  let profileDepartment = typedProfile?.department || null
  if (typedProfile?.department_id) {
    const { data: deptById } = await dataClient
      .from("departments")
      .select("name")
      .eq("id", typedProfile.department_id)
      .maybeSingle()
    if (deptById?.name) profileDepartment = deptById.name
  }
  if (String(profileDepartment || "").toLowerCase() === "finance") {
    profileDepartment = "Accounts"
  }

  let loadError: string | null = null

  // Fetch individual assignments
  const { data: individualAssignments, error: individualError } = await dataClient
    .from("asset_assignments")
    .select(
      `
      id,
      assigned_at,
      assignment_notes,
      assigned_by,
      asset_id,
      department
    `
    )
    .eq("assigned_to", user.id)
    .eq("is_current", true)
    .order("assigned_at", { ascending: false })

  if (individualError) {
    log.error("Error loading individual assignments:", individualError)
    loadError = "Failed to load some asset data"
  }

  // Fetch department and office assignments if user has a department or office
  let departmentAndOfficeAssets: SharedAssignmentRow[] = []
  if (profileDepartment || profile?.office_location) {
    const [departmentAssetsRes, officeAssetsRes] = await Promise.all([
      profileDepartment
        ? dataClient
            .from("assets")
            .select(
              `
              id,
              unique_code,
              asset_type,
              asset_model,
              serial_number,
              status,
              acquisition_year,
              assignment_type,
              department,
              office_location,
              created_at
            `
            )
            .eq("status", "assigned")
            .is("deleted_at", null)
            .eq("assignment_type", "department")
            .eq("department", profileDepartment)
        : Promise.resolve({ data: [] as SharedAssetRow[], error: null }),
      profile?.office_location
        ? dataClient
            .from("assets")
            .select(
              `
              id,
              unique_code,
              asset_type,
              asset_model,
              serial_number,
              status,
              acquisition_year,
              assignment_type,
              department,
              office_location,
              created_at
            `
            )
            .eq("status", "assigned")
            .is("deleted_at", null)
            .eq("assignment_type", "office")
            .eq("office_location", profile.office_location)
        : Promise.resolve({ data: [] as SharedAssetRow[], error: null }),
    ])

    if (departmentAssetsRes.error || officeAssetsRes.error) {
      log.error("Error loading shared asset assignments:", departmentAssetsRes.error || officeAssetsRes.error)
      loadError = loadError || "Failed to load some asset data"
    }

    const sharedAssets = [...(departmentAssetsRes.data || []), ...(officeAssetsRes.data || [])]
    const seen = new Set<string>()
    departmentAndOfficeAssets = sharedAssets
      .filter((asset) => {
        if (!asset?.id || seen.has(asset.id)) return false
        seen.add(asset.id)
        return true
      })
      .map((asset) => ({
        id: `shared-${asset.id}`,
        assigned_at: asset.created_at,
        assignment_notes:
          asset.assignment_type === "department"
            ? `Assigned to ${asset.department} department`
            : `Assigned to ${asset.office_location} office`,
        assigned_by: null,
        asset_id: asset.id,
        department: asset.department,
        asset,
        assigner: null,
      }))
  }

  // Combine both assignment types
  const allAssignments = [...(individualAssignments || []), ...departmentAndOfficeAssets]

  // Fetch Asset and assigner details separately (only for individual assignments)
  const assignmentsWithDetails = await Promise.all(
    allAssignments.map(async (assignment: SharedAssignmentRow) => {
      if (assignment.asset) {
        return assignment
      }

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
