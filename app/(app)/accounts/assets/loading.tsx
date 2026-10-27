import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors AssetsContent: back link, four compact stat cards, and the row list
// it opens on a phone over the table it opens on a desktop.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      rows={8}
      showStats={true}
      actions={0}
      showBackLink={false}
      statBadges={4}
      spacing="tight"
      list="responsive"
    />
  )
}
