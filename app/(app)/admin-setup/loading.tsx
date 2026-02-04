import { FormPageSkeleton } from "@/components/skeletons/form-page-skeleton"

export default function Loading() {
  return <FormPageSkeleton sections={1} fieldsPerSection={3} showSidebar={false} />
}
