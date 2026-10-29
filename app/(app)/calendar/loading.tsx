import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors EventsWorkspace in staff mode: three tabs and three stat cards.
export default function Loading() {
  return (
    <TablePageSkeleton statCards={4} filters={2} columns={7} showStats={true} tabs={3} actions={2} list="responsive" />
  )
}
