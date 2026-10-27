import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors MdDeskTaskReviews: four stat cards, two filters, the review table.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      showStats={true}
      actions={0}
      showBackLink={false}
      statBadges={4}
    />
  )
}
