import Link from "next/link"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { ArrowRight, Mail, Network, Satellite, Server, ShieldAlert, UserPlus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader, PageWrapper } from "@/components/layout"
import { createClient } from "@/lib/supabase/server"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { buildAccessContextV2, canAccessRouteV2, resolveAdminRouteKeyV2 } from "@/lib/admin/policy-v2"

export const metadata: Metadata = { title: "IT" }

// The same five destinations as the IT group in admin-sidebar.tsx. The sidebar item points at this
// page, so it must exist; each card is shown only if the viewer can open its target.
const IT_ITEMS = [
  {
    name: "Onboarding",
    description: "Staff profiles, including not-yet-onboarded placeholders, and whether each is set up",
    href: "/admin/onboarding",
    icon: UserPlus,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    name: "Mailboxes",
    description: "Staff and project mailboxes on cPanel, with storage and quota",
    href: "/admin/settings/mailboxes",
    icon: Mail,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    name: "Starlink Kits",
    description: "Each kit, the project it serves and how its bills stand",
    href: "/admin/accounts/starlink",
    icon: Satellite,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
  },
  {
    name: "Network Activity",
    description: "Office network logs, archived daily",
    href: "/admin/security/network-activity",
    icon: Network,
    color: "text-teal-500",
    bgColor: "bg-teal-50 dark:bg-teal-950/30",
  },
  {
    name: "Bypass & Override",
    description: "Audit trail of manual policy changes and emergency bypasses",
    href: "/admin/security/bypass-override",
    icon: ShieldAlert,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
] as const

export default async function AdminItPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) redirect("/profile")

  const access = buildAccessContextV2(scope)
  const items = IT_ITEMS.filter((item) => canAccessRouteV2(access, resolveAdminRouteKeyV2(item.href)))
  // Same rule as the rest of the admin shell: nothing here for this viewer means this page is not theirs.
  if (items.length === 0) redirect("/admin")

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="IT"
        description="Onboarding, mailboxes, Starlink, and network and security audit logs"
        icon={Server}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:border-primary/30 group h-full cursor-pointer transition-all hover:shadow-lg">
              <CardHeader>
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${item.bgColor}`}>
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                </div>
                <CardTitle className="flex items-center justify-between">
                  {item.name}
                  <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-colors" />
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </PageWrapper>
  )
}
