import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors EventsWorkspace in manage mode: three tabs, four stat cards, four filters.
export default function Loading() {
  return <TablePageSkeleton tabs={3} filters={4} columns={7} showStats statCards={4} actions={1} showBackLink />
}
