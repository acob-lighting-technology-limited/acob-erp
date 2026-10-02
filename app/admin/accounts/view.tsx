import {
  Building2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileBarChart,
  FileText,
  Landmark,
  Package,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react"
import { PageHeader, PageWrapper, Section, ModuleHubGrid } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { getAdminAccountsData } from "./_lib"

export interface AdminAccountsPageProps {
  basePath?: string
  lockedDepartmentId?: string
}

export async function AdminAccountsPage({ basePath, lockedDepartmentId }: AdminAccountsPageProps = {}) {
  const base = basePath ?? "/admin"
  const isDeptView = Boolean(lockedDepartmentId)
  const summary = await getAdminAccountsData(lockedDepartmentId)

  const modules = [
    {
      title: "Requisitions",
      description: isDeptView
        ? "Review department purchase and funding requisitions awaiting endorsement."
        : "Manage company purchase requisitions, funding requests, and department approvals.",
      href: `${base}/accounts/requisitions`,
      icon: ClipboardCheck,
      badge:
        summary.requisitions.pending > 0
          ? `${summary.requisitions.pending} Pending`
          : `${summary.requisitions.total} Total`,
      subLabel: "Requisition Approvals",
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      fill: "bg-amber-500",
      hoverBorder: "hover:border-amber-500/60 dark:hover:border-amber-400/60",
      hoverText: "group-hover:text-amber-500",
    },
    {
      title: "Payments",
      description: isDeptView
        ? "Manage department payment vouchers, disbursements, and payment receipts."
        : "Manage company payment vouchers, disbursements, receipts, and vendor payouts.",
      href: `${base}/accounts/payments`,
      icon: CreditCard,
      badge: `${summary.payments.total} Records`,
      subLabel: "Payment Vouchers",
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      fill: "bg-emerald-500",
      hoverBorder: "hover:border-emerald-500/60 dark:hover:border-emerald-400/60",
      hoverText: "group-hover:text-emerald-500",
    },
    {
      title: "Bills",
      description: "Track incoming vendor bills, payment due dates, and company operational expenses.",
      href: `${base}/accounts/bills`,
      icon: Receipt,
      badge: summary.bills.unpaid > 0 ? `${summary.bills.unpaid} Due` : "All Settled",
      subLabel: "Payables & Expenses",
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      fill: "bg-rose-500",
      hoverBorder: "hover:border-rose-500/60 dark:hover:border-rose-400/60",
      hoverText: "group-hover:text-rose-500",
    },
    {
      title: "Invoices",
      description: "Create, dispatch, and track client billing invoices and accounts receivable.",
      href: `${base}/accounts/invoices`,
      icon: FileText,
      badge: summary.invoices.outstanding > 0 ? `${summary.invoices.outstanding} Open` : "Balanced",
      subLabel: "Receivables & Invoicing",
      color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      fill: "bg-indigo-500",
      hoverBorder: "hover:border-indigo-500/60 dark:hover:border-indigo-400/60",
      hoverText: "group-hover:text-indigo-500",
    },
    ...(!isDeptView
      ? [
          {
            title: "Payroll",
            description: "Manage employee salaries, allowances, statutory deductions, and pay slips.",
            href: "/admin/payroll",
            icon: Wallet,
            badge: "Salaries",
            subLabel: "Payroll Management",
            color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
            fill: "bg-cyan-500",
            hoverBorder: "hover:border-cyan-500/60 dark:hover:border-cyan-400/60",
            hoverText: "group-hover:text-cyan-500",
          },
        ]
      : []),
    {
      title: "Finance Reports",
      description: "Financial summaries, spending analytics, cash flow, and audit statements.",
      href: `${base}/accounts/reports`,
      icon: FileBarChart,
      badge: "Statements",
      subLabel: "Analytics & Audits",
      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      fill: "bg-teal-500",
      hoverBorder: "hover:border-teal-500/60 dark:hover:border-teal-400/60",
      hoverText: "group-hover:text-teal-500",
    },
    ...(!isDeptView
      ? [
          {
            title: "Purchasing",
            description: "Manage vendors, purchase orders, procurement workflows, and receipts.",
            href: "/admin/purchasing",
            icon: ShoppingCart,
            badge: "Procurement",
            subLabel: "Orders & Suppliers",
            color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
            fill: "bg-purple-500",
            hoverBorder: "hover:border-purple-500/60 dark:hover:border-purple-400/60",
            hoverText: "group-hover:text-purple-500",
          },
        ]
      : []),
    {
      title: "Assets",
      description: "Track corporate equipment, hardware allocations, and reported asset issues.",
      href: `${base}/assets`,
      icon: Building2,
      badge: `${summary.assets.total} Registered`,
      subLabel: "Fixed Assets & Issues",
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      fill: "bg-sky-500",
      hoverBorder: "hover:border-sky-500/60 dark:hover:border-sky-400/60",
      hoverText: "group-hover:text-sky-500",
    },
    ...(!isDeptView
      ? [
          {
            title: "Inventory",
            description: "Manage product catalogs, warehouse stock levels, and item distributions.",
            href: "/admin/inventory",
            icon: Package,
            badge: "Stock Manager",
            subLabel: "Stock & Warehouses",
            color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
            fill: "bg-blue-500",
            hoverBorder: "hover:border-blue-500/60 dark:hover:border-blue-400/60",
            hoverText: "group-hover:text-blue-500",
          },
        ]
      : []),
  ]

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Accounts"
        description={
          isDeptView
            ? "Manage department requisitions, payments, bills, invoices, reports, and assets."
            : "Manage requisitions, payments, bills, invoices, payroll, reports, purchasing, assets, and inventory."
        }
        icon={Landmark}
        backLink={{ href: base, label: isDeptView ? "Back to Dept" : "Back to Admin" }}
      />

      <StatGrid>
        <StatCard
          variant="compact"
          title="Pending Requisitions"
          value={summary.requisitions.pending}
          icon={ClipboardCheck}
          description={`${summary.requisitions.total} total requisitions`}
        />
        <StatCard
          variant="compact"
          title="Active Payments"
          value={summary.payments.total}
          icon={CreditCard}
          description={
            summary.payments.due > 0 ? `${summary.payments.due} payment(s) due` : "All disbursements settled"
          }
        />
        <StatCard
          variant="compact"
          title="Unpaid Bills"
          value={summary.bills.unpaid}
          icon={Receipt}
          description={`${summary.bills.total} total bills recorded`}
        />
        <StatCard
          variant="compact"
          title="Open Invoices"
          value={summary.invoices.outstanding}
          icon={FileText}
          description={`${summary.invoices.total} total invoices issued`}
        />
        <StatCard
          variant="compact"
          title="Total Assets"
          value={summary.assets.total}
          icon={Building2}
          description="Registered company equipment"
        />
      </StatGrid>

      <Section
        title={isDeptView ? "Department Accounts Modules" : "Accounts Modules"}
        description="Select a module below to manage financial records, approvals, and reports."
      >
        <ModuleHubGrid
          cards={modules.map((c) => ({
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
    </PageWrapper>
  )
}
