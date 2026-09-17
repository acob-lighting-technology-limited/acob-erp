import type { Metadata } from "next"
import { MdDeskEngagements } from "@/components/md-desk/md-desk-engagements"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

export const metadata: Metadata = {
  title: "MD's Workshops & Webinars | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function AdminMdDeskWorkshopsPage() {
  await requireMdDeskMember("/admin")
  return <MdDeskEngagements section="workshops" basePath="/admin/md-desk" />
}
