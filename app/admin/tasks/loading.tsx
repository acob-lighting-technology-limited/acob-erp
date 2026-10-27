import { TablePageSkeleton } from "@/components/skeletons"

export default function TasksLoading() {
  return (
    <TablePageSkeleton
      statCards={5}
      filters={4}
      columns={7}
      rows={8}
      showStats={true}
      tabs={2}
      actions={3}
      statBadges={5}
      list="responsive"
    />
  )
}
