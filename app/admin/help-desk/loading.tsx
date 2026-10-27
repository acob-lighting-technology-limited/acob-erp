import { TablePageSkeleton } from "@/components/skeletons"

export default function AdminHelpDeskLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={4}
      columns={7}
      rows={8}
      showStats={true}
      tabs={3}
      actions={0}
      statBadges={4}
      list="responsive"
    />
  )
}
