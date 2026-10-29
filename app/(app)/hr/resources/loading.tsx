import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      rows={8}
      showStats={true}
      tabs={2}
      statBadges={4}
      spacing="tight"
      list="responsive"
    />
  )
}
