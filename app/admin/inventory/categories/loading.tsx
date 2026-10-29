import { TablePageSkeleton } from "@/components/skeletons"

export default function CategoriesLoading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={4}
      rows={6}
      showStats={true}
      actions={3}
      statBadges={4}
      list="responsive"
    />
  )
}
