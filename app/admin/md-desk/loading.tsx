import { TablePageSkeleton } from "@/components/skeletons"

// Mirrors MdDeskWorkspace: five tabs, four stat cards, the approvals table.
export default function Loading() {
  return <TablePageSkeleton tabs={5} filters={2} columns={6} showStats statCards={4} actions={1} showBackLink />
}
