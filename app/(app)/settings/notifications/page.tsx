import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NotificationPreferencesForm } from "@/components/notification-preferences-form"

export default async function SettingsNotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Read the same table the delivery path gates on (resolveChannelEligibleUserIds),
  // not profiles.email_notifications — that column is read nowhere else and was
  // leaving this switch with no effect on what actually gets sent.
  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("email_enabled")
    .eq("user_id", user.id)
    .maybeSingle()

  // No row means "no preference recorded", which the delivery gate treats as
  // allowed — so the switch has to show enabled here to match real behaviour.
  return (
    <NotificationPreferencesForm
      userId={user.id}
      initialEmailNotifications={preferences?.email_enabled ?? true}
      // Public half of the VAPID pair — safe to ship to the browser, and
      // required by PushManager.subscribe().
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""}
    />
  )
}
