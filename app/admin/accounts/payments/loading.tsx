import { TablePageSkeleton } from "@/components/skeletons"

export default function PaymentsLoading() {
  return (
    <TablePageSkeleton
      statCards={5}
      filters={3}
      columns={7}
      rows={8}
      showStats={true}
      actions={2}
      showBackLink
      spacing="tight"
      list="responsive"
    />
  )
}
