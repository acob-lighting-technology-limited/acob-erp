import type { Metadata } from "next"
import { MdDeskTaskReviews } from "@/components/md-desk/md-desk-task-reviews"
import { requireMdDeskMember } from "@/lib/md-desk/gate"

export const metadata: Metadata = {
  title: "MD's Task Reviews | ACOB Lighting Technology Limited",
}

export const dynamic = "force-dynamic"

export default async function MdDeskTaskReviewsPage() {
  await requireMdDeskMember("/profile")
  return <MdDeskTaskReviews basePath="/md-desk" />
}
