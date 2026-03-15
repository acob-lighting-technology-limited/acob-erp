import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"

// Mark this route as dynamic since it uses search params
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scope = await resolveAdminScope(supabase as any, user.id)
    if (!scope) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchQuery = query.trim()
    const results: Array<{
      id: string
      type: string
      title: string
      subtitle?: string
      description?: string
      href: string
      metadata?: Record<string, any>
    }> = []

    // -------------------------------------------------------------------------
    // Run all top-level searches in parallel — zero sequential round-trips
    // -------------------------------------------------------------------------
    const [
      { data: profiles },
      { data: assets },
      { data: tasks },
      { data: documentation },
      { data: feedback },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, department, role")
        .or(
          `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,company_email.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%`
        )
        .limit(5),

      supabase
        .from("assets")
        .select("id, unique_code, asset_type, asset_model, serial_number, status, acquisition_year")
        .is("deleted_at", null)
        .or(
          `unique_code.ilike.%${searchQuery}%,asset_type.ilike.%${searchQuery}%,asset_model.ilike.%${searchQuery}%,serial_number.ilike.%${searchQuery}%`
        )
        .limit(5),

      supabase
        .from("tasks")
        .select("id, title, description, status, department, priority")
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%`)
        .limit(5),

      supabase
        .from("user_documentation")
        .select("id, title, content, category, user_id")
        .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
        .limit(5),

      supabase
        .from("feedback")
        .select("id, title, description, feedback_type, status")
        .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(5),
    ])

    // -------------------------------------------------------------------------
    // For profiles found, batch-fetch related tasks, asset assignments, and docs
    // in 3 parallel queries (instead of 3 per-profile queries = N×3 → 3 total)
    // -------------------------------------------------------------------------
    if (profiles && profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id)

      const [
        { data: relatedTasks },
        { data: relatedAssignments },
        { data: relatedDocs },
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, department, assigned_to")
          .in("assigned_to", profileIds)
          .limit(15),

        supabase
          .from("asset_assignments")
          .select("id, asset_id, assigned_to, assigned_at, is_current")
          .in("assigned_to", profileIds)
          .eq("is_current", true)
          .limit(15),

        supabase
          .from("user_documentation")
          .select("id, title, category, created_at, user_id")
          .in("user_id", profileIds)
          .limit(15),
      ])

      // Fetch asset details for all current assignments in one query
      const assetIds = (relatedAssignments || []).map((a) => a.asset_id).filter(Boolean)
      const { data: relatedAssets } = assetIds.length > 0
        ? await supabase
            .from("assets")
            .select("id, unique_code, asset_type, asset_model, serial_number")
            .in("id", assetIds)
            .is("deleted_at", null)
        : { data: [] }

      // Build lookup maps for O(1) access
      const tasksByUser = new Map<string, typeof relatedTasks>()
      for (const task of relatedTasks || []) {
        const list = tasksByUser.get(task.assigned_to) || []
        list.push(task)
        tasksByUser.set(task.assigned_to, list)
      }

      const assignmentsByUser = new Map<string, typeof relatedAssignments>()
      for (const assignment of relatedAssignments || []) {
        const list = assignmentsByUser.get(assignment.assigned_to) || []
        list.push(assignment)
        assignmentsByUser.set(assignment.assigned_to, list)
      }

      const docsByUser = new Map<string, typeof relatedDocs>()
      for (const doc of relatedDocs || []) {
        const list = docsByUser.get(doc.user_id) || []
        list.push(doc)
        docsByUser.set(doc.user_id, list)
      }

      const assetMap = new Map((relatedAssets || []).map((a) => [a.id, a]))

      for (const profile of profiles) {
        const name =
          `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.company_email || "Unknown"

        results.push({
          id: profile.id,
          type: "profile",
          title: name,
          subtitle: profile.company_email || undefined,
          description: `${profile.department || ""} ${profile.role || ""}`.trim() || undefined,
          href: `/admin/employees/${profile.id}`,
          metadata: profile,
        })

        // Related tasks (from batch)
        for (const task of tasksByUser.get(profile.id) || []) {
          results.push({
            id: `task-${task.id}`,
            type: "task",
            title: task.title || "Task",
            subtitle: `Assigned to ${name}`,
            description: `${task.department || ""} • ${task.status || ""}`.trim() || undefined,
            href: `/admin/tasks?taskId=${task.id}`,
            metadata: { ...task, related_user: profile.id },
          })
        }

        // Related assets (from batch)
        for (const assignment of assignmentsByUser.get(profile.id) || []) {
          const asset = assetMap.get(assignment.asset_id)
          if (!asset) continue
          results.push({
            id: `asset-${asset.id}`,
            type: "asset",
            title: asset.unique_code || asset.asset_type || "Asset",
            subtitle: `Assigned to ${name}`,
            description: asset.asset_model
              ? `Model: ${asset.asset_model}`
              : asset.serial_number
                ? `SN: ${asset.serial_number}`
                : undefined,
            href: `/admin/assets?assetId=${asset.id}`,
            metadata: { ...asset, related_user: profile.id },
          })
        }

        // Related docs (from batch)
        for (const doc of docsByUser.get(profile.id) || []) {
          results.push({
            id: `doc-${doc.id}`,
            type: "documentation",
            title: doc.title || "Documentation",
            subtitle: `Created by ${name}`,
            description: doc.category || undefined,
            href: `/admin/documentation/internal?docId=${doc.id}`,
            metadata: { ...doc, related_user: profile.id },
          })
        }
      }
    }

    // Direct asset search results
    for (const asset of assets || []) {
      results.push({
        id: asset.id,
        type: "asset",
        title: asset.unique_code || "Asset",
        subtitle: asset.asset_type || undefined,
        description: asset.asset_model
          ? `Model: ${asset.asset_model}`
          : asset.serial_number
            ? `SN: ${asset.serial_number}`
            : asset.status || undefined,
        href: `/admin/assets?assetId=${asset.id}`,
        metadata: asset,
      })
    }

    // Direct task search results
    for (const task of tasks || []) {
      results.push({
        id: task.id,
        type: "task",
        title: task.title || "Task",
        subtitle: task.department || undefined,
        description: task.description ? task.description.substring(0, 100) : undefined,
        href: `/admin/tasks?taskId=${task.id}`,
        metadata: task,
      })
    }

    // Direct documentation search results
    for (const doc of documentation || []) {
      results.push({
        id: doc.id,
        type: "documentation",
        title: doc.title || "Documentation",
        subtitle: doc.category || undefined,
        description: doc.content ? doc.content.substring(0, 100).replace(/[#*`]/g, "") : undefined,
        href: `/admin/documentation/internal?docId=${doc.id}`,
        metadata: doc,
      })
    }

    // Feedback results
    for (const fb of feedback || []) {
      results.push({
        id: fb.id,
        type: "feedback",
        title: fb.title || "Feedback",
        subtitle: fb.feedback_type || undefined,
        description: fb.description ? fb.description.substring(0, 100) : undefined,
        href: `/admin/feedback?feedbackId=${fb.id}`,
        metadata: fb,
      })
    }

    // Deduplicate by id and sort by relevance
    const seen = new Set<string>()
    const unique = results.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    const queryLower = query.toLowerCase()
    const sorted = unique.sort((a, b) => {
      const aTitle = a.title.toLowerCase()
      const bTitle = b.title.toLowerCase()
      if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1
      if (!aTitle.startsWith(queryLower) && bTitle.startsWith(queryLower)) return 1
      if (aTitle.includes(queryLower) && !bTitle.includes(queryLower)) return -1
      if (!aTitle.includes(queryLower) && bTitle.includes(queryLower)) return 1
      return 0
    })

    return NextResponse.json({ results: sorted.slice(0, 20) })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
