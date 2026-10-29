import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors PortalReferenceGeneratorContent: inline actions, four compact stat
// cards, and the row list on a phone
// over the table on a desktop.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={5}
      rows={8}
      showStats={true}
      actions={0}
      statBadges={4}
      spacing="tight"
      inlineActions
      list="responsive"
    />
  )
}
