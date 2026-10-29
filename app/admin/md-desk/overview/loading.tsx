import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors WaitingOnMd: four stat cards and the approvals table.
export default function Loading() {
  return (
    <TablePageSkeleton
      statCards={4}
      filters={2}
      columns={5}
      showStats={true}
      actions={0}
      statBadges={4}
      list="responsive"
    />
  )
}
