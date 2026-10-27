import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={4}
      columns={8}
      rows={8}
      showStats={true}
      showBackLink
      statBadges={4}
      spacing="tight"
      list="responsive"
    />
  )
}
