import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors MdDeskEngagements: three tabs, four stat cards, export + new event actions.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      showStats={true}
      tabs={3}
      actions={2}
      showBackLink={false}
      list="responsive"
    />
  )
}
