"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, FileText, Loader2, Plus, Receipt, Trash2, Upload, Wallet } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import { formatNaira } from "@/lib/requisitions/format"
import {
  FORM_LABELS,
  MAX_BENEFICIARIES,
  PAYMENT_REQUEST_MIN,
  PETTY_CASH_MAX,
  REQUISITION_ATTACHMENT_MAX_COUNT,
  REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES,
  amountOutOfRangeMessage,
  lineItemsTotal,
} from "@/lib/requisitions/limits"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import type {
  Requisition,
  RequisitionAttachment,
  RequisitionFormType,
  RequisitionFundingCategory,
} from "@/lib/requisitions/types"
import { uploadRequisitionFiles } from "@/lib/requisitions/upload"

const NO_FUNDING = "none"

interface BeneficiaryDraft {
  account_name: string
  account_number: string
  bank_name: string
  amount: string
}

interface LineDraft {
  description: string
  amount: string
}

const emptyBeneficiary = (): BeneficiaryDraft => ({ account_name: "", account_number: "", bank_name: "", amount: "" })

function FormChoice({ onPick }: { onPick: (type: RequisitionFormType) => void }) {
  const choices: { type: RequisitionFormType; icon: typeof Wallet; title: string; text: string }[] = [
    {
      type: "payment_request",
      icon: FileText,
      title: FORM_LABELS.payment_request,
      text: `${formatNaira(PAYMENT_REQUEST_MIN).replace(".00", "")} and above. For project expenses, vendor invoices, contracts, and major purchases.`,
    },
    {
      type: "petty_cash",
      icon: Receipt,
      title: FORM_LABELS.petty_cash,
      text: `Up to ${formatNaira(PETTY_CASH_MAX).replace(".00", "")}. For minor office expenses, urgent supplies, and daily running costs.`,
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map(({ type, icon: Icon, title, text }) => (
        <button
          key={type}
          type="button"
          onClick={() => onPick(type)}
          className="hover:border-primary hover:bg-primary/5 focus-visible:ring-ring rounded-lg border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none"
        >
          <Icon className="text-primary mb-2 h-6 w-6" aria-hidden />
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground mt-1 text-sm">{text}</p>
        </button>
      ))}
      <p className="text-muted-foreground text-xs sm:col-span-2">
        Expenses under ₦50,000 must use Petty Cash. For exactly ₦50,000, either form can be used.
      </p>
    </div>
  )
}

/**
 * Raise a Payment Request or a Petty Cash voucher. When opened from a help
 * desk ticket, the ticket is linked and named in the purpose.
 */
export function NewRequisitionDialog({
  open,
  onOpenChange,
  onSuccess,
  helpDeskTicket,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (requisition: Requisition) => void
  helpDeskTicket?: { id: string; ticket_number: string; title: string } | null
}) {
  const [formType, setFormType] = useState<RequisitionFormType | null>(null)
  const [projectName, setProjectName] = useState("")
  const [purpose, setPurpose] = useState("")
  const [siteLocation, setSiteLocation] = useState("")
  const [amount, setAmount] = useState("")
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", amount: "" }])
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryDraft[]>([emptyBeneficiary()])
  const [attachments, setAttachments] = useState<RequisitionAttachment[]>([])
  const [fundingCategories, setFundingCategories] = useState<RequisitionFundingCategory[]>([])
  const [fundingId, setFundingId] = useState(NO_FUNDING)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFormType(null)
    setProjectName("")
    setPurpose(helpDeskTicket ? `For help desk ticket ${helpDeskTicket.ticket_number}: ${helpDeskTicket.title}` : "")
    setSiteLocation("")
    setAmount("")
    setLines([
      { description: helpDeskTicket ? `${helpDeskTicket.ticket_number}: ${helpDeskTicket.title}` : "", amount: "" },
    ])
    setBeneficiaries([emptyBeneficiary()])
    setAttachments([])
    setFundingId(NO_FUNDING)
    apiFetch("/api/requisitions/funding-categories")
      .then((res) => res.json())
      .then((json) => setFundingCategories(json.data || []))
      .catch(() => setFundingCategories([]))
  }, [open, helpDeskTicket])

  const total = useMemo(
    () =>
      formType === "petty_cash"
        ? lineItemsTotal(lines.map((l) => ({ amount: Number(l.amount) || 0 })))
        : Number(amount) || 0,
    [formType, lines, amount]
  )
  const rangeProblem = formType && total > 0 ? amountOutOfRangeMessage(formType, total) : null
  const otherForm: RequisitionFormType = formType === "petty_cash" ? "payment_request" : "petty_cash"
  const maxBeneficiaries = formType ? MAX_BENEFICIARIES[formType] : 1
  const showSplit = beneficiaries.length > 1

  const updateBeneficiary = (index: number, field: keyof BeneficiaryDraft, value: string) =>
    setBeneficiaries((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)))
  const updateLine = (index: number, field: keyof LineDraft, value: string) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const fileArray = Array.from(files)
    if (attachments.length + fileArray.length > REQUISITION_ATTACHMENT_MAX_COUNT) {
      toast.error(
        `You can attach at most ${REQUISITION_ATTACHMENT_MAX_COUNT} files (${attachments.length} already attached)`
      )
      return
    }
    const currentBytes = attachments.reduce((sum, a) => sum + (a.file_size || 0), 0)
    const newBytes = fileArray.reduce((sum, f) => sum + f.size, 0)
    if (currentBytes + newBytes > REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES) {
      toast.error(`Combined attachments cannot exceed ${REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024)} MB`)
      return
    }
    setUploading(true)
    try {
      const uploaded = await uploadRequisitionFiles(fileArray, "documents", attachments)
      setAttachments((prev) => [...prev, ...uploaded])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const submit = async () => {
    if (!formType) return
    if (rangeProblem) return toast.error(rangeProblem)
    const beneficiaryPayload = beneficiaries.map((b) => ({
      account_name: b.account_name,
      account_number: b.account_number.replace(/\s/g, ""),
      bank_name: b.bank_name,
      ...(showSplit && b.amount ? { amount: Number(b.amount) } : {}),
    }))
    const common = {
      beneficiary_details: beneficiaryPayload,
      attachments,
      funding_category_id: fundingId === NO_FUNDING ? null : fundingId,
      help_desk_ticket_id: helpDeskTicket?.id ?? null,
    }
    const body =
      formType === "petty_cash"
        ? {
            form_type: formType,
            line_items: lines.map((l) => ({ description: l.description, amount: Number(l.amount) || 0 })),
            ...common,
          }
        : {
            form_type: formType,
            project_name: projectName,
            purpose,
            site_location: siteLocation || undefined,
            amount: Number(amount) || 0,
            ...common,
          }

    setSubmitting(true)
    try {
      const res = await apiFetch("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || "Could not submit the requisition")
      toast.success(json.message || "Submitted")
      onOpenChange(false)
      onSuccess?.(json.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the requisition")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formType ? `New ${FORM_LABELS[formType]}` : "New requisition"}</DialogTitle>
          <DialogDescription>
            {formType
              ? "It goes to the first signer as soon as you submit."
              : "Which form do you need? The amount decides."}
          </DialogDescription>
        </DialogHeader>

        {!formType ? (
          <FormChoice onPick={setFormType} />
        ) : (
          <div className="space-y-5">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setFormType(null)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Change form
            </Button>

            {formType === "payment_request" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="req-project">Project</Label>
                  <Input id="req-project" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="req-purpose">Purpose</Label>
                  <Textarea id="req-purpose" rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="req-amount">Amount (₦)</Label>
                  <Input
                    id="req-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="req-site">Site location (optional)</Label>
                  <Input id="req-site" value={siteLocation} onChange={(e) => setSiteLocation(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Items</Label>
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1.5rem_1fr_7rem_2rem] items-center gap-2 sm:grid-cols-[1.5rem_1fr_9rem_2rem]"
                  >
                    <span className="text-muted-foreground text-right text-sm">{i + 1}</span>
                    <Input
                      aria-label={`Item ${i + 1} description`}
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                    />
                    <Input
                      aria-label={`Item ${i + 1} amount`}
                      placeholder="Amount"
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(e) => updateLine(i, "amount", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove item ${i + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, { description: "", amount: "" }])}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add item
                </Button>
              </div>
            )}

            <div className="bg-muted/50 space-y-1 rounded-md p-3 text-sm">
              <p>
                Total: <strong>{formatNaira(total)}</strong>
              </p>
              {total > 0 ? <p className="text-muted-foreground">{numberToNairaWords(total)}</p> : null}
              {rangeProblem ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-destructive">{rangeProblem}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormType(otherForm)}>
                    Switch to {FORM_LABELS[otherForm]}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Beneficiary details</Label>
              {beneficiaries.map((b, i) => (
                <div key={i} className="space-y-2 rounded-md border p-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      aria-label={`Beneficiary ${i + 1} account name`}
                      placeholder="Account name"
                      value={b.account_name}
                      onChange={(e) => updateBeneficiary(i, "account_name", e.target.value)}
                    />
                    <Input
                      aria-label={`Beneficiary ${i + 1} account number`}
                      placeholder="Account no (10 digits)"
                      inputMode="numeric"
                      maxLength={10}
                      value={b.account_number}
                      onChange={(e) => updateBeneficiary(i, "account_number", e.target.value.replace(/\D/g, ""))}
                    />
                    <Input
                      aria-label={`Beneficiary ${i + 1} bank`}
                      placeholder="Bank name"
                      value={b.bank_name}
                      onChange={(e) => updateBeneficiary(i, "bank_name", e.target.value)}
                    />
                  </div>
                  {showSplit ? (
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Beneficiary ${i + 1} amount`}
                        placeholder="Amount for this beneficiary"
                        inputMode="decimal"
                        className="max-w-[14rem]"
                        value={b.amount}
                        onChange={(e) => updateBeneficiary(i, "amount", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setBeneficiaries((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {beneficiaries.length < maxBeneficiaries ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBeneficiaries((prev) => [...prev, emptyBeneficiary()])}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add beneficiary
                </Button>
              ) : null}
              {showSplit ? (
                <p className="text-muted-foreground text-xs">
                  Split amounts are optional; if you give them, they must add up to the total.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Funding category (optional)</Label>
                <Select value={fundingId} onValueChange={setFundingId}>
                  <SelectTrigger aria-label="Funding category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_FUNDING}>Not specified</SelectItem>
                    {fundingCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="req-files">Supporting documents (optional)</Label>
                  <span className="text-muted-foreground text-xs">Max 20 files · 20 MB total</span>
                </div>
                <Input
                  id="req-files"
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  disabled={uploading || attachments.length >= REQUISITION_ATTACHMENT_MAX_COUNT}
                  onChange={(e) => {
                    handleFiles(e.target.files)
                    e.target.value = ""
                  }}
                />
              </div>
            </div>
            {attachments.length ? (
              <div className="space-y-1.5">
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>
                    {attachments.length} of {REQUISITION_ATTACHMENT_MAX_COUNT} files
                  </span>
                  <span>
                    {(attachments.reduce((sum, a) => sum + (a.file_size || 0), 0) / (1024 * 1024)).toFixed(1)} MB /{" "}
                    {REQUISITION_ATTACHMENT_MAX_TOTAL_BYTES / (1024 * 1024)} MB
                  </span>
                </div>
                <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {attachments.map((file, i) => (
                    <li
                      key={file.file_path}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Upload className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{file.file_name}</span>
                        {file.file_size ? (
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            ({(file.file_size / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                        ) : null}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${file.file_name}`}
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {formType ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || uploading || Boolean(rangeProblem) || total <= 0}>
              {submitting || uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit {FORM_LABELS[formType]}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
