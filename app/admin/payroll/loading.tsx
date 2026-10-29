import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <TablePageSkeleton statCards={3} columns={4} showStats={true} tabs={2} statBadges={3} list="responsive" />
}
