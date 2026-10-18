import type { Metadata } from "next"
import type { SupabaseClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { resolveDeptConsoles } from "@/lib/dept/consoles"
import type { Database } from "@/types/database"
import { GuideContent, type GuideExtraModule } from "./guide-content"

export const metadata: Metadata = {
  title: "Matrix Guide | ACOB Lighting Technology Limited",
  description: "What Matrix is, the modules you can use, and how to get started.",
}

/**
 * The in-app guide to Matrix. Replaces the old public /launch page, which now
 * redirects here. Everything staff can open is listed for every viewer; the
 * admin shell, department consoles and MD's Desk are added only for viewers
 * who can actually enter them, so the guide never links to a dead end.
 */
export default async function GuidePage() {
  const supabase = await createClient()
  const typedSupabase = supabase as SupabaseClient<Database>
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, is_department_lead, lead_departments, department")
    .eq("id", data.user.id)
    .single()

  const [adminScope, deptConsoles, mdDesk] = await Promise.all([
    resolveAdminScope(typedSupabase, data.user.id),
    resolveDeptConsoles(typedSupabase, profile),
    supabase.rpc("is_md_desk_member"),
  ])

  const extras: GuideExtraModule[] = []
  if (mdDesk.data === true) {
    extras.push({
      kind: "md-desk",
      name: "MD's Desk",
      href: "/md-desk",
      summary: "The Managing Director's workspace: meetings, reports, task reviews, workshops and activities.",
    })
  }
  for (const deptConsole of deptConsoles) {
    extras.push({
      kind: "dept",
      name: `${deptConsole.name} console`,
      href: deptConsole.href,
      summary: "Your department's view across HR, tasks, PMS, reports, assets and help desk tickets.",
    })
  }
  if (adminScope) {
    extras.push({
      kind: "admin",
      name: "Admin",
      href: "/admin",
      summary: "Run the modules you manage: approvals, records, settings and reports.",
    })
  }

  return <GuideContent firstName={profile?.first_name ?? null} extras={extras} />
}
