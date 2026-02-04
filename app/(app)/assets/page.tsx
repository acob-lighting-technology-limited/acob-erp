import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AssetsContent } from "./assets-content"

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

async function getAssetsData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // Get user's department and office location
  const { data: profile } = await supabase
    .from("profiles")
    .select("department, office_location")
    .eq("id", user.id)
    .single()

  // Fetch individual assignments
  const { data: individualAssignments, error: individualError } = await supabase
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
    console.error("Error loading individual assignments:", individualError)
  }

  // Fetch department and office assignments if user has a department or office
  let departmentAndOfficeAssets: any[] = []
  if (profile?.department || profile?.office_location) {
    const { data: sharedAssets, error: sharedError } = await supabase
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
      .or(
        `and(assignment_type.eq.department,department.eq.${profile.department}),and(assignment_type.eq.office,office_location.eq.${profile.office_location})`
      )

    if (!sharedError && sharedAssets) {
      departmentAndOfficeAssets = sharedAssets.map((asset) => ({
        id: `shared-${asset.id}`,
        assigned_at: asset.created_at,
        assignment_notes:
          asset.assignment_type === "department"
            ? `Assigned to ${asset.department} department`
            : `Assigned to ${asset.office_location} office`,
        assigned_by: null,
        asset_id: asset.id,
        department: asset.department,
        asset: asset,
        assigner: null,
      }))
    }
  }

  // Combine both assignment types
  const allAssignments = [...(individualAssignments || []), ...departmentAndOfficeAssets]

  // Fetch Asset and assigner details separately (only for individual assignments)
  const assignmentsWithDetails = await Promise.all(
    allAssignments.map(async (assignment: any) => {
      if (assignment.asset) {
        return assignment
      }

      const [assetResult, assignerResult] = await Promise.all([
        supabase
          .from("assets")
          .select("id, unique_code, asset_type, asset_model, serial_number, status, acquisition_year")
          .eq("id", assignment.asset_id)
          .single(),
        assignment.assigned_by
          ? supabase.from("profiles").select("first_name, last_name").eq("id", assignment.assigned_by).single()
          : Promise.resolve({ data: null }),
      ])

      return {
        ...assignment,
        asset: assetResult.data,
        assigner: assignerResult.data,
      }
    })
  )

  return {
    assignments: assignmentsWithDetails as AssetAssignment[],
  }
}

export default async function AssetsPage() {
  const data = await getAssetsData()

  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const assetsData = data as { assignments: AssetAssignment[] }

  return <AssetsContent initialAssignments={assetsData.assignments} />
}
