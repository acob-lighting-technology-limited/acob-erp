/**
 * OneDrive Preview API Route
 * Provides embed/preview URLs for Office documents and other files
 */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getOneDriveService, getFileCategory } from "@/lib/onedrive"

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

/**
 * GET /api/onedrive/preview
 * Get preview/embed URL for a file
 * Query params:
 *   - path: File path in OneDrive
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

    const onedrive = getOneDriveService()

    if (!onedrive.isEnabled()) {
      return NextResponse.json({ error: "OneDrive integration is not configured" }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")

    if (!path) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 })
    }

    // Get file info first
    const fileItem = await onedrive.getItem(path)
    const category = getFileCategory(fileItem.mimeType, fileItem.name)

    let previewUrl: string | null = null
    let previewType: "embed" | "image" | "download" = "download"

    // Determine the best preview method based on file type
    switch (category) {
      case "image":
        // For images, use the download URL directly
        previewUrl = await onedrive.getDownloadUrl(path)
        previewType = "image"
        break

      case "document":
      case "spreadsheet":
      case "presentation":
      case "pdf":
        // For Office docs and PDFs, use the embed preview
        try {
          previewUrl = await onedrive.getPreviewUrl(path)
          previewType = "embed"
        } catch {
          // Fallback to download URL if preview fails
          previewUrl = await onedrive.getDownloadUrl(path)
          previewType = "download"
        }
        break

      default:
        // For other files, provide download URL
        previewUrl = await onedrive.getDownloadUrl(path)
        previewType = "download"
    }

    return NextResponse.json({
      data: {
        file: fileItem,
        category,
        previewUrl,
        previewType,
      },
    })
  } catch (error: unknown) {
    console.error("Error getting preview URL:", error)
    const message = error instanceof Error ? error.message : "Failed to get preview"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
