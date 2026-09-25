import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      filters={3}
      columns={7}
      rows={10}
      showStats
      statCards={4}
      tabs={2}
      actions={2}
      list="responsive"
    />
  )
}
