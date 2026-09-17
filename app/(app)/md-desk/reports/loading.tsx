import { CardGridPageSkeleton } from "@/components/skeletons"

// Mirrors MdDeskReports: six report cards.
export default function Loading() {
  return <CardGridPageSkeleton cards={6} columns={3} />
}
