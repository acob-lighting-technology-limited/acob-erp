import { TablePageSkeleton } from "@/components/skeletons/table-page-skeleton"

export default function FeedbackLoading() {
  return (
    <TablePageSkeleton
      statCards={3}
      filters={2}
      columns={4}
      rows={8}
      showStats={true}
      tabs={2}
      actions={1}
      statBadges={3}
      spacing="tight"
      list="responsive"
    />
  )
}
