import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { DepartmentCascadeContent } from "../_components/department-cascade-content"

export const metadata: Metadata = {
  title: "Department Cascade | Corporate Scorecard",
  description: "One department's KPIs, targets and recorded progress against the 2026 plan.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function DepartmentCascadePage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>
}) {
  const { department } = await searchParams
  if (department) {
    redirect(`/admin/corporate-scorecard?tab=department&department=${encodeURIComponent(department)}`)
  }
  redirect("/admin/corporate-scorecard?tab=department")
}
