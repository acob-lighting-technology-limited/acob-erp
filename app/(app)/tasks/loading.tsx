import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors TasksContent: back link, tight rhythm, five compact stat cards, and
// the row list it opens on a phone over the table it opens on a desktop.
export default function TasksLoading() {
  return (
    <TablePageSkeleton
      statCards={6}
      filters={3}
      columns={8}
      rows={8}
      showStats={true}
      actions={0}
      showBackLink={false}
      statBadges={6}
      spacing="tight"
      list="responsive"
    />
  )
}
