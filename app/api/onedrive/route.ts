/**
 * OneDrive API Routes
 * Handles folder listing and file upload operations
 */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getOneDriveService } from "@/lib/onedrive"

export const dynamic = "force-dynamic"

// Helper function to create Supabase client for auth check
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
 * GET /api/onedrive
 * List folder contents from OneDrive
 * Query params:
 *   - path: Folder path to list (default: /)
 *   - search: Optional search query
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const onedrive = getOneDriveService()

    // Check if OneDrive is enabled
    if (!onedrive.isEnabled()) {
      return NextResponse.json({ error: "OneDrive integration is not configured" }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path") || "/"
    const search = searchParams.get("search")

    let files

    if (search) {
      // Search for files
      files = await onedrive.searchFiles(search, path !== "/" ? path : undefined)
    } else {
      // List folder contents
      files = await onedrive.listFolder(path)
    }

    // Sort: folders first, then by name
    files.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      data: files,
      path,
      parentPath: path === "/" ? null : path.substring(0, path.lastIndexOf("/")) || "/",
    })
  } catch (error: unknown) {
    console.error("Error listing OneDrive folder:", error)
    const message = error instanceof Error ? error.message : "Failed to list folder"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/onedrive
 * Upload a file to OneDrive
 * Body: FormData with:
 *   - file: The file to upload
 *   - path: Destination folder path
 *   - fileName: Optional custom filename
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin (only admins can upload to OneDrive directly)
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Only administrators can upload files directly to OneDrive" }, { status: 403 })
    }

    const onedrive = getOneDriveService()

    if (!onedrive.isEnabled()) {
      return NextResponse.json({ error: "OneDrive integration is not configured" }, { status: 503 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const path = formData.get("path") as string | null
    const customFileName = formData.get("fileName") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!path) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 })
    }

    const fileName = customFileName || file.name
    const fullPath = `${path}/${fileName}`.replace(/\/+/g, "/")

    // Get file content as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Upload to OneDrive
    const result = await onedrive.uploadFile(fullPath, arrayBuffer, file.type)

    return NextResponse.json({
      data: {
        id: result.id,
        name: result.name,
        path: fullPath,
        webUrl: result.webUrl,
        size: result.size,
      },
    })
  } catch (error: unknown) {
    console.error("Error uploading to OneDrive:", error)
    const message = error instanceof Error ? error.message : "Failed to upload file"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
