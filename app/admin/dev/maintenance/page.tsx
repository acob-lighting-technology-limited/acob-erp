import { createClient } from "@/lib/supabase/server"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Wrench } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MaintenanceToggle } from "@/components/admin/maintenance-toggle"

export default async function DevMaintenancePage() {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from("system_settings")
    .select("value, updated_at, updated_by")
    .eq("key", "maintenance_mode")
    .single()

  const updatedBy = settings?.updated_by
    ? await supabase
        .from("profiles")
        .select("first_name, last_name, company_email")
        .eq("id", settings.updated_by)
        .single()
    : null

  const raw = settings?.value as any
  const enabled = typeof raw === "boolean" ? raw : Boolean(raw?.enabled)

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Maintenance Control"
        description="Only developer can toggle maintenance mode"
        icon={Wrench}
        backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      />

      <Card>
        <CardHeader>
          <CardTitle>System Maintenance Mode</CardTitle>
          <CardDescription>When enabled, only users with the developer role can access non-auth pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <MaintenanceToggle />
          <div className="space-y-2 rounded-md border p-4 text-sm">
            <p>
              <span className="font-medium">Current status:</span> {enabled ? "Enabled" : "Disabled"}
            </p>
            <p>
              <span className="font-medium">Last updated:</span>{" "}
              {settings?.updated_at ? new Date(settings.updated_at).toLocaleString() : "Unknown"}
            </p>
            <p>
              <span className="font-medium">Updated by:</span>{" "}
              {updatedBy?.data
                ? `${updatedBy.data.first_name || ""} ${updatedBy.data.last_name || ""}`.trim() ||
                  updatedBy.data.company_email
                : "Unknown"}
            </p>
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
