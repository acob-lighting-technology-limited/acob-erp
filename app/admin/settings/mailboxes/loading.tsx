import { TablePageSkeleton } from "@/components/skeletons"

export default function MailboxesLoading() {
  return <TablePageSkeleton filters={4} columns={5} rows={10} showStats={true} statCards={4} />
}
