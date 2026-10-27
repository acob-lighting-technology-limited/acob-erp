"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Briefcase, Building, Link2, Loader2, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { apiFetch } from "@/lib/api-client"
import type { MailboxReportRow } from "@/lib/cpanel/mailboxes"

interface EmployeeOption {
  id: string
  name: string
  department: string | null
  companyEmail: string | null
}

interface ProjectOption {
  id: string
  name: string
  location: string | null
  status: string | null
}

interface MailboxOptionsData {
  employees: EmployeeOption[]
  projects: ProjectOption[]
}

export function LinkDialog({
  mailbox,
  onOpenChange,
  onLinked,
}: {
  mailbox: MailboxReportRow | null
  onOpenChange: (open: boolean) => void
  onLinked: () => void
}) {
  const [linkType, setLinkType] = useState<"staff" | "project" | "none">("staff")
  const [selectedProfileId, setSelectedProfileId] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: optionsData } = useQuery({
    queryKey: ["admin-mailbox-options"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/mailboxes/options")
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to load options")
      return json.data as MailboxOptionsData
    },
    enabled: Boolean(mailbox),
  })

  const employees = optionsData?.employees
  const projects = optionsData?.projects

  const employeeOptions = useMemo(
    () =>
      (employees ?? []).map((e) => ({
        value: e.id,
        label: e.department ? `${e.name} (${e.department})` : e.name,
      })),
    [employees]
  )

  const projectOptions = useMemo(
    () =>
      (projects ?? []).map((p) => ({
        value: p.id,
        label: p.location ? `${p.name} · ${p.location}` : p.name,
      })),
    [projects]
  )

  useEffect(() => {
    if (mailbox) {
      if (mailbox.owner) {
        setLinkType("staff")
        setSelectedProfileId(mailbox.owner.id)
        setSelectedProjectId("")
      } else if (mailbox.project) {
        setLinkType("project")
        setSelectedProjectId(mailbox.project.id)
        setSelectedProfileId("")
      } else {
        setLinkType("none")
        setSelectedProfileId("")
        setSelectedProjectId("")
      }
    }
  }, [mailbox])

  if (!mailbox) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (linkType === "staff" && !selectedProfileId) {
      toast.error("Please choose which employee this mailbox belongs to")
      return
    }

    if (linkType === "project" && !selectedProjectId) {
      toast.error("Please choose which project this mailbox belongs to")
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch("/api/admin/mailboxes/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: mailbox.email,
          linkType,
          profileId: linkType === "staff" ? selectedProfileId : null,
          projectId: linkType === "project" ? selectedProjectId : null,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to link mailbox")

      toast.success(`Mailbox ${mailbox.email} link updated`)
      onLinked()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update mailbox assignment")
    } finally {
      setSaving(false)
    }
  }

  const selectedEmployee = employees?.find((e) => e.id === selectedProfileId)

  return (
    <ResponsiveModal
      open={Boolean(mailbox)}
      onOpenChange={onOpenChange}
      title="Link Mailbox"
      description={`Assign or re-link ${mailbox.email} to an employee or project.`}
      desktopClassName="max-w-lg"
    >
      <form onSubmit={handleSave} className="max-w-full min-w-0 space-y-4 pt-2">
        <div className="bg-muted/40 min-w-0 rounded-lg border p-3 text-sm">
          <span className="text-muted-foreground">Mailbox:</span>{" "}
          <span className="font-mono font-medium break-all">{mailbox.email}</span>
        </div>

        <div className="bg-muted/20 min-w-0 space-y-3 rounded-lg border p-3.5">
          <Label className="text-sm font-semibold">Assign To</Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setLinkType("staff")}
              className={`flex min-w-0 cursor-pointer flex-col items-center justify-between rounded-md border-2 p-2.5 transition-colors ${
                linkType === "staff"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <User className="text-primary mb-1 h-5 w-5 shrink-0" />
              <span className="w-full truncate text-center text-xs font-medium">Staff Member</span>
            </button>

            <button
              type="button"
              onClick={() => setLinkType("project")}
              className={`flex min-w-0 cursor-pointer flex-col items-center justify-between rounded-md border-2 p-2.5 transition-colors ${
                linkType === "project"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <Briefcase className="mb-1 h-5 w-5 shrink-0 text-blue-500" />
              <span className="w-full truncate text-center text-xs font-medium">Project</span>
            </button>

            <button
              type="button"
              onClick={() => setLinkType("none")}
              className={`flex min-w-0 cursor-pointer flex-col items-center justify-between rounded-md border-2 p-2.5 transition-colors ${
                linkType === "none"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              <Building className="text-muted-foreground mb-1 h-5 w-5 shrink-0" />
              <span className="w-full truncate text-center text-xs font-medium">Unlink / Shared</span>
            </button>
          </div>

          {/* Staff Picker */}
          {linkType === "staff" && (
            <div className="min-w-0 space-y-1.5 pt-1">
              <Label className="text-xs">Select Employee</Label>
              <SearchableSelect
                value={selectedProfileId}
                onValueChange={setSelectedProfileId}
                placeholder="Choose an employee..."
                options={employeeOptions}
                searchPlaceholder="Search employees..."
                className="w-full min-w-0 text-sm"
              />
              {selectedEmployee?.companyEmail && selectedEmployee.companyEmail !== mailbox.email && (
                <p className="text-warning text-xs break-words">
                  Will change {selectedEmployee.name}&apos;s company email from {selectedEmployee.companyEmail} to{" "}
                  {mailbox.email}.
                </p>
              )}
            </div>
          )}

          {/* Project Picker */}
          {linkType === "project" && (
            <div className="min-w-0 space-y-1.5 pt-1">
              <Label className="text-xs">Select Project</Label>
              <SearchableSelect
                value={selectedProjectId}
                onValueChange={setSelectedProjectId}
                placeholder="Choose a project..."
                options={projectOptions}
                searchPlaceholder="Search projects..."
                className="w-full min-w-0 text-sm"
              />
            </div>
          )}

          {linkType === "none" && (
            <p className="text-muted-foreground pt-1 text-xs">
              Removes staff/project linkage, marking this mailbox as a general shared inbox.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Save Assignment
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  )
}
