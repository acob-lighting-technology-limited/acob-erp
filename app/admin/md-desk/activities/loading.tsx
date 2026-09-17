import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors MdDeskEngagements: three tabs, four stat cards, export + new event actions.
export default function Loading() {
  return <TablePageSkeleton tabs={3} filters={3} columns={7} showStats statCards={4} actions={2} showBackLink />
}
