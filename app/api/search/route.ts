import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const log = logger("search")

// Mark this route as dynamic since it uses search params
export const dynamic = "force-dynamic"

interface SearchResult {
  id: string
  type: string
  title: string
  subtitle?: string
  description?: string
  href: string
  metadata?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(`search:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })
  }

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

    const scope = await resolveAdminScope(supabase as never, user.id)
    if (!scope) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchQuery = query.trim()

    // -----------------------------------------------------------------------
    // Fire all top-level queries in parallel — one round-trip for each entity
    // type instead of sequential awaits.
    // -----------------------------------------------------------------------
    const [
      { data: profiles },
      { data: directAssets },
      { data: directTasks },
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

    const results: SearchResult[] = []

    // -----------------------------------------------------------------------
    // Profile results + batched related-item lookups.
    // Instead of 3 sequential queries per profile (N*3 total), we collect all
    // profile IDs then fire 3 parallel batch queries covering all profiles.
    // -----------------------------------------------------------------------
    if (profiles && profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id)
      const profileNameMap = new Map(
        profiles.map((p) => [
          p.id,
          `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.company_email || "Unknown",
        ])
      )

      // Add profile results
      profiles.forEach((profile) => {
        results.push({
          id: profile.id,
          type: "profile",
          title: profileNameMap.get(profile.id)!,
          subtitle: profile.company_email || undefined,
          description: `${profile.department || ""} ${profile.role || ""}`.trim() || undefined,
          href: `/admin/employees/${profile.id}`,
          metadata: profile as Record<string, unknown>,
        })
      })

      // Batch fetch all related items for all profiles in parallel
      const [
        { data: profileTasks },
        { data: profileAssetAssignments },
        { data: profileDocs },
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, department, assigned_to")
          .in("assigned_to", profileIds)
          .limit(3 * profileIds.length),

        supabase
          .from("asset_assignments")
          .select("id, asset_id, assigned_to, assigned_at, is_current")
          .in("assigned_to", profileIds)
          .eq("is_current", true)
          .limit(3 * profileIds.length),

        supabase
          .from("user_documentation")
          .select("id, title, category, created_at, user_id")
          .in("user_id", profileIds)
          .limit(3 * profileIds.length),
      ])

      // Related tasks
      profileTasks?.forEach((task) => {
        const name = profileNameMap.get(task.assigned_to) ?? "Unknown"
        results.push({
          id: `task-${task.id}`,
          type: "task",
          title: task.title || "Task",
          subtitle: `Assigned to ${name}`,
          description: `${task.department || ""} • ${task.status || ""}`.trim() || undefined,
          href: `/admin/tasks?taskId=${task.id}`,
          metadata: { ...task, related_user: task.assigned_to } as Record<string, unknown>,
        })
      })

      // Related assets — one extra batch query to resolve asset details from IDs
      if (profileAssetAssignments && profileAssetAssignments.length > 0) {
        const assetIds = Array.from(new Set(profileAssetAssignments.map((aa) => aa.asset_id)))
        const assignedToMap = new Map(profileAssetAssignments.map((aa) => [aa.asset_id, aa.assigned_to]))

        const { data: relatedAssets } = await supabase
          .from("assets")
          .select("id, unique_code, asset_type, asset_model, serial_number")
          .in("id", assetIds)
          .is("deleted_at", null)

        relatedAssets?.forEach((asset) => {
          const assignedTo = assignedToMap.get(asset.id)
          const name = assignedTo ? (profileNameMap.get(assignedTo) ?? "Unknown") : "Unknown"
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
            metadata: { ...asset, related_user: assignedTo } as Record<string, unknown>,
          })
        })
      }

      // Related docs
      profileDocs?.forEach((doc) => {
        const name = profileNameMap.get(doc.user_id) ?? "Unknown"
        results.push({
          id: `doc-${doc.id}`,
          type: "documentation",
          title: doc.title || "Documentation",
          subtitle: `Created by ${name}`,
          description: doc.category || undefined,
          href: `/admin/documentation/internal?docId=${doc.id}`,
          metadata: { ...doc, related_user: doc.user_id } as Record<string, unknown>,
        })
      })
    }

    // Direct asset results
    directAssets?.forEach((asset) => {
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
        metadata: asset as Record<string, unknown>,
      })
    })

    // Direct task results
    directTasks?.forEach((task) => {
      results.push({
        id: task.id,
        type: "task",
        title: task.title || "Task",
        subtitle: task.department || undefined,
        description: task.description ? task.description.substring(0, 100) : undefined,
        href: `/admin/tasks?taskId=${task.id}`,
        metadata: task as Record<string, unknown>,
      })
    })

    // Direct documentation results
    documentation?.forEach((doc) => {
      results.push({
        id: doc.id,
        type: "documentation",
        title: doc.title || "Documentation",
        subtitle: doc.category || undefined,
        description: doc.content ? doc.content.substring(0, 100).replace(/[#*`]/g, "") : undefined,
        href: `/admin/documentation/internal?docId=${doc.id}`,
        metadata: doc as Record<string, unknown>,
      })
    })

    // Feedback results
    feedback?.forEach((fb) => {
      results.push({
        id: fb.id,
        type: "feedback",
        title: fb.title || "Feedback",
        subtitle: fb.feedback_type || undefined,
        description: fb.description ? fb.description.substring(0, 100) : undefined,
        href: `/admin/feedback?feedbackId=${fb.id}`,
        metadata: fb as Record<string, unknown>,
      })
    })

    // Deduplicate by id (profile-related queries may overlap with direct queries)
    const seen = new Set<string>()
    const deduped = results.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })

    // Sort: exact title-start matches first, then partial, then rest
    const queryLower = query.toLowerCase()
    deduped.sort((a, b) => {
      const aStart = a.title.toLowerCase().startsWith(queryLower)
      const bStart = b.title.toLowerCase().startsWith(queryLower)
      if (aStart && !bStart) return -1
      if (!aStart && bStart) return 1
      const aContains = a.title.toLowerCase().includes(queryLower)
      const bContains = b.title.toLowerCase().includes(queryLower)
      if (aContains && !bContains) return -1
      if (!aContains && bContains) return 1
      return 0
    })

    return NextResponse.json({ results: deduped.slice(0, 20) })
  } catch (error) {
    log.error({ err: String(error) }, "Search error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
