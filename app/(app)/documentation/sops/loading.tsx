import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      filters={4}
      columns={6}
      rows={8}
      showStats={false}
      statBadges={2}
      actions={0}
      showBackLink
      list="responsive"
    />
  )
}
