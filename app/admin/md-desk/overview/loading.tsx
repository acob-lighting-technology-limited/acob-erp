import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors WaitingOnMd: four stat cards and the approvals table.
export default function Loading() {
  return <TablePageSkeleton filters={2} columns={6} showStats statCards={4} />
}
