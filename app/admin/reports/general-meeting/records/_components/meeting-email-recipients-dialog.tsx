"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { EmployeeRecipientPicker, type DirectoryEmployee } from "@/components/admin/employee-recipient-picker"
import { RowsSkeleton } from "@/components/skeletons/section-skeletons"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { MeetingSource } from "./meeting-source-dialog"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MeetingEmailRecipientsDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [selectedSourceId, setSelectedSourceId] = useState<string>("")
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [externalEmails, setExternalEmails] = useState<string[]>([])
  const [emailEnabled, setEmailEnabled] = useState(true)

  const {
    data: sources = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.meetingArtifactSources(),
    enabled: open,
    queryFn: async (): Promise<MeetingSource[]> => {
      const res = await apiFetch("/api/reports/meeting-artifacts/sources")
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to load meeting sync config")
      return payload.data || []
    },
  })

  useEffect(() => {
    if (sources.length > 0) {
      if (!selectedSourceId || !sources.some((s) => s.id === selectedSourceId)) {
        setSelectedSourceId(sources[0].id)
      }
    }
  }, [sources, selectedSourceId])

  const activeSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId) || sources[0] || null,
    [sources, selectedSourceId]
  )

  useEffect(() => {
    if (activeSource && open) {
      setSelectedEmployeeIds([])
      setExternalEmails(activeSource.recipients || [])
      setEmailEnabled(activeSource.email_enabled ?? true)
    }
  }, [activeSource, open])

  const handleEmployeesLoaded = (loaded: DirectoryEmployee[]) => {
    setEmployees(loaded)
    setExternalEmails((currentExternal) => {
      const matchedIds: string[] = []
      const stillExternal: string[] = []
      for (const email of currentExternal) {
        const match = loaded.find((e) => e.email?.toLowerCase() === email.toLowerCase())
        if (match) matchedIds.push(match.id)
        else stillExternal.push(email)
      }
      if (matchedIds.length > 0) {
        setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...matchedIds])))
      }
      return stillExternal
    })
  }

  const recipients = useMemo(() => {
    const resolvedEmails = employees
      .filter((e) => selectedEmployeeIds.includes(e.id))
      .map((e) => e.email)
      .filter((email): email is string => Boolean(email))
    return Array.from(new Set([...resolvedEmails, ...externalEmails]))
  }, [employees, selectedEmployeeIds, externalEmails])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeSource) return
      const res = await apiFetch("/api/reports/meeting-artifacts/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeSource.id,
          recipients,
          emailEnabled,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Failed to update email recipients")
      return payload
    },
    onSuccess: () => {
      toast.success("Email recipients updated")
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.meetingArtifactSources() })
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update email recipients")
    },
  })

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Automated Email Recipients"
      description="Configure who receives Teams meeting attendance reports and transcripts automatically when they are synced."
    >
      {isLoading ? (
        <RowsSkeleton rows={4} className="py-4" />
      ) : error ? (
        <div className="text-destructive py-6 text-center text-sm">
          {error instanceof Error ? error.message : "Failed to load meeting configuration"}
        </div>
      ) : !activeSource ? (
        <div className="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">
          No meeting configured yet. Set up a meeting in Meeting Sync first.
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          {sources.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Meeting</Label>
              <Select value={activeSource.id} onValueChange={setSelectedSourceId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {sources.length === 1 && (
            <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-semibold">{activeSource.label}</p>
                <p className="text-muted-foreground text-xs">{activeSource.organizer_email}</p>
              </div>
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" />
                <span>
                  {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Send emails automatically</p>
              <p className="text-muted-foreground text-xs">
                Email recipients when new attendance reports and transcripts arrive.
              </p>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Recipients</Label>
              <span className="text-muted-foreground text-xs">{recipients.length} selected</span>
            </div>
            <EmployeeRecipientPicker
              selectedIds={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
              onEmployeesLoaded={handleEmployeesLoaded}
              extraBadges={externalEmails.map((email) => ({
                key: email,
                label: email,
                onRemove: () => setExternalEmails((prev) => prev.filter((e) => e !== email)),
              }))}
              emptyHint="No recipients selected — reports will be stored but not emailed."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      )}
    </ResponsiveModal>
  )
}
