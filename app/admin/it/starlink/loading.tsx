import { TablePageSkeleton } from "@/components/skeletons"

export default function StarlinkKitsLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={3}
      columns={7}
      rows={8}
      showStats={true}
      tabs={2}
      actions={2}
      statBadges={4}
      list="responsive"
    />
  )
}
