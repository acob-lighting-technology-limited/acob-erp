import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <TablePageSkeleton statCards={4} filters={3} columns={6} rows={8} showStats={true} actions={2} statBadges={4} />
  )
}
