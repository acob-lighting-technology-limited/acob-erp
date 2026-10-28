"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Briefcase, Building, Check, Copy, Eye, EyeOff, Loader2, Plus, RefreshCw, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

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
  staffDomain: string
  quotaPresetsGb: number[]
}

function generateRandomPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnopqrstuvwxyz"
  const digits = "23456789"
  const symbols = "!@#$%^&*()_+"
  const all = upper + lower + digits + symbols

  const array = new Uint8Array(16)
  window.crypto.getRandomValues(array)

  const pwd = [
    upper[array[0] % upper.length],
    lower[array[1] % lower.length],
    digits[array[2] % digits.length],
    symbols[array[3] % symbols.length],
    ...Array.from(array.slice(4), (b) => all[b % all.length]),
  ]

  for (let i = pwd.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1)
    const tmp = pwd[i]
    pwd[i] = pwd[j]
    pwd[j] = tmp
  }

  return pwd.join("")
}

export function CreateMailboxDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [prefix, setPrefix] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [quotaGb, setQuotaGb] = useState<number>(1)
  const [customQuota, setCustomQuota] = useState("")
  const [isCustomQuota, setIsCustomQuota] = useState(false)
  const [linkType, setLinkType] = useState<"staff" | "project" | "none">("staff")
  const [selectedProfileId, setSelectedProfileId] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [createdSummary, setCreatedSummary] = useState<{
    email: string
    password: string
    quotaGb: number
    linkedLabel: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: optionsData } = useQuery({
    queryKey: QUERY_KEYS.adminMailboxOptions(),
    queryFn: async () => {
      const res = await apiFetch("/api/admin/mailboxes/options")
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to load options")
      return json.data as MailboxOptionsData
    },
    enabled: open,
  })

  const staffDomain = optionsData?.staffDomain ?? "org.acoblighting.com"
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
    if (open) {
      setPrefix("")
      setPassword(generateRandomPassword())
      setShowPassword(false)
      setQuotaGb(1)
      setIsCustomQuota(false)
      setCustomQuota("")
      setLinkType("staff")
      setSelectedProfileId("")
      setSelectedProjectId("")
      setCreatedSummary(null)
      setCopied(false)
    }
  }, [open])

  const handleSelectEmployee = (profileId: string) => {
    setSelectedProfileId(profileId)
    const emp = employees?.find((e) => e.id === profileId)
    if (emp && !prefix) {
      if (emp.companyEmail?.endsWith(`@${staffDomain}`)) {
        setPrefix(emp.companyEmail.split("@")[0] ?? "")
      } else {
        const parts = emp.name.toLowerCase().trim().split(/\s+/)
        if (parts.length >= 2) {
          setPrefix(`${parts[0]}.${parts[parts.length - 1]}`)
        } else if (parts[0]) {
          setPrefix(parts[0])
        }
      }
    }
  }

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId)
    const proj = projects?.find((p) => p.id === projectId)
    if (proj && !prefix) {
      const clean = proj.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
      if (clean) setPrefix(clean)
    }
  }

  const handleCopyCredentials = async () => {
    if (!createdSummary) return
    const text = `Mailbox: ${createdSummary.email}\nPassword: ${createdSummary.password}\nQuota: ${createdSummary.quotaGb} GB\nAssigned: ${createdSummary.linkedLabel}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Credentials copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  const effectiveQuotaGb = isCustomQuota ? parseInt(customQuota, 10) || 1 : quotaGb
  const fullEmail = `${prefix.trim().toLowerCase()}@${staffDomain}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanPrefix = prefix.trim().toLowerCase()
    if (!cleanPrefix) {
      toast.error("Please enter an email username prefix")
      return
    }

    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    if (effectiveQuotaGb < 1 || effectiveQuotaGb > 500) {
      toast.error("Quota must be between 1 GB and 500 GB")
      return
    }

    if (linkType === "staff" && !selectedProfileId) {
      toast.error("Please choose which employee this mailbox belongs to")
      return
    }

    if (linkType === "project" && !selectedProjectId) {
      toast.error("Please choose which project this mailbox belongs to")
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch("/api/admin/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fullEmail,
          password,
          quotaGb: effectiveQuotaGb,
          linkType,
          profileId: linkType === "staff" ? selectedProfileId : null,
          projectId: linkType === "project" ? selectedProjectId : null,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to create mailbox")

      let linkedLabel = "Shared / Standalone"
      if (linkType === "staff") {
        const emp = employees?.find((e) => e.id === selectedProfileId)
        linkedLabel = emp ? `${emp.name} (${emp.department ?? "Staff"})` : "Staff member"
      } else if (linkType === "project") {
        const proj = projects?.find((p) => p.id === selectedProjectId)
        linkedLabel = proj ? `Project – ${proj.name}` : "Project"
      }

      toast.success(`Mailbox ${fullEmail} created successfully`)
      onCreated()
      setCreatedSummary({
        email: fullEmail,
        password,
        quotaGb: effectiveQuotaGb,
        linkedLabel,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create mailbox")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedEmployee = employees?.find((e) => e.id === selectedProfileId)

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={createdSummary ? "Mailbox Created" : "Create cPanel Mailbox"}
      description={
        createdSummary
          ? "The mailbox is active on cPanel. Be sure to copy credentials before closing."
          : "Provision a new mailbox on cPanel, allocate storage quota in GB, and link to an employee or project."
      }
      desktopClassName="max-w-lg"
    >
      {createdSummary ? (
        <div className="min-w-0 space-y-4 pt-2">
          <div className="bg-muted/40 min-w-0 space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Email Address</p>
                <p className="font-mono text-sm font-medium break-all">{createdSummary.email}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleCopyCredentials} className="shrink-0 gap-1.5">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Credentials"}
              </Button>
            </div>

            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Password</p>
              <p className="bg-background/80 rounded border p-2 font-mono text-sm break-all select-all">
                {createdSummary.password}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
              <div>
                <span className="text-muted-foreground">Storage Quota:</span>{" "}
                <span className="font-medium">{createdSummary.quotaGb} GB</span>
              </div>
              <div className="truncate">
                <span className="text-muted-foreground">Assigned To:</span>{" "}
                <span className="truncate font-medium">{createdSummary.linkedLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-full min-w-0 space-y-4 pt-2">
          {/* Email Address */}
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="email-prefix">Email Address</Label>
            <div className="flex w-full min-w-0 rounded-md shadow-xs">
              <Input
                id="email-prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                placeholder="username or project-name"
                className="min-w-0 flex-1 rounded-r-none font-mono text-sm"
                required
              />
              <span className="border-input bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-r-md border border-l-0 px-3 font-mono text-xs select-none sm:text-sm">
                @{staffDomain}
              </span>
            </div>
          </div>

          {/* Password */}
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="mailbox-password">Initial Password</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
                onClick={() => setPassword(generateRandomPassword())}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
            <div className="relative min-w-0">
              <Input
                id="mailbox-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-10 font-mono text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-muted-foreground text-xs">Generated secure password (minimum 8 characters).</p>
          </div>

          {/* Storage Quota (GB) */}
          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mailbox Quota (GB)</Label>
              <span className="text-muted-foreground text-xs font-semibold">Allocating: {effectiveQuotaGb} GB</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {[1, 2, 5, 10, 25].map((gb) => (
                <Button
                  key={gb}
                  type="button"
                  variant={!isCustomQuota && quotaGb === gb ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsCustomQuota(false)
                    setQuotaGb(gb)
                  }}
                  className="h-8 w-full text-xs"
                >
                  {gb} GB
                </Button>
              ))}
              <Button
                type="button"
                variant={isCustomQuota ? "default" : "outline"}
                size="sm"
                onClick={() => setIsCustomQuota(true)}
                className="h-8 w-full text-xs"
              >
                Custom
              </Button>
            </div>

            {isCustomQuota && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={customQuota}
                  onChange={(e) => setCustomQuota(e.target.value)}
                  placeholder="e.g. 15"
                  className="w-32 text-sm"
                  autoFocus
                />
                <span className="text-muted-foreground text-sm font-medium">GB</span>
              </div>
            )}
          </div>

          {/* Link To Selection */}
          <div className="bg-muted/20 min-w-0 space-y-3 rounded-lg border p-3.5">
            <Label className="text-sm font-semibold">Link Mailbox To</Label>
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
                <span className="w-full truncate text-center text-xs font-medium">Shared</span>
              </button>
            </div>

            {/* Staff Picker */}
            {linkType === "staff" && (
              <div className="min-w-0 space-y-1.5 pt-1">
                <Label className="text-xs">Select Employee</Label>
                <SearchableSelect
                  value={selectedProfileId}
                  onValueChange={handleSelectEmployee}
                  placeholder="Choose an employee..."
                  options={employeeOptions}
                  searchPlaceholder="Search employees..."
                  className="w-full min-w-0 text-sm"
                />
                {selectedEmployee?.companyEmail && (
                  <p className="text-warning text-xs break-words">
                    Will update {selectedEmployee.name}&apos;s company email from {selectedEmployee.companyEmail} to{" "}
                    {fullEmail}.
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
                  onValueChange={handleSelectProject}
                  placeholder="Choose a project..."
                  options={projectOptions}
                  searchPlaceholder="Search projects..."
                  className="w-full min-w-0 text-sm"
                />
                <p className="text-muted-foreground text-xs">
                  Associates this mailbox directly with the selected project operations and team.
                </p>
              </div>
            )}

            {linkType === "none" && (
              <p className="text-muted-foreground pt-1 text-xs">
                Creates an unassigned mailbox (useful for general inboxes like info@, tenders@, or finance@).
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Mailbox
            </Button>
          </div>
        </form>
      )}
    </ResponsiveModal>
  )
}
