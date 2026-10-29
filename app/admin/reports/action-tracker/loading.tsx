import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={5}
      filters={4}
      columns={4}
      rows={8}
      showStats={true}
      actions={3}
      showBackLink
      statBadges={5}
      spacing="tight"
      list="responsive"
    />
  )
}
