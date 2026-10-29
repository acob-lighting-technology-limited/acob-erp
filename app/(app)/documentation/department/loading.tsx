import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={2}
      columns={4}
      rows={8}
      showStats={true}
      actions={1}
      statBadges={3}
      spacing="tight"
      list="responsive"
    />
  )
}
