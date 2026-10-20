import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { loadAssignableStaff } from "@/lib/projects/staff-options"
import { ProjectDetail } from "@/components/projects/project-detail"

import { TablePageLayoutProvider } from "@/components/ui/data-table"
import { layout as tablePageLayout } from "./_layout"

export const metadata: Metadata = {
  title: "Project | Matrix",
  description: "A project's progress, plans and charts.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase as DbClient, user.id)
  if (!scope) redirect("/profile")

  const profiles = await loadAssignableStaff(supabase as DbClient)
  return (
    <TablePageLayoutProvider value={tablePageLayout}>
      <ProjectDetail projectId={id} isAdmin profiles={profiles} />
    </TablePageLayoutProvider>
  )
}
