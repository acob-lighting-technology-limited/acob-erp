import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={4}
      columns={7}
      showStats={true}
      actions={2}
      statBadges={3}
      spacing="tight"
      list="responsive"
    />
  )
}
