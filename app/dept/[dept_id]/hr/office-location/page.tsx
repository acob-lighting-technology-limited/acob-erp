import { redirect } from "next/navigation"

interface Props {
  params: Promise<{ dept_id: string }>
}

/** Canonical route is ./offices-rooms, matching the "Offices & Rooms" label. */
export default async function Page({ params }: Props) {
  const { dept_id } = await params
  redirect(`/dept/${dept_id}/hr/offices-rooms`)
}
