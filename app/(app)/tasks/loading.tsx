import { TablePageSkeleton } from "@/components/skeletons/table-page-skeleton"

export default function TasksLoading() {
  return <TablePageSkeleton showStats={true} statCards={4} filters={1} columns={8} rows={8} />
}
