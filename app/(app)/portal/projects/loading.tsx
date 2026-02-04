import { TablePageSkeleton } from "@/components/skeletons"

export default function ProjectsLoading() {
  return <TablePageSkeleton filters={2} columns={4} rows={6} showStats={false} />
}
