import { Building2, ClipboardCheck, CreditCard, Landmark, Wallet } from "lucide-react"
import { PageHeader, PageWrapper, Section, ModuleHubGrid } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { getCurrentUserAccountsData } from "./_lib"

function formatCurrency(amount: number | null | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—"
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function AccountsPage() {
  const { profile, requisitions, payments, payroll, assets } = await getCurrentUserAccountsData()

  const accountsAreaCards = [
    {
      title: "Requisitions",
      description: "Submit purchase and funding requests, track department endorsements, and check payout progress.",
      href: "/accounts/requisitions",
      icon: ClipboardCheck,
      badge:
        requisitions.pendingCount > 0 ? `${requisitions.pendingCount} In Review` : `${requisitions.totalCount} Total`,
      subLabel: "Funding & Approvals",
      color: "bg-amber-500/10 text-warning-foreground border-amber-500/20",
      fill: "bg-amber-500",
      hoverBorder: "hover:border-amber-500/60 dark:hover:border-amber-400/60",
      hoverText: "group-hover:text-amber-500",
    },
    {
      title: "Payments",
      description:
        "View department payment vouchers, disbursement dates, payment categories, and official payment receipts.",
      href: "/accounts/payments",
      icon: CreditCard,
      badge: `${payments.totalCount} Vouchers`,
      subLabel: "Disbursements & Receipts",
      color: "bg-emerald-500/10 text-success-foreground border-emerald-500/20",
      fill: "bg-emerald-500",
      hoverBorder: "hover:border-emerald-500/60 dark:hover:border-emerald-400/60",
      hoverText: "group-hover:text-emerald-500",
    },
    {
      title: "My Payroll",
      description:
        "Access your monthly pay slips, salary breakdowns, allowances, statutory deductions, and compensation details.",
      href: "/accounts/payroll",
      icon: Wallet,
      badge: payroll.latestStatus ? payroll.latestStatus.toUpperCase() : "Payslips",
      subLabel: payroll.latestPeriodName || "Salary & Pay Slips",
      color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      fill: "bg-cyan-500",
      hoverBorder: "hover:border-cyan-500/60 dark:hover:border-cyan-400/60",
      hoverText: "group-hover:text-cyan-500",
    },
    {
      title: "Assigned Assets",
      description:
        "Track physical equipment, workstations, devices, and company assets assigned to you or report issues.",
      href: "/accounts/assets",
      icon: Building2,
      badge: `${assets.assignedCount} Assets`,
      subLabel: "Equipment & Custody",
      color: "bg-sky-500/10 text-info-foreground border-sky-500/20",
      fill: "bg-sky-500",
      hoverBorder: "hover:border-sky-500/60 dark:hover:border-sky-400/60",
      hoverText: "group-hover:text-sky-500",
    },
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Accounts"
        description={`Track your funding requisitions, payment vouchers, payroll records, and assigned company assets${profile?.department ? ` in ${profile.department}` : ""}.`}
        icon={Landmark}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />

      <StatGrid>
        <StatCard
          variant="compact"
          title="My Requisitions"
          value={requisitions.totalCount}
          icon={ClipboardCheck}
          description={
            requisitions.pendingCount > 0
              ? `${requisitions.pendingCount} pending approval`
              : "All requisitions processed"
          }
        />
        <StatCard
          variant="compact"
          title="Dept Payments"
          value={payments.totalCount}
          icon={CreditCard}
          description={payments.dueCount > 0 ? `${payments.dueCount} pending / due payments` : "All payments settled"}
        />
        <StatCard
          variant="compact"
          title="Latest Net Pay"
          value={payroll.latestNetSalary !== null ? formatCurrency(payroll.latestNetSalary) : "Available"}
          icon={Wallet}
          description={payroll.latestPeriodName || "Monthly salary records"}
        />
        <StatCard
          variant="compact"
          title="Assigned Assets"
          value={assets.assignedCount}
          icon={Building2}
          description="Equipment in your custody"
          className="hidden sm:block"
        />
      </StatGrid>

      <Section title="Accounts Areas" description="Select an accounts module below to view details or perform actions.">
        <ModuleHubGrid
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-2"
          cards={accountsAreaCards.map((c) => ({
            title: c.title,
            description: c.description,
            href: c.href,
            icon: c.icon,
            tag: c.badge,
            footer: c.subLabel,
            color: c.color,
            fill: c.fill,
            hoverBorder: c.hoverBorder,
            hoverText: c.hoverText,
          }))}
        />
      </Section>

      <Section
        title="How Accounts Works"
        description="Understand how financial requests and payments operate within the ERP."
      >
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            <p>
              Requisitions allow team members to request funding for project activities and operational procurement.
              Once endorsed by your department lead and approved by finance, payments are disbursed.
            </p>
            <p>
              Department payment vouchers keep an auditable ledger of all organizational disbursements, attached with
              official receipts and supplier invoices.
            </p>
            <p>
              Payroll slips are generated at each pay cycle, providing transparent accounting of earnings, taxes, and
              deductions.
            </p>
          </CardContent>
        </Card>
      </Section>
    </PageWrapper>
  )
}
