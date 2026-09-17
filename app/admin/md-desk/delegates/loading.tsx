import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors MdDeskDelegates: three stat cards, add action, delegates table.
export default function Loading() {
  return <TablePageSkeleton filters={2} columns={5} showStats statCards={3} actions={1} showBackLink />
}
