import { FormPageSkeleton } from "@/components/skeletons"
import { NOTIFICATION_SETTINGS_SKELETON } from "./skeleton-props"

export default function NotificationSettingsLoading() {
  return <FormPageSkeleton {...NOTIFICATION_SETTINGS_SKELETON} />
}
