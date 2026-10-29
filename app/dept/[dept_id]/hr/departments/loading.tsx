import { TablePageSkeleton } from "@/components/skeletons"

export default function DepartmentsLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      rows={6}
      showStats={true}
      tabs={3}
      actions={3}
      statBadges={4}
      list="responsive"
    />
  )
}
