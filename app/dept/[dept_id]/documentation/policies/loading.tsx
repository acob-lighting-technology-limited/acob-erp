import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton
      filters={3}
      columns={7}
      rows={8}
      showStats={true}
      statCardVariant="compact"
      statCards={4}
      actions={1}
      showBackLink
      list="responsive"
    />
  )
}
