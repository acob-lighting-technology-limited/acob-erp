import { TablePageSkeleton } from "@/components/skeletons"

export default function TasksLoading() {
  return <TablePageSkeleton filters={2} columns={5} rows={6} showStats={true} statCards={5} />
}
