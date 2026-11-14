"use client"

import { useCallback, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Handshake, Pencil, Plus, Shield, UserMinus, Users } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DataTable, DataTablePage, type DataTableColumn } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/patterns/status-badge"
import { apiFetch } from "@/lib/api-client"
import { ADMIN_ONLY_PAGES, DEPT_DELEGABLE_PAGES } from "@/lib/dept/delegated-pages"
import { DEPT_APPROVALS } from "@/lib/dept/approval-permissions"
import { adminDelegationKeys } from "@/lib/dept/admin-delegations"
import { editRouteLabel } from "@/lib/admin/edit-route-labels"
import { QUERY_KEYS } from "@/lib/query-keys"
import { formatWATDateTime } from "@/lib/utils/date"
import { AssignmentDialog } from "./assignment-dialog"
import type { Delegation, DepartmentLead, Editor, LeadDirectory } from "./types"

const labels = new Map([...DEPT_DELEGABLE_PAGES, ...ADMIN_ONLY_PAGES].map((page) => [page.key, page.label]))
const consoleKeys = new Set(DEPT_DELEGABLE_PAGES.map((page) => page.key))
const active = (row: Delegation) => !row.revoked_at && Date.parse(row.valid_until) > Date.now()
const leadColumns: DataTableColumn<DepartmentLead>[] = [
  { key: "name", label: "Department", accessor: (row) => row.name, sortable: true },
  { key: "lead", label: "Department lead", accessor: (row) => row.lead_name, sortable: true },
  { key: "email", label: "Work email", accessor: (row) => row.lead_email },
  {
    key: "status",
    label: "Status",
    render: (row) => (
      <StatusBadge status={row.lead_id ? "active" : "pending"} label={row.lead_id ? "Assigned" : "Unassigned"} />
    ),
  },
]
const delegationColumns: DataTableColumn<Delegation>[] = [
  { key: "delegate", label: "Delegate", accessor: (row) => row.delegate },
  { key: "department", label: "Department", accessor: (row) => row.department },
  { key: "lead", label: "Department lead", accessor: (row) => row.lead },
  {
    key: "pages",
    label: "Access",
    render: (row) => (
      <div className="max-w-xs space-y-1 text-xs">
        {row.pages
          .filter((page) => consoleKeys.has(page))
          .map((page) => labels.get(page) ?? page)
          .join(", ") || "—"}
        {row.adminRoutes.length > 0 && (
          <p className="text-muted-foreground">Admin · {row.adminRoutes.map(editRouteLabel).join(", ")}</p>
        )}
        {DEPT_APPROVALS.some(({ key }) => row.pages.includes(key)) && (
          <p className="text-muted-foreground">
            Act for lead ·{" "}
            {DEPT_APPROVALS.filter(({ key }) => row.pages.includes(key))
              .map(({ label }) => label)
              .join(", ")}
          </p>
        )}
      </div>
    ),
  },
  { key: "start", label: "Granted (WAT)", render: (row) => formatWATDateTime(row.created_at) },
  { key: "end", label: "Ends (WAT)", render: (row) => formatWATDateTime(row.valid_until) },
  {
    key: "status",
    label: "Status",
    render: (row) => <StatusBadge status={row.revoked_at ? "revoked" : active(row) ? "active" : "expired"} />,
  },
]

async function read<T>(url: string): Promise<T> {
  const response = await apiFetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("Could not load department assignments.")
  return response.json()
}

export function LeadsDelegatesView() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState("leads")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const onDelegateSearch = useCallback((value: string) => {
    setSearch(value.trim())
    setPage(1)
  }, [])
  const onDelegateFilter = useCallback((filters: Record<string, string[]>) => {
    setStatus(filters.status?.[0] ?? "all")
    setPage(1)
  }, [])
  const [editor, setEditor] = useState<Editor | null>(null)
  const [confirmation, setConfirmation] = useState<{
    path: "leads" | "delegations"
    name: string
    body: Record<string, unknown>
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const directory = useQuery({
    queryKey: QUERY_KEYS.departmentLeads(),
    queryFn: () => read<{ data: LeadDirectory }>("/api/admin/hr/department-leads"),
  })
  const delegates = useQuery({
    queryKey: QUERY_KEYS.adminDepartmentDelegations(page, status, search),
    enabled: tab === "delegates",
    queryFn: () =>
      read<{ data: Delegation[]; total: number; canEdit: boolean }>(
        `/api/admin/hr/department-delegations?page=${page}&status=${status}&q=${encodeURIComponent(search)}`
      ),
    refetchInterval: 60_000,
  })
  const info = directory.data?.data
  const canEdit = Boolean(info?.canEdit)
  const delegateTab = tab === "delegates"

  async function save(
    path: "leads" | "delegations",
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>
  ) {
    const response = await apiFetch(`/api/admin/hr/department-${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const result: { error?: string } | null = await response.json().catch(() => null)
      throw new Error(result?.error ?? "Could not save assignment.")
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.departmentLeads() }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminDepartmentDelegations() }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminEmployees() }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.deptDelegations() }),
    ])
    toast.success(method === "DELETE" ? (path === "leads" ? "Lead removed" : "Delegation revoked") : "Assignment saved")
  }

  async function confirm() {
    if (!confirmation || saving) return
    setSaving(true)
    try {
      await save(confirmation.path, "DELETE", confirmation.body)
      setConfirmation(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change assignment.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DataTablePage
      title="Leads & Delegates"
      icon={Users}
      description="Manage department leads and review time-limited department access."
      backLink={{ label: "Employees", href: "/admin/hr/employees" }}
      tabs={[
        { key: "leads", label: "Leads", icon: Shield },
        { key: "delegates", label: "Delegates", icon: Handshake },
      ]}
      activeTab={tab}
      onTabChange={setTab}
      actions={
        delegateTab &&
        canEdit && (
          <Button
            onClick={() => setEditor({ type: "delegate" })}
            disabled={!info?.departments.some((row) => row.lead_id)}
          >
            <Plus /> Add delegate
          </Button>
        )
      }
    >
      {delegateTab ? (
        <DataTable
          data={delegates.data?.data ?? []}
          columns={delegationColumns}
          getRowId={(row) => row.id}
          searchPlaceholder="Search delegate, lead or department…"
          onSearchChange={onDelegateSearch}
          filters={[
            {
              key: "status",
              label: "Status",
              placeholder: "All statuses",
              multi: false,
              options: [
                { value: "active", label: "Active" },
                { value: "expired", label: "Expired" },
                { value: "revoked", label: "Revoked" },
              ],
            },
          ]}
          onFilterChange={onDelegateFilter}
          pagination={{ pageSize: 25, serverSide: true }}
          totalRows={delegates.data?.total ?? 0}
          currentPage={page - 1}
          onPageChange={(index) => setPage(index + 1)}
          isLoading={delegates.isLoading}
          error={delegates.error?.message}
          onRetry={delegates.refetch}
          emptyTitle="No matching delegations"
          emptyDescription="Review other statuses or add a delegation."
          emptyAction={
            canEdit && info?.departments.some((row) => row.lead_id) ? (
              <Button variant="outline" onClick={() => setEditor({ type: "delegate" })}>
                Add delegate
              </Button>
            ) : undefined
          }
          rowActions={
            canEdit
              ? [
                  {
                    label: "Edit delegation",
                    icon: Pencil,
                    hidden: (row) =>
                      !active(row) ||
                      row.adminRoutes.length > 0 ||
                      row.pages.some((key) => !adminDelegationKeys.has(key)),
                    onClick: (row) => setEditor({ type: "delegate", delegation: row }),
                  },
                  {
                    label: "Revoke access",
                    icon: UserMinus,
                    variant: "destructive",
                    hidden: (row) => !active(row),
                    onClick: (row) =>
                      setConfirmation({ path: "delegations", name: row.delegate, body: { id: row.id } }),
                  },
                ]
              : undefined
          }
        />
      ) : (
        <DataTable
          data={info?.departments ?? []}
          columns={leadColumns}
          getRowId={(row) => row.id}
          pagination={{ pageSize: 25 }}
          searchPlaceholder="Search department or lead…"
          searchFn={(row, query) => `${row.name} ${row.lead_name ?? ""}`.toLowerCase().includes(query)}
          isLoading={directory.isLoading}
          error={directory.error?.message}
          onRetry={directory.refetch}
          emptyTitle="No active departments"
          emptyAction={
            <Button variant="outline" onClick={() => void directory.refetch()}>
              Refresh departments
            </Button>
          }
          rowActions={
            canEdit
              ? [
                  {
                    label: "Assign or replace lead",
                    icon: Pencil,
                    onClick: (row) => setEditor({ type: "lead", department: row }),
                  },
                  {
                    label: "Remove lead",
                    icon: UserMinus,
                    variant: "destructive",
                    hidden: (row) => !row.lead_id,
                    onClick: (row) =>
                      setConfirmation({
                        path: "leads",
                        name: row.name,
                        body: { departmentId: row.id, userId: row.lead_id },
                      }),
                  },
                ]
              : undefined
          }
        />
      )}
      {editor && info && (
        <AssignmentDialog editor={editor} directory={info} close={() => setEditor(null)} save={save} />
      )}
      <AlertDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !saving) setConfirmation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.path === "leads" ? "Remove department lead?" : "Revoke delegation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.path === "leads"
                ? `Remove the current lead assignment for ${confirmation.name}.`
                : `Revoke temporary access for ${confirmation?.name}. The record stays in delegation history.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={saving} onClick={() => void confirm()}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DataTablePage>
  )
}
