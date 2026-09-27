import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors DirectoryContent: inline actions, four compact stat cards, and the
// responsive layout (contacts on mobile, table on desktop).
export default function Loading() {
  return (
    <TablePageSkeleton
      tabs={3}
      filters={3}
      columns={5}
      rows={9}
      showStats
      statCards={4}
      spacing="tight"
      inlineActions
      actions={2}
      list="responsive"
      groups={3}
    />
  )
}
