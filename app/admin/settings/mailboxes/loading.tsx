import { TablePageSkeleton } from "@/components/skeletons"

export default function MailboxesLoading() {
  return <TablePageSkeleton statCards={4} filters={3} columns={5} rows={10} showStats={true} tabs={4} statBadges={4} />
}
