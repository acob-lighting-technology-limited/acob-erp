/**
 * OneDrive Browser Page
 * Server component that renders the OneDrive file browser
 */

import { Suspense } from "react"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { OneDriveBrowser } from "./onedrive-browser"
import { Skeleton } from "@/components/ui/skeleton"

export const dynamic = "force-dynamic"

async function getUser() {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

function LoadingSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function OneDrivePage() {
  await getUser()

  // Determine initial path - default to Projects folder if configured
  const projectsFolder = process.env.ONEDRIVE_PROJECTS_FOLDER || "/Projects"

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <Suspense fallback={<LoadingSkeleton />}>
        <OneDriveBrowser initialPath={projectsFolder} rootLabel="Projects" showProjectsOnly={true} />
      </Suspense>
    </div>
  )
}
