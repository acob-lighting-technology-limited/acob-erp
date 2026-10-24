"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { apiFetch } from "@/lib/api-client"
import type { MailboxReportRow } from "@/lib/cpanel/mailboxes"

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

export function PasswordDialog({
  mailbox,
  onOpenChange,
}: {
  mailbox: MailboxReportRow | null
  onOpenChange: (open: boolean) => void
}) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (mailbox) {
      setPassword(generateRandomPassword())
      setShowPassword(false)
      setResetSuccess(false)
      setCopied(false)
    }
  }, [mailbox])

  if (!mailbox) return null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    toast.success("Password copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setSubmitting(true)
    try {
      const res = await apiFetch("/api/admin/mailboxes/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: mailbox.email,
          password,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Failed to reset password")

      toast.success(`Password for ${mailbox.email} reset successfully`)
      setResetSuccess(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ResponsiveModal
      open={Boolean(mailbox)}
      onOpenChange={onOpenChange}
      title={resetSuccess ? "Password Reset Complete" : "Reset Mailbox Password"}
      description={
        resetSuccess
          ? `The password for ${mailbox.email} has been updated on cPanel.`
          : `Set a new password for ${mailbox.email} on cPanel.`
      }
      desktopClassName="max-w-md"
    >
      {resetSuccess ? (
        <div className="min-w-0 space-y-4 pt-2">
          <div className="bg-muted/40 min-w-0 space-y-3 rounded-lg border p-4">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Mailbox</p>
              <p className="font-mono text-sm font-medium break-all">{mailbox.email}</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">New Password</p>
              <p className="bg-background/80 mt-1 rounded border p-2.5 font-mono text-sm break-all select-all">
                {password}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={handleCopy} className="gap-1.5">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy Password"}
            </Button>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="min-w-0 space-y-4 pt-2">
          <div className="bg-muted/40 min-w-0 rounded-lg border p-3 text-sm">
            <span className="text-muted-foreground">Mailbox:</span>{" "}
            <span className="font-mono font-medium break-all">{mailbox.email}</span>
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="reset-password">New Password</Label>
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
                id="reset-password"
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
            <p className="text-muted-foreground text-xs">
              Minimum 8 characters. Must contain letters, numbers, and symbols.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Reset Password
            </Button>
          </div>
        </form>
      )}
    </ResponsiveModal>
  )
}
