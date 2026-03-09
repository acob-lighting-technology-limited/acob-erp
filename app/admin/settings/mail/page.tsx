import { redirect } from "next/navigation"
import { Mail } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { MailPolicySettings } from "@/components/admin/mail-policy-settings"

export default async function MailSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!["super_admin", "developer"].includes(profile?.role || "")) {
    redirect("/admin/settings")
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Mail Settings"
        description="Control which modules can send in-app and email notifications system-wide."
        icon={Mail}
        backLink={{ href: "/admin/settings", label: "Back to Settings" }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Delivery Policies</CardTitle>
          <CardDescription>
            Only super admin and developer can change these toggles. Changes apply immediately to supported notification
            flows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MailPolicySettings />
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
