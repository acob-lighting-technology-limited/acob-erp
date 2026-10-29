import { TablePageSkeleton } from "@/components/skeletons"

export default function Loading() {
  return <TablePageSkeleton filters={4} columns={5} actions={3} list="responsive" />
}
