"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Building2, Contact, Loader2, Pencil, UserRound } from "lucide-react"
import { DataTable, DataTablePage, type DataTableColumn } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch, apiJson } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { RequisitionPayee } from "@/lib/requisitions/types"
import { useStaffOptions } from "../use-staff-options"
import { SCHEDULES_PATH } from "../requisition-paths"

const NO_STAFF = "__none__"

/**
 * Everyone ACOB pays. Each account has one code, used as the bank file's
 * Beneficiary Code so the bank can find every payment made to it. Staff use
 * their employee number; anyone else gets ACOB-V-0001…
 */
export function PayeeRegister() {
  const [editing, setEditing] = useState<RequisitionPayee | null>(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: QUERY_KEYS.requisitionPayees(),
    queryFn: () => apiJson<{ data: RequisitionPayee[] }>("/api/requisitions/payees"),
  })
  const rows = data?.data || []

  const columns: DataTableColumn<RequisitionPayee>[] = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      accessor: (p) => p.code,
      render: (p) => <span className="font-mono text-xs font-semibold">{p.code}</span>,
    },
    {
      key: "account_name",
      label: "Name",
      sortable: true,
      accessor: (p) => p.account_name,
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{p.account_name}</p>
          {p.profile?.full_name ? <p className="text-muted-foreground text-xs">Staff: {p.profile.full_name}</p> : null}
        </div>
      ),
    },
    {
      key: "kind",
      label: "Type",
      accessor: (p) => p.kind,
      render: (p) => (
        <Badge
          variant="outline"
          className={
            p.kind === "staff" ? "border-info/30 bg-info/15 text-info" : "border-primary/30 bg-primary/15 text-primary"
          }
        >
          {p.kind === "staff" ? "Staff" : "Vendor"}
        </Badge>
      ),
    },
    {
      key: "bank",
      label: "Bank · account",
      accessor: (p) => `${p.bank_name} ${p.account_number}`,
      render: (p) => (
        <div className="text-xs">
          <p>{p.bank_name}</p>
          <p className="text-muted-foreground font-mono">{p.account_number}</p>
        </div>
      ),
    },
    { key: "rc_number", label: "RC number", accessor: (p) => p.rc_number || "", hideOnMobile: true },
  ]

  return (
    <DataTablePage
      title="Payee register"
      description="Everyone ACOB pays, with the code the bank uses to find their payments."
      icon={Contact}
      backLink={{ href: SCHEDULES_PATH, label: "Back to payment schedules" }}
      spacing="tight"
      stats={
        <StatGrid>
          <StatCard
            variant="compact"
            title="Payees"
            value={rows.length}
            icon={Contact}
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <StatCard
            variant="compact"
            title="Staff"
            value={rows.filter((p) => p.kind === "staff").length}
            icon={UserRound}
            iconBgColor="bg-emerald-500/10"
            iconColor="text-emerald-500"
          />
          <StatCard
            variant="compact"
            title="Vendors"
            value={rows.filter((p) => p.kind === "vendor").length}
            icon={Building2}
            iconBgColor="bg-purple-500/10"
            iconColor="text-purple-500"
          />
        </StatGrid>
      }
    >
      <DataTable<RequisitionPayee>
        data={rows}
        columns={columns}
        getRowId={(p) => p.id}
        searchPlaceholder="Search name, code, account…"
        searchFn={(p, q) =>
          [p.account_name, p.code, p.account_number, p.bank_name, p.profile?.full_name, p.rc_number]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        }
        filters={[
          {
            key: "kind",
            label: "Type",
            options: [
              { value: "staff", label: "Staff" },
              { value: "vendor", label: "Vendor" },
            ],
          },
        ]}
        rowActions={[{ label: "Edit", icon: Pencil, onClick: (p) => setEditing(p) }]}
        isLoading={isLoading}
        error={error instanceof Error ? error.message : null}
        onRetry={() => void refetch()}
        pagination={{ pageSize: 50 }}
        emptyTitle="No payees yet"
        emptyDescription="People are added the first time they are put on a payment schedule."
        mobileRow={{
          title: (p) => p.account_name,
          subtitle: (p) => `${p.code} · ${p.bank_name} ${p.account_number}`,
        }}
      />
      {editing ? (
        <EditPayeeDialog
          payee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refetch()
          }}
        />
      ) : null}
    </DataTablePage>
  )
}

function EditPayeeDialog({
  payee,
  onClose,
  onSaved,
}: {
  payee: RequisitionPayee
  onClose: () => void
  onSaved: () => void
}) {
  const staff = useStaffOptions(true)
  const [code, setCode] = useState(payee.code)
  const [profileId, setProfileId] = useState(payee.profile_id || NO_STAFF)
  const [rcNumber, setRcNumber] = useState(payee.rc_number || "")
  const [notes, setNotes] = useState(payee.notes || "")
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const linked = profileId === NO_STAFF ? null : profileId
      const linkChanged = linked !== payee.profile_id
      const res = await apiFetch(`/api/requisitions/payees/${payee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // A newly linked staff member brings their employee number unless a code was typed.
          ...(code !== payee.code || !linkChanged ? { code } : {}),
          ...(linkChanged ? { profile_id: linked } : {}),
          rc_number: rcNumber || null,
          notes: notes || null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not save")
      toast.success("Payee saved")
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{payee.account_name}</DialogTitle>
          <DialogDescription>
            {payee.bank_name} · {payee.account_number}. Schedules already made keep the code they used.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Staff member</Label>
            <SearchableSelect
              value={profileId}
              onValueChange={setProfileId}
              options={[{ value: NO_STAFF, label: "Not staff (vendor)" }, ...staff]}
              placeholder="Not staff (vendor)"
              searchPlaceholder="Search staff"
            />
            <p className="text-muted-foreground text-xs">Linking staff uses their employee number as the code.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payee-code">Code</Label>
            <Input id="payee-code" value={code} onChange={(e) => setCode(e.target.value.trim())} maxLength={35} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payee-rc">RC number (companies)</Label>
            <Input id="payee-rc" value={rcNumber} onChange={(e) => setRcNumber(e.target.value)} maxLength={30} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payee-notes">Notes</Label>
            <Textarea id="payee-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || code.length < 2}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
