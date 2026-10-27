import { TablePageSkeleton } from "@/components/skeletons"

export default function FeedbackLoading() {
  return (
    <TablePageSkeleton
      statCards={5}
      filters={3}
      columns={6}
      rows={8}
      showStats={true}
      actions={1}
      showBackLink
      statBadges={5}
      list="responsive"
    />
  )
}
