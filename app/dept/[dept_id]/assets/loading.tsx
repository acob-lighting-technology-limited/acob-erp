import { TablePageSkeleton } from "@/components/skeletons"

export default function AssetsLoading() {
  return (
    <TablePageSkeleton
      statCards={5}
      filters={4}
      columns={8}
      rows={8}
      showStats={true}
      actions={3}
      statBadges={5}
      list="responsive"
    />
  )
}
