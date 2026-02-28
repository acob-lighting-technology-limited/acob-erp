/**
 * OneDrive Download API Route
 * Provides download URLs for OneDrive files
 */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getOneDriveService } from "@/lib/onedrive"
import { resolveAdminScope } from "@/lib/admin/rbac"

export const dynamic = "force-dynamic"

function createClient() {
  const cookieStore = cookies()

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore
        }
      },
    },
  })
}

function normalizePath(path: string): string {
  const normalized = `/${path || ""}`.replace(/\/+/g, "/")
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized
}

function leadAllowedPrefixes(managedDepartments: string[]): string[] {
  return managedDepartments.map((dept) => normalizePath(`/Projects/${dept}`))
}

function isPathAllowed(path: string, prefixes: string[]): boolean {
  const normalizedPath = normalizePath(path)
  return prefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))
}

/**
 * GET /api/onedrive/download
 * Get download URL for a file
 * Query params:
 *   - path: File path in OneDrive
 *   - redirect: If "true", redirect to download URL instead of returning JSON
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()

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

    const onedrive = getOneDriveService()

    if (!onedrive.isEnabled()) {
      return NextResponse.json({ error: "OneDrive integration is not configured" }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")
    const redirect = searchParams.get("redirect") === "true"

    if (!path) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 })
    }

    if (!scope.isAdminLike) {
      const allowed = leadAllowedPrefixes(scope.managedDepartments)
      if (allowed.length === 0 || !isPathAllowed(path, allowed)) {
        return NextResponse.json({ error: "Forbidden: outside your allowed department folders" }, { status: 403 })
      }
    }

    const downloadUrl = await onedrive.getDownloadUrl(path)

    if (redirect) {
      return NextResponse.redirect(downloadUrl)
    }

    return NextResponse.json({ data: { downloadUrl } })
  } catch (error: unknown) {
    console.error("Error getting download URL:", error)
    const message = error instanceof Error ? error.message : "Failed to get download URL"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
