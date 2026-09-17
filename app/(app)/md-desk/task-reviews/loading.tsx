import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors MdDeskTaskReviews: four stat cards, two filters, the review table.
export default function Loading() {
  return <TablePageSkeleton filters={2} columns={7} showStats statCards={4} showBackLink />
}
