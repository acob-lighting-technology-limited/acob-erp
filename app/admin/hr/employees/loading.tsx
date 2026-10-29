import { TablePageSkeleton } from "@/components/skeletons"

export default function EmployeesLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={4}
      columns={4}
      rows={10}
      showStats={true}
      tabs={4}
      actions={4}
      statBadges={4}
      list="responsive"
    />
  )
}
