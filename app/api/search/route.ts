import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("role, is_admin").eq("id", user.id).single()

    if (!profile?.is_admin && !["super_admin", "admin", "lead"].includes(profile?.role || "")) {
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

    // Search Profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, company_email, department, role")
      .or(
        `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,company_email.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%`
      )
      .limit(5)

    if (profiles) {
      for (const profile of profiles) {
        const name =
          `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.company_email || "Unknown"

        // Add the profile itself
        results.push({
          id: profile.id,
          type: "profile",
          title: name,
          subtitle: profile.company_email || undefined,
          description: `${profile.department || ""} ${profile.role || ""}`.trim() || undefined,
          href: `/admin/employees/${profile.id}`,
          metadata: profile,
        })

        // Search for related items: Tasks assigned to this user
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, status, department")
          .eq("assigned_to", profile.id)
          .limit(3)

        if (tasks && tasks.length > 0) {
          tasks.forEach((task) => {
            results.push({
              id: `task-${task.id}`,
              type: "task",
              title: task.title || "Task",
              subtitle: `Assigned to ${name}`,
              description: `${task.department || ""} • ${task.status || ""}`.trim() || undefined,
              href: `/admin/tasks?taskId=${task.id}`,
              metadata: { ...task, related_user: profile.id },
            })
          })
        }

        // Search for related items: Assets assigned to this user
        const { data: assetAssignments } = await supabase
          .from("asset_assignments")
          .select("id, asset_id, assigned_at, is_current")
          .eq("assigned_to", profile.id)
          .eq("is_current", true)
          .limit(3)

        if (assetAssignments && assetAssignments.length > 0) {
          const assetIds = assetAssignments.map((aa) => aa.asset_id)
          const { data: assets } = await supabase
            .from("assets")
            .select("id, unique_code, asset_type, asset_model, serial_number")
            .in("id", assetIds)

          if (assets) {
            assets.forEach((asset) => {
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
            })
          }
        }

        // Search for related items: Documentation created by this user
        const { data: documentation } = await supabase
          .from("user_documentation")
          .select("id, title, category, created_at")
          .eq("user_id", profile.id)
          .limit(3)

        if (documentation && documentation.length > 0) {
          documentation.forEach((doc) => {
            results.push({
              id: `doc-${doc.id}`,
              type: "documentation",
              title: doc.title || "Documentation",
              subtitle: `Created by ${name}`,
              description: doc.category || undefined,
              href: `/admin/documentation?docId=${doc.id}`,
              metadata: { ...doc, related_user: profile.id },
            })
          })
        }
      }
    }

    // Search Assets (including unique_code)
    const { data: assets } = await supabase
      .from("assets")
      .select("id, unique_code, asset_type, asset_model, serial_number, status, acquisition_year")
      .or(
        `unique_code.ilike.%${searchQuery}%,asset_type.ilike.%${searchQuery}%,asset_model.ilike.%${searchQuery}%,serial_number.ilike.%${searchQuery}%`
      )
      .limit(5)

    if (assets) {
      assets.forEach((asset) => {
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
      })
    }

    // Search Tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, description, status, department, priority")
      .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%`)
      .limit(5)

    if (tasks) {
      tasks.forEach((task) => {
        results.push({
          id: task.id,
          type: "task",
          title: task.title || "Task",
          subtitle: task.department || undefined,
          description: task.description ? task.description.substring(0, 100) : undefined,
          href: `/admin/tasks?taskId=${task.id}`,
          metadata: task,
        })
      })
    }

    // Search Documentation
    const { data: documentation } = await supabase
      .from("user_documentation")
      .select("id, title, content, category, user_id")
      .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
      .limit(5)

    if (documentation) {
      documentation.forEach((doc) => {
        results.push({
          id: doc.id,
          type: "documentation",
          title: doc.title || "Documentation",
          subtitle: doc.category || undefined,
          description: doc.content ? doc.content.substring(0, 100).replace(/[#*`]/g, "") : undefined,
          href: `/admin/documentation?docId=${doc.id}`,
          metadata: doc,
        })
      })
    }

    // Search Feedback
    const { data: feedback } = await supabase
      .from("feedback")
      .select("id, title, description, feedback_type, status")
      .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      .limit(5)

    if (feedback) {
      feedback.forEach((fb) => {
        results.push({
          id: fb.id,
          type: "feedback",
          title: fb.title || "Feedback",
          subtitle: fb.feedback_type || undefined,
          description: fb.description ? fb.description.substring(0, 100) : undefined,
          href: `/admin/feedback?feedbackId=${fb.id}`,
          metadata: fb,
        })
      })
    }

    // Sort results by relevance (exact matches first, then partial)
    const sortedResults = results.sort((a, b) => {
      const queryLower = query.toLowerCase()
      const aTitle = a.title.toLowerCase()
      const bTitle = b.title.toLowerCase()

      // Exact match at start
      if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1
      if (!aTitle.startsWith(queryLower) && bTitle.startsWith(queryLower)) return 1

      // Contains query
      if (aTitle.includes(queryLower) && !bTitle.includes(queryLower)) return -1
      if (!aTitle.includes(queryLower) && bTitle.includes(queryLower)) return 1

      return 0
    })

    return NextResponse.json({ results: sortedResults.slice(0, 20) })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
