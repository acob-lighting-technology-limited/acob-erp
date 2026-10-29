"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, Copy, Download, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MAIL_CLIENT_SETTINGS, WEBMAIL_URL } from "@/lib/mail/client-settings"
import {
  buildAnniversarySignatureHtml,
  formatNameProperly,
  formatSignaturePhone,
} from "@/lib/signature/default-signature"

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
    } catch {
      toast.error("Could not copy — select the text and copy it manually")
    }
  }
  return { copied, copy }
}

function CopyRow({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copyKey: string
  copied: string | null
  onCopy: (key: string, value: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-mono text-sm break-all">{value}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onCopy(copyKey, value)}
        aria-label={`Copy ${label}`}
      >
        {copied === copyKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={`row-${i}`}>{item}</li>
      ))}
    </ol>
  )
}

/**
 * "Set up email on my phone": one-tap install for iPhone, filled-in settings
 * with copy buttons for Gmail / Android / Outlook, and the current ACOB
 * signature (the 10th-anniversary one, as the Signature Creator makes it) to paste.
 * Every value is the signed-in user's own.
 */
export function EmailSetupDialog({
  open,
  onOpenChange,
  email,
  fullName,
  designation,
  phone,
  additionalEmail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  fullName: string
  designation: string | null
  phone: string | null
  additionalEmail: string | null
}) {
  const { copied, copy } = useCopy()
  const s = MAIL_CLIENT_SETTINGS

  const settingsCard = (
    <div className="rounded-lg border px-3">
      <CopyRow label="Email address / username" value={email} copyKey="user" copied={copied} onCopy={copy} />
      <CopyRow
        label="Incoming (IMAP) and outgoing (SMTP) server"
        value={s.host}
        copyKey="host"
        copied={copied}
        onCopy={copy}
      />
      <CopyRow label="Incoming port (IMAP)" value={String(s.imapPort)} copyKey="imap" copied={copied} onCopy={copy} />
      <CopyRow label="Outgoing port (SMTP)" value={String(s.smtpPort)} copyKey="smtp" copied={copied} onCopy={copy} />
      <div className="py-2 text-sm">
        <span className="text-muted-foreground text-xs">Security: </span>
        <span className="font-medium">{s.security}</span>
        <span className="text-muted-foreground text-xs"> for both · Password: your mailbox password</span>
      </div>
    </div>
  )

  const signatureHtml = buildAnniversarySignatureHtml({
    fullName: formatNameProperly(fullName),
    companyRole: designation ?? "",
    phoneNumber: phone ?? "",
    formattedPhone: formatSignaturePhone(phone ?? ""),
    companyEmail: email,
    alternativeEmail: additionalEmail ?? "",
    emailContactOrder: "main-first",
  })

  // Rich copy, exactly as the Signature Creator does, so pasting keeps the
  // logo, icons and layout.
  const copySignature = async () => {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([signatureHtml], { type: "text/html" }),
            "text/plain": new Blob([signatureHtml], { type: "text/plain" }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(signatureHtml)
      }
      toast.success("Signature copied — paste it into your mail app's signature settings")
    } catch {
      toast.error("Could not copy the signature")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="text-primary h-5 w-5" />
            Set up your work email
          </DialogTitle>
          <DialogDescription className="break-all">
            Use {email} in your phone or computer mail app — it stays signed in, unlike webmail.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="iphone">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="iphone">iPhone</TabsTrigger>
            <TabsTrigger value="android">Gmail</TabsTrigger>
            <TabsTrigger value="outlook">Outlook</TabsTrigger>
            <TabsTrigger value="signature">Signature</TabsTrigger>
          </TabsList>

          <TabsContent value="iphone" className="space-y-4 pt-2">
            <p className="text-sm">One tap adds your work email to the iPhone Mail app with every setting filled in.</p>
            <Button asChild className="w-full gap-2">
              <a href="/api/profile/mailbox/ios-profile">
                <Download className="h-4 w-4" />
                Set up on this iPhone
              </a>
            </Button>
            <Steps
              items={[
                <>
                  Open this page in <strong>Safari</strong> on your iPhone (not Chrome, and not the Matrix home-screen
                  icon) and tap the button above → <strong>Allow</strong>.
                </>,
                <>
                  Open <strong>Settings</strong> → tap <strong>Profile Downloaded</strong> at the top →{" "}
                  <strong>Install</strong>.
                </>,
                <>
                  When asked, type your <strong>mailbox password</strong> → <strong>Done</strong>. Your mail appears in
                  the Mail app.
                </>,
              ]}
            />
            <p className="text-muted-foreground text-xs">
              iPhone shows the profile as &quot;Not Verified&quot; — that is normal for company profiles. To remove it
              later: Settings → General → VPN &amp; Device Management. The same file works on a Mac: download it, then
              System Settings → Profiles → Install.
            </p>
          </TabsContent>

          <TabsContent value="android" className="space-y-4 pt-2">
            <Steps
              items={[
                <>
                  In the <strong>Gmail</strong> app: tap your picture → <strong>Add another account</strong> →{" "}
                  <strong>Other</strong>.
                </>,
                <>
                  Enter your email → <strong>Manual setup</strong> → <strong>Personal (IMAP)</strong> → your mailbox
                  password.
                </>,
                <>
                  Incoming server: enter the <strong>server</strong> and <strong>port 993</strong> below, security{" "}
                  <strong>SSL/TLS</strong>.
                </>,
                <>
                  Outgoing server: the same <strong>server</strong>, <strong>port 465</strong>, security{" "}
                  <strong>SSL/TLS</strong>, &quot;require sign-in&quot; on.
                </>,
              ]}
            />
            {settingsCard}
            <p className="text-muted-foreground text-xs">
              Samsung Email and other Android mail apps use the same settings.
            </p>
          </TabsContent>

          <TabsContent value="outlook" className="space-y-4 pt-2">
            <Steps
              items={[
                <>
                  Outlook → <strong>Add account</strong> → type your email.
                </>,
                <>
                  Choose <strong>IMAP</strong> (on a computer:{" "}
                  <strong>Advanced options → Let me set up my account manually</strong>).
                </>,
                <>Fill in the server and ports below for both incoming and outgoing, then your mailbox password.</>,
              ]}
            />
            {settingsCard}
            <p className="text-muted-foreground text-xs">
              If Outlook fills in <span className="font-mono">org.acoblighting.com</span> by itself and warns about a
              certificate, replace it with the server above — that one has a valid certificate.
            </p>
          </TabsContent>

          <TabsContent value="signature" className="space-y-4 pt-2">
            <p className="text-sm">Your ACOB 10th-anniversary signature — the same one the Signature Creator makes.</p>
            <div className="max-h-64 overflow-auto rounded-lg border bg-white p-3 text-black">
              <div dangerouslySetInnerHTML={{ __html: signatureHtml }} />
            </div>
            <Button type="button" className="w-full gap-2" onClick={() => void copySignature()}>
              <Copy className="h-4 w-4" />
              Copy signature
            </Button>
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">Where to paste it</p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
                <li>
                  <strong>Webmail:</strong> Settings → Identities → your address → Signature → switch to HTML → paste →
                  Save.
                </li>
                <li>
                  <strong>Outlook (computer):</strong> Settings → Signatures → New → paste.
                </li>
                <li>
                  <strong>iPhone Mail:</strong> open this window on the iPhone, copy, then Settings → Apps → Mail →
                  Signature → paste.
                </li>
                <li>
                  <strong>Outlook / Gmail phone apps:</strong> their signature boxes accept text only, so the logo and
                  icons are dropped. For mail that should carry the full signature, send from webmail, Outlook on a
                  computer, or iPhone Mail.
                </li>
              </ul>
              <Link href="/tools/signature-anniversary" className="text-primary text-xs underline">
                Need to change something? Open the Signature Creator
              </Link>
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-muted-foreground border-t pt-3 text-xs">
          Prefer the browser?{" "}
          <a href={WEBMAIL_URL} target="_blank" rel="noreferrer" className="text-primary underline">
            Webmail
          </a>{" "}
          still works, or use the open-mailbox icon beside your email to sign in with one click.
        </p>
      </DialogContent>
    </Dialog>
  )
}
