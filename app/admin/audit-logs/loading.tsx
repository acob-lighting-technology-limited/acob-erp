import { TablePageSkeleton } from "@/components/skeletons"

export default function AuditLogsLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={3}
      columns={5}
      rows={10}
      showStats={true}
      actions={1}
      showBackLink={false}
      statBadges={4}
      list="responsive"
    />
  )
}
