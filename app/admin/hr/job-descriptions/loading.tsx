import { TablePageSkeleton } from "@/components/skeletons"

export default function JobDescriptionsLoading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={2}
      columns={5}
      rows={8}
      showStats={true}
      actions={0}
      statBadges={3}
      list="responsive"
    />
  )
}
