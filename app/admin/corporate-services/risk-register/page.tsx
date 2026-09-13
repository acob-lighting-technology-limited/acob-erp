import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { ShieldAlert } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Risk Register | Corporate Services | Matrix",
  description: "Organizational risk identification, assessment, and mitigation matrix.",
}

type DbClient = Awaited<ReturnType<typeof createClient>>

export default async function RiskRegisterPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect("/auth/login")

  const scope = await resolveAdminScope(supabase as DbClient, user.id)
  if (!scope) redirect("/profile")

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Risk Register"
        description="Organizational risk identification, assessment, and mitigation matrix."
        icon={ShieldAlert}
        backLink={{ href: "/admin/corporate-services/scorecard", label: "Back to Scorecard" }}
      />
      <Card className="border-dashed">
        <CardHeader className="py-16 text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <ShieldAlert className="text-muted-foreground h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Risk Register</CardTitle>
          <CardDescription className="mx-auto mt-2 max-w-md">
            The corporate risk register, risk matrix, and mitigation tracker are under preparation.
          </CardDescription>
        </CardHeader>
      </Card>
    </PageWrapper>
  )
}
