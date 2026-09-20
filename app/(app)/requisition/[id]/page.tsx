import { redirect } from "next/navigation"

/**
 * Notification rows written before the rename still carry /requisition/<id>
 * link_urls, so this stub has to stay.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/requisitions/${id}`)
}
