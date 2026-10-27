import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors DirectoryContent: inline actions, four compact stat cards, and the
// responsive layout (contacts on mobile, table on desktop).
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={3}
      columns={5}
      rows={9}
      showStats={true}
      tabs={3}
      actions={2}
      statBadges={4}
      spacing="tight"
      inlineActions
      list="responsive"
    />
  )
}
