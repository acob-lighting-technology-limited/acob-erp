import { FormPageSkeleton } from "@/components/skeletons"
import { JOB_DESCRIPTION_SKELETON } from "./skeleton-props"

export default function JobDescriptionLoading() {
  return <FormPageSkeleton {...JOB_DESCRIPTION_SKELETON} />
}
