import { TablePageSkeleton } from "@/components/skeletons"

export default function AttendanceReportsLoading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={3}
      columns={8}
      rows={8}
      showStats={true}
      tabs={6}
      actions={3}
      statBadges={3}
      list="responsive"
    />
  )
}
