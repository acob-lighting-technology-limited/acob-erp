import type { Metadata } from "next"
import { MdDeskReports } from "@/components/md-desk/md-desk-reports"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

export const metadata: Metadata = {
  title: "MD's Reports | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function AdminMdDeskReportsPage() {
  await requireMdDeskMember("/admin")
  return <MdDeskReports basePath="/admin/md-desk" />
}
