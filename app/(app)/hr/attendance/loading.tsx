import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors AttendanceContent: Log/Calendar tabs, inline actions, four compact
// stat cards, and the row list on a
// phone over the table on a desktop.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      rows={8}
      showStats={true}
      tabs={2}
      actions={1}
      statBadges={4}
      spacing="tight"
      inlineActions
      list="responsive"
    />
  )
}
