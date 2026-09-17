import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ProjectDetail } from "@/components/projects/project-detail"

export const metadata: Metadata = {
  title: "Project | Matrix",
  description: "A project's progress, plans and charts.",
}

/** Read-only for staff: the project list API only returns projects they can see. */
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect("/auth/login")

  return <ProjectDetail projectId={id} isAdmin={false} />
}
