import { redirect } from "next/navigation"

export default async function DepartmentCascadePage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>
}) {
  const { department } = await searchParams
  if (department) {
    redirect(`/admin/corporate-services/scorecard?tab=department&department=${encodeURIComponent(department)}`)
  }
  redirect("/admin/corporate-services/scorecard?tab=department")
}
