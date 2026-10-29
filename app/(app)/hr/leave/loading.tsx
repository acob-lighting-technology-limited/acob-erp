import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors LeaveContent: back link, My Requests / Pending Reviews tabs, inline
// actions, compact stat cards, and the row list it opens on a phone over the
// table it opens on a desktop.
export default function LeaveLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={5}
      rows={6}
      showStats={true}
      tabs={2}
      actions={3}
      showBackLink={false}
      statBadges={4}
      spacing="tight"
      inlineActions
      list="responsive"
    />
  )
}
