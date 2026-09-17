import type { Metadata } from "next"
import { MdDeskDelegates } from "@/components/md-desk/md-desk-delegates"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

export const metadata: Metadata = {
  title: "MD's Desk Delegates | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function AdminMdDeskDelegatesPage() {
  await requireMdDeskMember("/admin")
  return <MdDeskDelegates basePath="/admin/md-desk" />
}
