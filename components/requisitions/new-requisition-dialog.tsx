"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Trash2,
  TriangleAlert,
  Upload,
  Wallet,
} from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PinInput } from "@/components/approval-signing/pin-input"
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
import { NIGERIAN_BANKS, checkNuban, type NigerianBank, type NubanResult } from "@/lib/requisitions/nuban"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import type { Requisition, RequisitionAttachment, RequisitionFormType } from "@/lib/requisitions/types"
import { uploadRequisitionFiles } from "@/lib/requisitions/upload"
import { SavedBeneficiaryPicker } from "./saved-beneficiary-picker"

type CostCategory = "admin" | "operational"

interface ProjectOption {
  id: string
  project_name: string
  location?: string | null
}

interface BeneficiaryDraft {
  account_name: string
  account_number: string
  bank_name: string
  /** Paystack code of the picked bank; empty when typed by hand. */
  bank_code: string
  /** Typing a bank that is not in the list: no format or name check. */
  other_bank: boolean
  /** The account name was filled in by the bank, not typed. */
  name_from_bank: boolean
  /** What this account is paid for; optional, on top of the main purpose. */
  purpose: string
  amount: string
}

interface LineDraft {
  description: string
  amount: string
}

const emptyBeneficiary = (): BeneficiaryDraft => ({
  account_name: "",
  account_number: "",
  bank_name: "",
  bank_code: "",
  other_bank: false,
  name_from_bank: false,
  purpose: "",
  amount: "",
})

const OTHER_BANK = "__other__"

/** What the bank said about one account number at one bank. */
type AccountLookup =
  | { status: "loading" }
  | { status: "found"; accountName: string }
  | { status: "not_found" }
  | { status: "unavailable" }

const lookupKey = (bankCode: string, accountNumber: string) => `${bankCode}:${accountNumber}`

/**
 * One line under a beneficiary: first the check digit (instant, catches
 * typos), then whether the bank confirmed the account and gave its name.
 */
function AccountCheck({
  nuban,
  lookup,
  otherBank,
  onPickBank,
}: {
  nuban: NubanResult | null
  lookup: AccountLookup | undefined
  otherBank: boolean
  onPickBank: (code: string) => void
}) {
  if (otherBank) {
    return (
      <p className="text-muted-foreground text-xs">
        This bank cannot be checked. Type the account name exactly as the bank has it.
      </p>
    )
  }
  if (nuban?.status === "invalid") {
    return (
      <div className="text-danger space-y-1 text-xs" role="alert">
        <p className="flex items-start gap-1.5">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          This is not a valid {nuban.bank.name} account number. Check the digits, or the bank.
        </p>
        {nuban.fits.length ? (
          <p className="text-muted-foreground flex flex-wrap items-center gap-1 pl-5">
            It fits:
            {nuban.fits.slice(0, 4).map((bank) => (
              <button
                key={bank.code}
                type="button"
                onClick={() => onPickBank(bank.code)}
                className="text-foreground hover:bg-muted rounded border px-1.5 py-0.5"
              >
                {bank.name}
              </button>
            ))}
          </p>
        ) : null}
      </div>
    )
  }
  if (!lookup) {
    return (
      <p className="text-muted-foreground text-xs">
        Enter the account number and pick the bank; the account name comes from the bank.
      </p>
    )
  }
  if (lookup.status === "loading") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> Checking the account with the bank…
      </p>
    )
  }
  if (lookup.status === "not_found") {
    return (
      <p className="text-danger flex items-start gap-1.5 text-xs" role="alert">
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
        The bank has no account with this number. Check the number and the bank.
      </p>
    )
  }
  if (lookup.status === "unavailable") {
    return (
      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
        Could not reach the bank. Type the account name; signers will see it was not confirmed.
      </p>
    )
  }
  return (
    <p className="text-success flex items-center gap-1.5 text-xs">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Account name confirmed by the bank.
    </p>
  )
}

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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (requisition: Requisition) => void
}) {
  const [formType, setFormType] = useState<RequisitionFormType | null>(null)
  const [costCategory, setCostCategory] = useState<CostCategory>("operational")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [customProjectName, setCustomProjectName] = useState("")
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [purpose, setPurpose] = useState("")
  const [amount, setAmount] = useState("")
  const [lines, setLines] = useState<LineDraft[]>([{ description: "", amount: "" }])
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryDraft[]>([emptyBeneficiary()])
  const [attachments, setAttachments] = useState<RequisitionAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Submitting signs "Requested by": the requester confirms with their approval PIN.
  const [pin, setPin] = useState("")
  const [signing, setSigning] = useState<{ has_signature: boolean; has_pin: boolean } | null>(null)
  const pathname = usePathname()
  const signingMissing = signing
    ? [!signing.has_signature && "signature", !signing.has_pin && "PIN"].filter(Boolean)
    : []
  const [banks, setBanks] = useState<NigerianBank[]>([...NIGERIAN_BANKS])
  const [lookups, setLookups] = useState<Record<string, AccountLookup>>({})

  useEffect(() => {
    if (!open) return
    setFormType(null)
    setCostCategory("operational")
    setSelectedProjectId("")
    setCustomProjectName("")
    setProjectName("")
    setPurpose("")
    setAmount("")
    setLines([{ description: "", amount: "" }])
    setBeneficiaries([emptyBeneficiary()])
    setAttachments([])
    setLookups({})
    setPin("")
    apiFetch("/api/profile/signing")
      .then((res) => res.json())
      .then((json) => setSigning(json?.data ?? null))
      .catch(() => setSigning(null))
    setLoadingProjects(true)

    apiFetch("/api/requisitions/banks")
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.data) && json.data.length) setBanks(json.data)
      })
      .catch(() => undefined)

    Promise.all([
      apiFetch("/api/projects")
        .then((res) => res.json())
        .then((json) => {
          if (Array.isArray(json.data)) {
            const list: ProjectOption[] = json.data
              .filter((p: { id?: string; project_name?: string }) => p?.id && p?.project_name?.trim())
              .map((p: { id: string; project_name: string; location?: string | null }) => ({
                id: p.id,
                project_name: p.project_name.trim(),
                location: p.location || null,
              }))
            setProjects(list.sort((a, b) => a.project_name.localeCompare(b.project_name)))
          } else {
            setProjects([])
          }
        })
        .catch(() => setProjects([])),
    ]).finally(() => {
      setLoadingProjects(false)
    })
  }, [open])

  const resolvedProjectName =
    costCategory === "operational"
      ? selectedProjectId === "__other__"
        ? customProjectName.trim()
        : projectName.trim()
      : projectName.trim()

  const handleCostCategoryChange = (val: CostCategory) => {
    setCostCategory(val)
    if (val === "operational") {
      if (selectedProjectId === "__other__") {
        setProjectName(customProjectName)
      } else {
        const found = projects.find((p) => p.id === selectedProjectId)
        setProjectName(found ? found.project_name : "")
      }
    }
  }

  const handleProjectSelect = (val: string) => {
    setSelectedProjectId(val)
    if (val === "__other__") {
      setProjectName(customProjectName)
    } else {
      const found = projects.find((p) => p.id === val)
      if (found) {
        setProjectName(found.project_name)
      } else {
        setProjectName("")
      }
    }
  }

  const handleCustomProjectChange = (val: string) => {
    setCustomProjectName(val)
    setProjectName(val)
  }

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
  // The project is the site: there is no separate site location to ask for.
  const listedProject = costCategory === "operational" ? projects.find((p) => p.id === selectedProjectId) || null : null
  const isPaymentRequestIncomplete = formType === "payment_request" && (!resolvedProjectName || !purpose.trim())

  const updateBeneficiary = (index: number, patch: Partial<BeneficiaryDraft>) =>
    setBeneficiaries((prev) =>
      prev.map((b, i) => {
        if (i !== index) return b
        const next = { ...b, ...patch }
        const accountChanged =
          next.account_number !== b.account_number || next.bank_code !== b.bank_code || next.other_bank !== b.other_bank
        if (!accountChanged) return next
        // A number already looked up needs no new request: take the bank's name straight away.
        const known = next.other_bank ? undefined : lookups[lookupKey(next.bank_code, next.account_number)]
        if (known?.status === "found") return { ...next, account_name: known.accountName, name_from_bank: true }
        return b.name_from_bank ? { ...next, account_name: "", name_from_bank: false } : next
      })
    )
  const bankOptions = useMemo(
    () => [
      ...banks.map((b) => ({ value: b.code, label: b.name })),
      { value: OTHER_BANK, label: "Other bank (type the name)" },
    ],
    [banks]
  )
  const bankByCode = useMemo(() => new Map(banks.map((b) => [b.code, b])), [banks])
  const pickBank = (index: number, code: string) => {
    if (code === OTHER_BANK) return updateBeneficiary(index, { other_bank: true, bank_name: "", bank_code: "" })
    const bank = bankByCode.get(code) ?? NIGERIAN_BANKS.find((b) => b.code === code)
    if (bank) updateBeneficiary(index, { other_bank: false, bank_name: bank.name, bank_code: bank.code })
  }
  const nubanResults = beneficiaries.map((b) =>
    b.other_bank ? null : checkNuban(b.account_number, bankByCode.get(b.bank_code))
  )
  // Ask the bank for the name once the number is complete and passes the check digit.
  const lookupKeys = beneficiaries.map((b, i) =>
    !b.other_bank && b.bank_code && b.account_number.length === 10 && nubanResults[i]?.status !== "invalid"
      ? lookupKey(b.bank_code, b.account_number)
      : null
  )
  const pendingLookups = Array.from(new Set(lookupKeys.filter((k): k is string => !!k && !lookups[k]))).join(",")
  useEffect(() => {
    if (!pendingLookups) return
    const timer = setTimeout(() => {
      for (const key of pendingLookups.split(",")) {
        const [bankCode, accountNumber] = key.split(":")
        setLookups((prev) => ({ ...prev, [key]: { status: "loading" } }))
        apiFetch("/api/requisitions/resolve-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
        })
          .then((res) => res.json())
          .then((json) => {
            const result: AccountLookup = json?.data?.status ? json.data : { status: "unavailable" }
            setLookups((prev) => ({ ...prev, [key]: result }))
            // The account name is the bank's, not whatever was typed.
            if (result.status === "found") {
              setBeneficiaries((prev) =>
                prev.map((b) =>
                  !b.other_bank && lookupKey(b.bank_code, b.account_number) === key
                    ? { ...b, account_name: result.accountName, name_from_bank: true }
                    : b
                )
              )
            }
          })
          .catch(() => setLookups((prev) => ({ ...prev, [key]: { status: "unavailable" } })))
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [pendingLookups])

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

    if (formType === "payment_request") {
      if (!resolvedProjectName) {
        toast.error("Project is required")
        return
      }
      if (!purpose.trim()) {
        toast.error("Purpose is required")
        return
      }
    }

    const badAccount = beneficiaries.findIndex((_, i) => {
      const key = lookupKeys[i]
      return nubanResults[i]?.status === "invalid" || (key ? lookups[key]?.status === "not_found" : false)
    })
    if (badAccount >= 0) {
      toast.error(
        `Beneficiary ${badAccount + 1}: the account number is not valid for ${beneficiaries[badAccount].bank_name}`
      )
      return
    }
    if (lookupKeys.some((k) => k && lookups[k]?.status === "loading")) {
      toast.error("Still checking an account name with the bank. Try again in a moment.")
      return
    }

    if (pin.length !== 6) {
      toast.error("Enter your 6-digit approval PIN to sign the request")
      return
    }

    const beneficiaryPayload = beneficiaries.map((b) => ({
      account_name: b.account_name,
      account_number: b.account_number.replace(/\s/g, ""),
      bank_name: b.bank_name,
      ...(b.bank_code && !b.other_bank ? { bank_code: b.bank_code } : {}),
      ...(b.purpose.trim() ? { purpose: b.purpose.trim() } : {}),
      ...(showSplit && b.amount ? { amount: Number(b.amount) } : {}),
    }))
    const common = {
      pin,
      beneficiary_details: beneficiaryPayload,
      attachments,
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
            ...(listedProject ? { project_id: listedProject.id } : {}),
            project_name: resolvedProjectName,
            purpose: purpose.trim(),
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
      setPin("")
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
                  <Label htmlFor="req-category">Cost category</Label>
                  <Select value={costCategory} onValueChange={(val: CostCategory) => handleCostCategoryChange(val)}>
                    <SelectTrigger id="req-category" aria-label="Cost category">
                      <SelectValue placeholder="Select cost category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operational">Operational Cost</SelectItem>
                      <SelectItem value="admin">Admin Cost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {costCategory === "admin" ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="req-project">Project</Label>
                    <Input
                      id="req-project"
                      placeholder="Enter project name"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Project</Label>
                      <SearchableSelect
                        value={selectedProjectId}
                        onValueChange={handleProjectSelect}
                        placeholder={loadingProjects ? "Loading projects..." : "Select a project"}
                        searchPlaceholder="Search projects..."
                        options={[
                          ...projects.map((p) => ({ value: p.id, label: p.project_name })),
                          { value: "__other__", label: "Others (not in the list)" },
                        ]}
                      />
                    </div>

                    {selectedProjectId === "__other__" ? (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="req-custom-project">Specify Project</Label>
                        <Input
                          id="req-custom-project"
                          placeholder="Enter project name"
                          value={customProjectName}
                          onChange={(e) => handleCustomProjectChange(e.target.value)}
                        />
                      </div>
                    ) : null}
                  </>
                )}

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
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Items</Label>
                {lines.map((line, i) => (
                  <div
                    key={`row-${i}`}
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
              {beneficiaries.map((b, i) => {
                const lookup = lookupKeys[i] ? lookups[lookupKeys[i]!] : undefined
                // Typed only when the bank cannot give it: a bank outside the list, or Paystack unreachable.
                const nameEditable = b.other_bank || lookup?.status === "unavailable"
                return (
                  <div key={`row-${i}`} className="space-y-2 rounded-md border p-3">
                    <SavedBeneficiaryPicker
                      index={i}
                      onPick={(saved) =>
                        updateBeneficiary(i, {
                          account_number: saved.account_number,
                          bank_code: saved.bank_code,
                          bank_name: saved.bank_name,
                          other_bank: false,
                        })
                      }
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Input
                        aria-label={`Beneficiary ${i + 1} account number`}
                        placeholder="Account no (10 digits)"
                        inputMode="numeric"
                        maxLength={10}
                        value={b.account_number}
                        onChange={(e) => updateBeneficiary(i, { account_number: e.target.value.replace(/\D/g, "") })}
                      />
                      {b.other_bank ? (
                        <div className="flex gap-1">
                          <Input
                            aria-label={`Beneficiary ${i + 1} bank`}
                            placeholder="Bank name"
                            value={b.bank_name}
                            onChange={(e) => updateBeneficiary(i, { bank_name: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 px-2 text-xs"
                            onClick={() => updateBeneficiary(i, { other_bank: false, bank_name: "", bank_code: "" })}
                          >
                            List
                          </Button>
                        </div>
                      ) : (
                        <SearchableSelect
                          value={b.bank_code}
                          onValueChange={(value) => pickBank(i, value)}
                          placeholder="Select bank"
                          searchPlaceholder="Search banks..."
                          options={bankOptions}
                        />
                      )}
                      <Input
                        aria-label={`Beneficiary ${i + 1} account name`}
                        placeholder={nameEditable ? "Account name" : "Filled in by the bank"}
                        readOnly={!nameEditable}
                        tabIndex={nameEditable ? undefined : -1}
                        className={nameEditable ? undefined : "bg-muted/50 font-medium"}
                        value={b.account_name}
                        onChange={(e) => updateBeneficiary(i, { account_name: e.target.value, name_from_bank: false })}
                      />
                    </div>
                    <AccountCheck
                      nuban={nubanResults[i]}
                      lookup={lookup}
                      otherBank={b.other_bank}
                      onPickBank={(code) => pickBank(i, code)}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        aria-label={`Beneficiary ${i + 1} purpose`}
                        placeholder="Purpose for this account (optional)"
                        maxLength={300}
                        className="sm:flex-1"
                        value={b.purpose}
                        onChange={(e) => updateBeneficiary(i, { purpose: e.target.value })}
                      />
                      {showSplit ? (
                        <div className="flex items-center gap-2">
                          <Input
                            aria-label={`Beneficiary ${i + 1} amount`}
                            placeholder="Amount"
                            inputMode="decimal"
                            className="sm:w-36"
                            value={b.amount}
                            onChange={(e) => updateBeneficiary(i, { amount: e.target.value })}
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
                  </div>
                )
              })}
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

            <div className="grid gap-4">
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

            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="req-pin">Sign and submit</Label>
              {signingMissing.length ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <span>Before you can submit, set up your {signingMissing.join(" and ")}.</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/settings/signing?return=${encodeURIComponent(pathname)}`}>Set up signing</Link>
                  </Button>
                </div>
              ) : (
                <PinInput id="req-pin" value={pin} onChange={setPin} />
              )}
              <p className="text-muted-foreground text-xs">
                Your signature goes on the form as &ldquo;Requested by&rdquo;, with your name and today&apos;s date.
              </p>
            </div>
          </div>
        )}

        {formType ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                submitting ||
                uploading ||
                Boolean(rangeProblem) ||
                total <= 0 ||
                isPaymentRequestIncomplete ||
                signingMissing.length > 0 ||
                pin.length !== 6
              }
            >
              {submitting || uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign and submit {FORM_LABELS[formType]}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
