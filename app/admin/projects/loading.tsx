import { TablePageSkeleton } from "@/components/skeletons"

export default function ProjectsLoading() {
  return <TablePageSkeleton filters={2} columns={5} rows={6} showStats={true} statCards={4} />
}
