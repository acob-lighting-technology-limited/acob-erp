import { TablePageSkeleton } from "@/components/skeletons/table-page-skeleton"

export default function ProjectsLoading() {
  return <TablePageSkeleton showStats={true} statCards={4} filters={4} columns={7} rows={8} />
}
