"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Mail, KeyRound, Copy, Check, Eye, EyeOff, Sparkles, AlertCircle, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { NewMailboxPasswordDialog } from "@/components/employees/EmailChangeMailboxDialog"

interface DispatchEmployee {
  id: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  employee_number?: string | null
  company_email?: string | null
  personal_email?: string | null
  department?: string | null
  mailbox_status?: string | null
  mailbox_error?: string | null
}

interface DispatchCredentialsDialogProps {
  employee: DispatchEmployee | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

function generateRandomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*"
  const bytes = new Uint32Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars.charAt(b % chars.length)).join("")
}

const MAILBOX_RESULT_LABEL: Record<string, string> = {
  created: "Mailbox created on cPanel",
  password_reset: "Mailbox password reset on cPanel",
}

export function DispatchCredentialsDialog({ employee, open, onOpenChange, onSuccess }: DispatchCredentialsDialogProps) {
  // Automatic: Matrix creates the mailbox (or resets its password) on cPanel.
  // Manual: ICT already set it up in cPanel and types the password they chose.
  const [manual, setManual] = useState(false)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  // Set when Matrix changed the mailbox password but the welcome letter failed.
  const [orphanedCredentials, setOrphanedCredentials] = useState<{ email: string; password: string } | null>(null)

  if (!employee) {
    return <NewMailboxPasswordDialog credentials={orphanedCredentials} onClose={() => setOrphanedCredentials(null)} />
  }

  const employeeName =
    employee.full_name || [employee.first_name, employee.last_name].filter(Boolean).join(" ") || "Employee"

  const handleCopy = async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Password copied to clipboard")
    } catch {
      toast.error("Failed to copy password")
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setPassword(text.trim())
        toast.success("Password pasted from clipboard")
      }
    } catch {
      toast.error("Please allow clipboard access or paste manually")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (manual && (!password.trim() || password.trim().length < 6)) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch(`/api/admin/hr/employees/${employee.id}/dispatch-credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manual ? { password: password.trim() } : {}),
      })

      const data = (await res.json().catch(() => null)) as {
        error?: string
        warnings?: string[]
        mailbox?: string
        mailboxEmail?: string
        mailboxPassword?: string
      } | null
      if (!res.ok) {
        if (data?.mailboxEmail && data.mailboxPassword) {
          setOrphanedCredentials({ email: data.mailboxEmail, password: data.mailboxPassword })
        }
        throw new Error(data?.error || `Failed to dispatch credentials (${res.status} ${res.statusText})`)
      }

      const mailboxNote = data?.mailbox ? MAILBOX_RESULT_LABEL[data.mailbox] : null
      toast.success(
        `${mailboxNote ? `${mailboxNote} · ` : ""}Webmail credentials dispatched to ${employee.personal_email}`
      )
      for (const warning of data?.warnings ?? []) toast.warning(warning)
      onOpenChange(false)
      setPassword("")
      onSuccess?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to dispatch credentials")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="text-primary h-5 w-5" />
            Dispatch Webmail Credentials
          </DialogTitle>
          <DialogDescription>
            Send official company webmail login details and Matrix setup instructions to the employee&apos;s personal
            inbox.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Recipient Details Card */}
          <div className="bg-muted/40 space-y-1.5 rounded-lg border p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee:</span>
              <span className="text-foreground font-semibold">{employeeName}</span>
            </div>
            {employee.employee_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Staff ID:</span>
                <span className="text-foreground font-mono font-medium">{employee.employee_number}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">cPanel Email:</span>
              <span className="text-foreground font-mono font-medium">{employee.company_email || "Not set"}</span>
            </div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="text-muted-foreground">Personal Recipient:</span>
              <span className="text-primary font-medium">{employee.personal_email || "No personal email"}</span>
            </div>
          </div>

          {!employee.personal_email && (
            <div className="text-warning bg-warning/10 flex items-center gap-2 rounded-md p-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Cannot dispatch: This employee does not have a personal email on file.</span>
            </div>
          )}

          {employee.mailbox_status === "failed" && (
            <div className="text-danger bg-danger/10 flex items-start gap-2 rounded-md p-2 text-xs">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The last automatic attempt to create this mailbox failed
                {employee.mailbox_error ? `: ${employee.mailbox_error}` : "."} Sending again retries it.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="dispatch-manual" className="text-xs font-semibold">
                I set the password in cPanel myself
              </Label>
              <p className="text-muted-foreground text-xs">
                {manual
                  ? "Matrix will not touch the mailbox — enter the password you chose."
                  : "Matrix creates the mailbox on cPanel (or resets its password if it exists) with a strong generated password."}
              </p>
            </div>
            <Switch id="dispatch-manual" checked={manual} onCheckedChange={setManual} disabled={isSubmitting} />
          </div>

          {manual ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cpanel-pass" className="flex items-center gap-1.5 text-xs font-semibold">
                  <KeyRound className="h-3.5 w-3.5" />
                  cPanel Webmail Password
                </Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground h-6 px-2 text-xs"
                    onClick={handlePaste}
                  >
                    Paste from cPanel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                    onClick={() => setPassword(generateRandomPassword())}
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Input
                  id="cpanel-pass"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Paste password created in cPanel..."
                  className="pr-20 font-mono text-xs"
                  required
                  minLength={6}
                  disabled={!employee.personal_email || isSubmitting}
                />
                <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
                  {password && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground h-7 w-7"
                          onClick={handleCopy}
                          aria-label="Copy password"
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">{copied ? "Copied!" : "Copy password"}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">{showPassword ? "Hide password" : "Show password"}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Paste the password you entered in cPanel when creating the account. This will be securely emailed to the
                employee.
              </p>
            </div>
          ) : (
            <div className="text-muted-foreground flex items-start gap-2 text-xs">
              <Wand2 className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                If the mailbox already exists its password is replaced, so the employee must use the new one from this
                email.
              </span>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={isSubmitting}
              disabled={!employee.personal_email || (manual && (!password.trim() || password.trim().length < 6))}
            >
              {manual ? "Send Webmail Credentials" : "Set Up Mailbox & Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <NewMailboxPasswordDialog credentials={orphanedCredentials} onClose={() => setOrphanedCredentials(null)} />
    </Dialog>
  )
}
