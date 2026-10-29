import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={3}
      columns={5}
      showStats={true}
      actions={0}
      statBadges={3}
      spacing="tight"
      list="responsive"
    />
  )
}
