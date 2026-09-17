import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors EventsWorkspace in staff mode: three tabs and three stat cards.
export default function Loading() {
  return <TablePageSkeleton tabs={3} filters={4} columns={7} showStats statCards={4} />
}
