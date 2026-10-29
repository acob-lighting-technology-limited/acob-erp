import { TablePageSkeleton } from "@/components/skeletons"

export default function AdminRequisitionLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={7}
      showStats={true}
      statBadges={4}
      spacing="tight"
      list="responsive"
    />
  )
}
