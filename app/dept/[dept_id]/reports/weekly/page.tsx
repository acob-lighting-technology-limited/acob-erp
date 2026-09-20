import { redirect } from "next/navigation"

interface Props {
  params: Promise<{ dept_id: string }>
}

/** Canonical route is ./weekly-reports, matching the admin and staff shells. */
export default async function Page({ params }: Props) {
  const { dept_id } = await params
  redirect(`/dept/${dept_id}/reports/weekly-reports`)
}
