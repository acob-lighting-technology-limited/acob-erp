import { redirect } from "next/navigation"

/** Notification rows written before the rename still carry /admin/project/<id>. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/projects/${id}`)
}
