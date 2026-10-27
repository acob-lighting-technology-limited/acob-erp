import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={4}
      columns={5}
      rows={8}
      showStats={true}
      tabs={2}
      actions={1}
      statBadges={3}
      spacing="tight"
      list="responsive"
    />
  )
}
