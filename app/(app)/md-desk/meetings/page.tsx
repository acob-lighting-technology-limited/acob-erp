import type { Metadata } from "next"
import { MdDeskEngagements } from "@/components/md-desk/md-desk-engagements"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

export const metadata: Metadata = {
  title: "MD's Meetings | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function MdDeskMeetingsPage() {
  await requireMdDeskMember("/profile")
  return <MdDeskEngagements section="meetings" basePath="/md-desk" />
}
