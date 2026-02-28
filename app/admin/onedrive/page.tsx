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
import { PageHeader, PageWrapper } from "@/components/layout"
import { FolderOpen } from "lucide-react"
import { resolveAdminScope } from "@/lib/admin/rbac"

export const dynamic = "force-dynamic"

async function getUserAndScope() {
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
    redirect("/auth/login")
  }

  const scope = await resolveAdminScope(supabase as any, user.id)
  if (!scope) {
    redirect("/dashboard")
  }

  return { user, scope }
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
  const { scope } = await getUserAndScope()

  // Determine initial path - default to Projects folder if configured
  const defaultProjectsFolder = process.env.ONEDRIVE_PROJECTS_FOLDER || "/Projects"
  const leadRootDepartment = scope.managedDepartments[0]

  if (!scope.isAdminLike && !leadRootDepartment) {
    redirect("/admin?rbac=missing-lead-scope")
  }

  const projectsFolder =
    scope.isAdminLike || !leadRootDepartment
      ? defaultProjectsFolder
      : `${defaultProjectsFolder.replace(/\/+$/, "")}/${leadRootDepartment}`
  const rootLabel = scope.isAdminLike ? "Projects" : leadRootDepartment || "Projects"

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="OneDrive Browser"
        description="Browse and manage project files"
        icon={FolderOpen}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />
      <Suspense fallback={<LoadingSkeleton />}>
        <OneDriveBrowser initialPath={projectsFolder} rootLabel={rootLabel} showProjectsOnly={true} />
      </Suspense>
    </PageWrapper>
  )
}
