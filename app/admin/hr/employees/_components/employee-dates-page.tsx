"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BellRing, Briefcase, Cake, CalendarCheck, CalendarX, Pencil, Users } from "lucide-react"
import { useCanEdit } from "@/components/admin/edit-access-context"
import { BirthdayManagerDialog } from "@/components/hr/birthday-manager-dialog"
import { BirthdayReminderDialog } from "@/components/hr/birthday-reminder-dialog"
import { EmployeeStatusBadge } from "@/components/hr/employee-status-badge"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage, type DataTableColumn } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/patterns/status-badge"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatName } from "@/lib/utils"
import { formatBirthdayLabel, formatDDMMYYYY } from "@/lib/utils/date"
import { EmployeeAvatar } from "./employee-avatar"
import { EmployeeDateDialog } from "./employee-date-dialog"
import type { Employee } from "./employee-types"

const directory = "/admin/hr/employees"
const name = (row: Employee) => formatName(`${row.first_name} ${row.last_name}`)
const views = {
  birthday: {
    title: "Birthday",
    field: "birthday",
    label: "Birthday",
    recorded: "Recorded",
    icon: Cake,
    description: "Record staff birthdays and manage the weekly reminder.",
  },
  confirmation: {
    title: "Confirmation",
    field: "confirmation_date",
    label: "Confirmation date",
    recorded: "Confirmed",
    icon: CalendarCheck,
    description: "Track confirmation dates and find employee records that need updating.",
  },
  employment: {
    title: "Employment",
    field: "employment_date",
    label: "Employment date",
    recorded: "Recorded",
    icon: Briefcase,
    description: "Review employee start dates, employment types and statuses.",
  },
} as const
const employmentTypes = { full_time: "Full Time", part_time: "Part Time", contract: "Contract" }

export function EmployeeDatesPage({ mode }: { mode: keyof typeof views }) {
  const view = views[mode]
  const birthday = mode === "birthday"
  const canEdit = useCanEdit("hr.employees")
  const [selected, setSelected] = useState<Employee | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [upcomingOpen, setUpcomingOpen] = useState(false)
  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.adminEmployees(),
    queryFn: async () => {
      const response = await apiFetch("/api/admin/employees", { cache: "no-store" })
      if (!response.ok) throw new Error("Could not load employees")
      const payload: { data: Employee[] } = await response.json()
      return payload.data
    },
  })
  const employees = birthday ? data.filter((row) => row.employment_status !== "exited") : data
  const recorded = employees.filter((row) => Boolean(row[view.field])).length
  const dateStatus = (row: Employee) => (row[view.field] ? "recorded" : "missing")
  const recordBadge = (row: Employee) => (
    <StatusBadge
      status={dateStatus(row)}
      label={row[view.field] ? view.recorded : "Not recorded"}
      tone={row[view.field] ? "success" : "neutral"}
    />
  )
  const columns: DataTableColumn<Employee>[] = [
    {
      key: "name",
      label: "Employee",
      accessor: name,
      sortable: true,
      sheet: false,
      render: (row) => (
        <div className="flex items-center gap-2">
          <EmployeeAvatar employee={row} size="sm" />
          <span className="font-medium">{name(row)}</span>
        </div>
      ),
    },
    { key: "staffId", label: "Staff ID", accessor: (row) => row.employee_number, sortable: true },
    { key: "department", label: "Department", accessor: (row) => row.department, sortable: true },
    {
      key: view.field,
      label: view.label,
      accessor: (row) => row[view.field],
      sortable: true,
      render: (row) => (birthday ? formatBirthdayLabel(row.birthday) : formatDDMMYYYY(row[view.field])) ?? "—",
    },
    {
      key: "dateStatus",
      label: mode === "confirmation" ? "Confirmation status" : "Date status",
      accessor: dateStatus,
      render: recordBadge,
      sortable: true,
    },
  ]
  if (mode === "employment") {
    columns.push(
      {
        key: "type",
        label: "Employment type",
        accessor: (row) => row.employment_type,
        sortable: true,
        render: (row) =>
          row.employment_type ? (
            <StatusBadge
              status={row.employment_type}
              label={employmentTypes[row.employment_type]}
              tone={row.employment_type === "contract" ? "purple" : "info"}
            />
          ) : (
            "—"
          ),
      },
      {
        key: "employmentStatus",
        label: "Employment status",
        accessor: (row) => row.employment_status,
        sortable: true,
        render: (row) => <EmployeeStatusBadge status={row.employment_status} size="sm" />,
      }
    )
  }

  return (
    <DataTablePage
      title={view.title}
      description={view.description}
      icon={view.icon}
      backLink={{ href: directory, label: "Employees" }}
      actions={
        birthday &&
        canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setUpcomingOpen(true)}>
              <Cake className="h-4 w-4" /> Upcoming birthdays
            </Button>
            <Button variant="outline" onClick={() => setReminderOpen(true)}>
              <BellRing className="h-4 w-4" /> Weekly reminder
            </Button>
          </div>
        )
      }
      stats={
        isLoading || isError ? undefined : (
          <StatGrid>
            <StatCard title="Employees" value={employees.length} icon={Users} />
            <StatCard
              title={view.recorded}
              value={recorded}
              icon={CalendarCheck}
              iconColor="text-success"
              iconBgColor="bg-success/10"
            />
            <StatCard
              title="Not recorded"
              value={employees.length - recorded}
              icon={CalendarX}
              iconColor="text-warning"
              iconBgColor="bg-warning/10"
            />
          </StatGrid>
        )
      }
    >
      <DataTable
        data={employees}
        columns={columns}
        getRowId={(row) => row.id}
        pagination={{ pageSize: 50 }}
        isLoading={isLoading}
        error={isError ? "Could not load employees" : null}
        onRetry={refetch}
        searchPlaceholder="Search employee, staff ID or department…"
        searchFn={(row, query) =>
          [name(row), row.employee_number, row.department].some((value) => value?.toLowerCase().includes(query))
        }
        filters={[
          {
            key: "dateStatus",
            label: mode === "confirmation" ? "Confirmation status" : "Date status",
            multi: false,
            options: [
              { value: "recorded", label: view.recorded },
              { value: "missing", label: "Not recorded" },
            ],
            mode: "custom",
            filterFn: (row, values) => values.includes(dateStatus(row)),
          },
        ]}
        rowActions={
          canEdit ? [{ label: `Edit ${view.label.toLowerCase()}`, icon: Pencil, onClick: setSelected }] : undefined
        }
        mobileRow={{
          title: name,
          subtitle: (row) => row.department,
          leading: (row) => <EmployeeAvatar employee={row} size="sm" />,
          trailing: recordBadge,
        }}
        emptyTitle="No employees to show"
        emptyDescription="There are no employee records available in your view."
        emptyAction={
          <Link href={directory} className="underline">
            Open Employees
          </Link>
        }
      />
      {selected && canEdit && (
        <EmployeeDateDialog
          key={selected.id}
          employee={selected}
          field={view.field}
          label={view.label}
          close={() => setSelected(null)}
        />
      )}
      {birthday && canEdit && <BirthdayReminderDialog open={reminderOpen} onOpenChange={setReminderOpen} />}
      {birthday && canEdit && <BirthdayManagerDialog open={upcomingOpen} onOpenChange={setUpcomingOpen} />}
    </DataTablePage>
  )
}
