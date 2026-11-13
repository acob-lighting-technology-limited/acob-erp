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
import { RequisitionPinDialog } from "./requisition-pin-dialog"
import { SigningSetupNotice } from "./signing-setup-notice"
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
  cleanAmountInput,
  lineItemsTotal,
  parseNaira,
} from "@/lib/requisitions/limits"
import { NIGERIAN_BANKS, checkNuban, type NigerianBank, type NubanResult } from "@/lib/requisitions/nuban"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import type { Requisition, RequisitionAttachment, RequisitionFormType } from "@/lib/requisitions/types"
import { uploadRequisitionFiles } from "@/lib/requisitions/upload"
import { SavedBeneficiaryPicker } from "./saved-beneficiary-picker"
import { AccountCheck, type AccountLookup } from "./account-check"
import { FormChoice } from "./form-choice"

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
  /** Bank transfer to an account, or cash handed over (no account, bank or schedule line). */
  method: "transfer" | "cash"
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
  method: "transfer",
})

const OTHER_BANK = "__other__"

const lookupKey = (bankCode: string, accountNumber: string) => `${bankCode}:${accountNumber}`

/**
 * Raise a Payment Request or a Petty Cash voucher. When opened from a help
 * desk ticket, the ticket is linked and named in the purpose.
 */
export function NewRequisitionDialog({
  open,
  onOpenChange,
  onSuccess,
  editing = null,
  convertFrom = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (requisition: Requisition) => void
  /** Change a pending requisition the requester raised. The form type stays the same. */
  editing?: Requisition | null
  /** Convert a rejected requisition: the form starts from it, in the form type picked next. */
  convertFrom?: Requisition | null
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
  // Petty cash above the cap goes through only as an exception, with the reason written down.
  const [exceptionOn, setExceptionOn] = useState(false)
  const [exceptionReason, setExceptionReason] = useState("")
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryDraft[]>([emptyBeneficiary()])
  const [attachments, setAttachments] = useState<RequisitionAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Submitting signs "Requested by": a PIN dialog opens once the form is complete.
  const [pinOpen, setPinOpen] = useState(false)
  // After the first Submit press the list of what is missing stays on screen and shrinks as it is fixed.
  const [attempted, setAttempted] = useState(false)
  const [signing, setSigning] = useState<{ has_signature: boolean; has_pin: boolean } | null>(null)
  const pathname = usePathname()
  const signingMissing = signing
    ? [!signing.has_signature && "signature", !signing.has_pin && "PIN"].filter(Boolean)
    : []
  const [banks, setBanks] = useState<NigerianBank[]>([...NIGERIAN_BANKS])
  const [lookups, setLookups] = useState<Record<string, AccountLookup>>({})

  useEffect(() => {
    if (!open) return
    // Editing starts from the form as it is; converting starts from the rejected one, in the form type picked next.
    const from = editing ?? convertFrom ?? null
    // Converting goes straight to the other form type; the user only changes it with Back.
    setFormType(
      editing
        ? editing.form_type
        : convertFrom
          ? convertFrom.form_type === "petty_cash"
            ? "payment_request"
            : "petty_cash"
          : null
    )
    setCostCategory(from?.project_name ? "admin" : "operational")
    setSelectedProjectId("")
    setCustomProjectName("")
    setProjectName(from?.project_name ?? "")
    // A petty cash voucher has items, not a purpose: converting numbers the item descriptions into the purpose.
    setPurpose(
      from?.purpose ??
        (from?.line_items?.length ? from.line_items.map((l, i) => `${i + 1}. ${l.description.trim()}`).join("\n") : "")
    )
    setAmount(from?.amount != null ? String(from.amount) : "")
    setLines(
      from?.line_items?.length
        ? from.line_items.map((l) => ({ description: l.description, amount: String(l.amount) }))
        : [{ description: "", amount: "" }]
    )
    setBeneficiaries(
      from?.beneficiary_details?.length
        ? from.beneficiary_details.map((b) => {
            const cash = b.payment_method === "cash"
            return {
              account_name: b.account_name,
              account_number: cash ? "" : b.account_number,
              bank_name: cash ? "" : b.bank_name,
              bank_code: cash ? "" : (b.bank_code ?? ""),
              other_bank: !cash && !b.bank_code,
              name_from_bank: !cash && Boolean(b.verified_account_name),
              purpose: b.purpose ?? "",
              amount: b.amount != null ? String(b.amount) : "",
              method: cash ? "cash" : "transfer",
            }
          })
        : [emptyBeneficiary()]
    )
    setAttachments(from?.attachments ?? [])
    setExceptionOn(Boolean(from?.exception_reason))
    setExceptionReason(from?.exception_reason ?? "")
    setLookups({})
    setPinOpen(false)
    setAttempted(false)
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
  }, [open, editing, convertFrom])

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
        ? lineItemsTotal(lines.map((l) => ({ amount: parseNaira(l.amount) })))
        : parseNaira(amount),
    [formType, lines, amount]
  )
  const rangeProblem = formType && total > 0 ? amountOutOfRangeMessage(formType, total) : null
  // Outside the form's usual range (petty cash above the cap, or a Payment Request below the minimum): an exception.
  const isException = rangeProblem !== null
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
  // The bank's name enquiry is the authority. NUBAN is a helpful early signal,
  // but mergers can leave valid accounts with a legacy institution code.
  const lookupKeys = beneficiaries.map((b, i) =>
    b.method === "transfer" && !b.other_bank && b.bank_code && b.account_number.length === 10
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

  /** Everything still missing, in the order the form asks for it. Empty means ready to sign. */
  const collectProblems = (): string[] => {
    if (!formType) return []
    const found: string[] = []
    if (formType === "payment_request") {
      if (!resolvedProjectName) found.push("Pick the project.")
      if (!purpose.trim()) found.push("Say what the payment is for (purpose).")
      if (total <= 0) found.push("Enter the amount.")
    } else {
      if (lines.some((l) => !l.description.trim())) found.push("Describe every item.")
      if (total <= 0) found.push("Give each item an amount.")
    }
    if (isException && !exceptionOn)
      found.push(rangeProblem || "Over the petty cash limit: tick exception and give the reason.")
    if (isException && exceptionOn && exceptionReason.trim().length < 10)
      found.push("Give the reason for the exception (at least 10 characters).")
    if (rangeProblem && !isException) found.push(rangeProblem)
    beneficiaries.forEach((b, i) => {
      const who = `Beneficiary ${i + 1}`
      if (b.method === "cash") {
        if (!b.account_name.trim()) found.push(`${who}: enter who receives the cash.`)
      } else if (b.account_number.length !== 10) found.push(`${who}: enter the 10-digit account number.`)
      else if (!b.bank_name.trim()) found.push(`${who}: pick the bank.`)
      else if (lookupKeys[i] && lookups[lookupKeys[i]!]?.status === "not_found") {
        found.push(`${who}: the account number is not valid for ${b.bank_name}.`)
      } else if (lookupKeys[i] && lookups[lookupKeys[i]!]?.status === "loading") {
        found.push(`${who}: still checking the account name with the bank. Try again in a moment.`)
      } else if (!b.account_name.trim()) found.push(`${who}: enter the account name.`)
    })
    if (showSplit && total > 0) {
      const split = lineItemsTotal(beneficiaries.map((b) => ({ amount: parseNaira(b.amount) })))
      if (Math.abs(split - total) > 0.001) found.push("The beneficiaries' amounts must add up to the total.")
    }
    if (uploading) found.push("Wait for the files to finish uploading.")
    if (signingMissing.length)
      found.push(`Set up your ${signingMissing.join(" and ")} first: use the button at the top of this form.`)
    return found
  }
  const problems = attempted ? collectProblems() : []

  // Submit is never greyed out: pressing it either says what is missing or opens the PIN dialog.
  const pressSubmit = () => {
    setAttempted(true)
    const found = collectProblems()
    if (found.length) return toast.error(found[0])
    setPinOpen(true)
  }

  const confirmSubmit = async (pin: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!formType) return { ok: false, error: "Pick a form first." }
    const beneficiaryPayload = beneficiaries.map((b) => ({
      payment_method: b.method,
      account_name: b.account_name,
      account_number: b.method === "cash" ? "" : b.account_number.replace(/\s/g, ""),
      bank_name: b.method === "cash" ? "" : b.bank_name,
      ...(b.bank_code && !b.other_bank && b.method === "transfer" ? { bank_code: b.bank_code } : {}),
      ...(b.purpose.trim() ? { purpose: b.purpose.trim() } : {}),
      ...(showSplit && b.amount ? { amount: parseNaira(b.amount) } : {}),
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
            line_items: lines.map((l) => ({ description: l.description, amount: parseNaira(l.amount) })),
            ...(isException && exceptionOn ? { exception_reason: exceptionReason.trim() } : {}),
            ...common,
          }
        : {
            form_type: formType,
            ...(listedProject ? { project_id: listedProject.id } : {}),
            project_name: resolvedProjectName,
            purpose: purpose.trim(),
            amount: parseNaira(amount),
            ...(isException && exceptionOn ? { exception_reason: exceptionReason.trim() } : {}),
            ...common,
          }

    setSubmitting(true)
    try {
      const finalBody = convertFrom && !editing ? { ...body, converted_from_id: convertFrom.id } : body
      const res = await apiFetch(editing ? `/api/requisitions/${editing.id}` : "/api/requisitions", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalBody),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) return { ok: false, error: json?.error || "Could not submit the requisition" }
      toast.success(json.message || "Submitted")
      setPinOpen(false)
      onOpenChange(false)
      onSuccess?.(json.data)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not submit the requisition" }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing && formType
              ? `Edit ${editing.requisition_number}`
              : convertFrom
                ? `Convert ${convertFrom.requisition_number}`
                : formType
                  ? `New ${FORM_LABELS[formType]}`
                  : "New requisition"}
          </DialogTitle>
          <DialogDescription>
            {formType
              ? "It goes to the first signer as soon as you submit."
              : "Which form do you need? The amount decides."}
          </DialogDescription>
        </DialogHeader>

        {signing ? (
          <SigningSetupNotice hasSignature={signing.has_signature} hasPin={signing.has_pin} returnPath={pathname} />
        ) : null}

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
                    onChange={(e) => setAmount(cleanAmountInput(e.target.value))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Items</Label>
                {lines.map((line, i) => (
                  <div
                    key={`row-${i}`}
                    className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_7rem_2rem] items-center gap-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_9rem_2rem]"
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
                      onChange={(e) => updateLine(i, "amount", cleanAmountInput(e.target.value))}
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
              {isException ? (
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={exceptionOn}
                      onChange={(e) => setExceptionOn(e.target.checked)}
                    />
                    <span>This is an exception: the amount is outside this form&rsquo;s usual range</span>
                  </label>
                  {exceptionOn ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="req-exception-reason">Reason for the exception</Label>
                      <Textarea
                        id="req-exception-reason"
                        rows={2}
                        value={exceptionReason}
                        onChange={(e) => setExceptionReason(e.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Beneficiary details</Label>
              {beneficiaries.map((b, i) => {
                const lookup = lookupKeys[i] ? lookups[lookupKeys[i]!] : undefined
                // Typed only when the bank cannot give it: a bank outside the list, or Paystack unreachable.
                const isCash = b.method === "cash"
                const nameEditable = isCash || b.other_bank || lookup?.status === "unavailable"
                return (
                  <div key={`row-${i}`} className="space-y-2 rounded-md border p-3">
                    <div
                      className="flex flex-wrap gap-2"
                      role="group"
                      aria-label={`Beneficiary ${i + 1} payment method`}
                    >
                      {(
                        [
                          ["transfer", "Bank transfer"],
                          ["cash", "Cash"],
                        ] as const
                      ).map(([method, label]) => (
                        <Button
                          key={method}
                          type="button"
                          size="sm"
                          variant={b.method === method ? "default" : "outline"}
                          aria-pressed={b.method === method}
                          onClick={() => updateBeneficiary(i, { method })}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                    {isCash ? null : (
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
                    )}
                    <div className="grid min-w-0 gap-2 *:min-w-0 sm:grid-cols-3">
                      {isCash ? null : (
                        <Input
                          aria-label={`Beneficiary ${i + 1} account number`}
                          placeholder="Account no (10 digits)"
                          inputMode="numeric"
                          maxLength={10}
                          value={b.account_number}
                          onChange={(e) => updateBeneficiary(i, { account_number: e.target.value.replace(/\D/g, "") })}
                        />
                      )}
                      {isCash ? null : b.other_bank ? (
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
                        placeholder={
                          isCash ? "Who receives the cash" : nameEditable ? "Account name" : "Filled in by the bank"
                        }
                        readOnly={!nameEditable}
                        tabIndex={nameEditable ? undefined : -1}
                        className={nameEditable ? undefined : "bg-muted/50 font-medium"}
                        value={b.account_name}
                        onChange={(e) => updateBeneficiary(i, { account_name: e.target.value, name_from_bank: false })}
                      />
                    </div>
                    {isCash ? null : (
                      <AccountCheck
                        nuban={nubanResults[i]}
                        lookup={lookup}
                        otherBank={b.other_bank}
                        onPickBank={(code) => pickBank(i, code)}
                      />
                    )}
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
                            onChange={(e) => updateBeneficiary(i, { amount: cleanAmountInput(e.target.value) })}
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

            <p className="text-muted-foreground text-xs">
              When you submit, you confirm with your approval PIN. Your signature goes on the form as &ldquo;Requested
              by&rdquo;.
            </p>
          </div>
        )}

        {formType ? (
          <>
            {problems.length ? (
              <div role="alert" className="border-danger/30 bg-danger/10 text-danger rounded-md border p-3 text-sm">
                <p className="font-medium">Before you can submit:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={pressSubmit} disabled={submitting}>
                {submitting || uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit
              </Button>
            </DialogFooter>
          </>
        ) : null}
        {formType ? (
          <RequisitionPinDialog
            open={pinOpen}
            onOpenChange={setPinOpen}
            title="Confirm with your PIN"
            description="Your signature goes on the form as Requested by."
            confirmLabel="Sign and submit"
            summary={[
              { label: "Form", value: FORM_LABELS[formType] },
              { label: "Amount", value: formatNaira(total) },
              ...(formType === "payment_request" && purpose.trim()
                ? [
                    {
                      label: "For",
                      value: purpose.trim().length > 70 ? `${purpose.trim().slice(0, 70)}…` : purpose.trim(),
                    },
                  ]
                : []),
              {
                label: beneficiaries.length > 1 ? "Paid to" : "Paid to",
                value: beneficiaries.map((b) => b.account_name || b.account_number).join(", "),
              },
            ]}
            onConfirm={confirmSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
