import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      filters={2}
      columns={5}
      rows={8}
      showStats={false}
      actions={0}
      showBackLink={false}
      statBadges={3}
      list="responsive"
    />
  )
}
