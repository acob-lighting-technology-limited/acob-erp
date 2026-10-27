import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors MdDeskDelegates: three stat cards, add action, delegates table.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={2}
      columns={5}
      showStats={true}
      actions={1}
      showBackLink={false}
      statBadges={3}
      list="responsive"
    />
  )
}
