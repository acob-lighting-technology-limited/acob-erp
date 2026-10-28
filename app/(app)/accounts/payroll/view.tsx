"use client"

import { useState } from "react"
import { DataTablePage, DataTable } from "@/components/ui/data-table"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { FileText, Eye, DollarSign, Calendar } from "lucide-react"
import { printPayslip, type PayslipLine } from "@/lib/hr/payslip-print"
import type { UserPayrollEntry } from "./page"
import { ViewPayslipDialog } from "./_components/view-payslip-dialog"

interface UserPayrollPageProps {
  initialData: {
    profile: {
      id: string
      full_name: string
      employee_number: string
      department: string | null
      designation: string | null
    } | null
    entries: UserPayrollEntry[]
  }
}

export function UserPayrollPage({ initialData }: UserPayrollPageProps) {
  const { profile, entries } = initialData
  const [selectedEntry, setSelectedEntry] = useState<UserPayrollEntry | null>(null)

  const columns = [
    {
      key: "period_name",
      label: "Period Name",
      accessor: (e: UserPayrollEntry) => e.payroll_periods?.name || "—",
      sortable: true,
      render: (e: UserPayrollEntry) => (
        <span className="text-foreground font-semibold">{e.payroll_periods?.name || "—"}</span>
      ),
    },
    {
      key: "pay_date",
      label: "Pay Date",
      accessor: (e: UserPayrollEntry) => e.payroll_periods?.pay_date || "—",
    },
    {
      key: "gross_salary",
      label: "Gross Cash Pay",
      render: (e: UserPayrollEntry) => (
        <span>
          ₦
          {(Number(e.gross_salary) + Number(e.bonus)).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      key: "total_deductions",
      label: "Total Deductions",
      render: (e: UserPayrollEntry) => (
        <span className="text-red-600">
          -₦{Number(e.total_deductions).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "net_salary",
      label: "Net Pay",
      render: (e: UserPayrollEntry) => (
        <span className="font-semibold text-emerald-600">
          ₦{Number(e.net_salary).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (e: UserPayrollEntry) => (
        <Button size="sm" variant="outline" onClick={() => setSelectedEntry(e)}>
          <Eye className="mr-1.5 h-4 w-4" /> View Payslip
        </Button>
      ),
    },
  ]

  // Calculate statistics
  const latestNet = entries[0]?.net_salary || 0
  const ytdNet = entries.reduce((acc, e) => acc + Number(e.net_salary), 0)
  const payslipsCount = entries.length

  const fmt = (v: number) => `₦${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtEntry = (v: number | string) => fmt(Number(v))

  const stats = (
    <StatGrid>
      <StatCard
        variant="compact"
        title="Latest Net Pay"
        value={latestNet ? fmt(latestNet) : "₦0.00"}
        icon={DollarSign}
        iconBgColor="bg-emerald-500/10"
        iconColor="text-emerald-500"
      />
      <StatCard
        variant="compact"
        title="Year-to-Date (YTD) Net"
        value={fmt(ytdNet)}
        icon={DollarSign}
        iconBgColor="bg-blue-500/10"
        iconColor="text-blue-500"
      />
      <StatCard
        variant="compact"
        title="Available Payslips"
        value={payslipsCount}
        icon={Calendar}
        iconBgColor="bg-amber-500/10"
        iconColor="text-amber-500"
      />
    </StatGrid>
  )

  // Render from the immutable breakdown snapshot captured at publish time.
  // Older rows published before the snapshot existed fall back to a best-effort
  // reconstruction from the stored aggregates.
  const vb =
    selectedEntry?.breakdown && selectedEntry.breakdown.monthlyBasic !== undefined ? selectedEntry.breakdown : null
  const base = selectedEntry ? Number(selectedEntry.basic_salary) : 0
  const basic = vb ? vb.monthlyBasic : base * 0.5
  const housing = vb ? vb.monthlyHousing : base * 0.3
  const transport = vb ? vb.monthlyTransport : base * 0.1
  const leave = vb ? vb.monthlyLeave : base * 0.1
  const comms = vb ? vb.monthlyCommunication : 5000
  const bonus = selectedEntry ? Number(selectedEntry.bonus) : 0
  const pensionEE = vb ? vb.monthlyPensionEmployee : base * 0.04
  const tax = selectedEntry ? Number(selectedEntry.tax_amount) : 0
  const lunch = selectedEntry ? Number(selectedEntry.lunch_deduction) : 0
  const loan = selectedEntry ? Number(selectedEntry.loan_repayment) : 0

  const latenessSurcharge = vb
    ? vb.latenessSurcharge + vb.absentSurcharge
    : selectedEntry
      ? Math.max(0, Number(selectedEntry.total_deductions) - pensionEE - tax - lunch - loan)
      : 0

  const handlePrint = () => {
    if (!selectedEntry) return
    const deductions: PayslipLine[] = [
      { label: "Pension (8% of Basic)", amount: pensionEE },
      { label: "PAYE Tax", amount: tax },
      ...(lunch > 0 ? [{ label: "Staff Lunch Deduction", amount: lunch }] : []),
      ...(loan > 0 ? [{ label: "Loan Repayment", amount: loan }] : []),
      ...(latenessSurcharge > 0 ? [{ label: "Lateness / Absence Surcharge", amount: latenessSurcharge }] : []),
    ]

    printPayslip({
      fullName: profile?.full_name ?? "",
      employeeNumber: profile?.employee_number ?? "",
      department: profile?.department,
      designation: profile?.designation,
      periodName: selectedEntry.payroll_periods?.name ?? "—",
      payDate: selectedEntry.payroll_periods?.pay_date ?? "—",
      statusLabel: "Paid",
      statusPaid: true,
      earnings: [
        { label: "Basic Salary", amount: basic },
        { label: "Housing Allowance", amount: housing },
        { label: "Transport Allowance", amount: transport },
        { label: "Leave Allowance", amount: leave },
        { label: "Communication Allowance", amount: comms },
        ...(bonus > 0 ? [{ label: "Bonus / Refunds", amount: bonus }] : []),
      ],
      grossLabel: "Total Gross",
      gross: Number(selectedEntry.gross_salary) + bonus,
      deductions,
      totalDeductions: Number(selectedEntry.total_deductions),
      netPay: Number(selectedEntry.net_salary),
    })
  }

  return (
    <DataTablePage
      title="Payroll"
      description="View and print your monthly payslips, tax assessments, and pension contributions."
      icon={FileText}
      spacing="tight"
      stats={stats}
    >
      <DataTable
        data={entries}
        columns={columns}
        getRowId={(e) => e.id}
        searchPlaceholder="Search by period name..."
        searchFn={(row, q) => (row.payroll_periods?.name || "").toLowerCase().includes(q.toLowerCase())}
        filters={[]}
        isLoading={false}
        viewToggle
        stickyToolbar
        contactsView
        defaultViewMode={{ mobile: "contacts", desktop: "list" }}
        mobileRow={{
          title: (e) => e.payroll_periods?.name || "—",
          subtitle: (e) => (e.payroll_periods?.pay_date ? `Paid ${e.payroll_periods.pay_date}` : "—"),
          trailing: (e) => (
            <span className="font-mono text-sm font-semibold text-emerald-600">{fmt(Number(e.net_salary))}</span>
          ),
          detail: {
            title: (e) => e.payroll_periods?.name || "Payslip",
            subtitle: (e) => (
              <span className="text-muted-foreground text-xs">
                {e.payroll_periods?.pay_date ? `Paid ${e.payroll_periods.pay_date}` : ""}
              </span>
            ),
            fields: (e) => [
              {
                icon: DollarSign,
                label: "Gross cash pay",
                value: fmt(Number(e.gross_salary) + Number(e.bonus)),
              },
              { icon: DollarSign, label: "Total deductions", value: fmtEntry(e.total_deductions) },
              { icon: DollarSign, label: "Net pay", value: fmtEntry(e.net_salary) },
            ],
            actions: (e) => [
              {
                label: "View Payslip",
                icon: Eye,
                variant: "default" as const,
                onClick: () => setSelectedEntry(e),
              },
            ],
          },
        }}
        cardRenderer={(e) => (
          <div className="group bg-card text-card-foreground border-border/60 hover:border-primary/40 h-full space-y-3 rounded-xl border p-4 shadow-sm transition-all">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold">{e.payroll_periods?.name || "—"}</h4>
              <span className="font-mono text-sm font-bold text-emerald-600">{fmt(Number(e.net_salary))}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Gross</p>
                <p className="font-medium">{fmt(Number(e.gross_salary) + Number(e.bonus))}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Deductions</p>
                <p className="font-medium">{fmtEntry(e.total_deductions)}</p>
              </div>
            </div>
            <div className="border-border/40 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
              <span>Pay date</span>
              <span>{e.payroll_periods?.pay_date || "—"}</span>
            </div>
          </div>
        )}
      />

      <ViewPayslipDialog
        selectedEntry={selectedEntry}
        setSelectedEntry={setSelectedEntry}
        profile={profile}
        basic={basic}
        housing={housing}
        transport={transport}
        leave={leave}
        comms={comms}
        bonus={bonus}
        pensionEE={pensionEE}
        tax={tax}
        lunch={lunch}
        loan={loan}
        latenessSurcharge={latenessSurcharge}
        handlePrint={handlePrint}
      />
    </DataTablePage>
  )
}
