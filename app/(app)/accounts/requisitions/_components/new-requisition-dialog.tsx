"use client"

import { useState } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { numberToNairaWords } from "@/lib/requisitions/number-to-words"
import type { RequisitionAttachment } from "@/lib/requisitions/types"
import { EMERGENCY_JUSTIFICATION_MIN_LENGTH } from "@/lib/requisitions/workflow"
import { RequisitionFormSchema, type RequisitionFormValues } from "@/lib/requisitions/schemas"
import { Plus, Trash2, Upload, FileText, Loader2, AlertCircle, Siren } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { apiJson } from "@/lib/api-client"
import { applyServerErrors } from "@/lib/forms/server-errors"
import { useFundingCategories } from "@/hooks/use-requisitions"

const emptyBeneficiary = () => ({ account_name: "", account_number: "", bank_name: "" })

interface NewRequisitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userDepartment?: string | null
  onSuccess?: () => void
}

export function NewRequisitionDialog({ open, onOpenChange, userDepartment, onSuccess }: NewRequisitionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">New Payment Request Form</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Fill out the digital requisition details. Supporting receipt / invoice attachment is mandatory.
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts when the dialog closes, so each opening starts a blank request. */}
        <NewRequisitionForm
          userDepartment={userDepartment}
          onCancel={() => onOpenChange(false)}
          onSubmitted={() => {
            onOpenChange(false)
            onSuccess?.()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function NewRequisitionForm({
  userDepartment,
  onCancel,
  onSubmitted,
}: {
  userDepartment?: string | null
  onCancel: () => void
  onSubmitted: () => void
}) {
  // The requester's own department, resolved by the parent; read at submit time.
  const department = userDepartment || ""
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fundingQuery = useFundingCategories({ enabled: true })
  const fundingCategories = fundingQuery.data ?? []
  const fundingLoadError = fundingQuery.error?.message ?? null

  const form = useForm<RequisitionFormValues>({
    resolver: zodResolver(RequisitionFormSchema),
    defaultValues: {
      project_name: "",
      amount: Number.NaN,
      amount_in_words: "",
      purpose: "",
      beneficiary_details: [emptyBeneficiary()],
      attachments: [],
      funding_category_id: "",
      is_emergency: false,
      emergency_justification: "",
    },
  })
  const beneficiaries = useFieldArray({ control: form.control, name: "beneficiary_details" })
  const isEmergency = useWatch({ control: form.control, name: "is_emergency" })
  const attachments = useWatch({ control: form.control, name: "attachments" }) ?? []

  const submit = useMutation({
    mutationFn: (values: RequisitionFormValues) =>
      apiJson("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          department,
          amount_in_words: values.amount_in_words || numberToNairaWords(values.amount),
          emergency_justification: values.is_emergency ? values.emergency_justification?.trim() : undefined,
        }),
      }),
    onSuccess: onSubmitted,
    onError: (error) => {
      setErrorMsg(applyServerErrors(error, form.setError, Object.keys(form.getValues())))
    },
  })

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      const uploaded: RequisitionAttachment[] = []
      for (const file of Array.from(files)) {
        const filePath = `receipts/${crypto.randomUUID()}.${file.name.split(".").pop()}`
        const { error } = await supabase.storage
          .from("requisition_documents")
          .upload(filePath, file, { cacheControl: "3600", upsert: false })
        if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`)
        const {
          data: { publicUrl },
        } = supabase.storage.from("requisition_documents").getPublicUrl(filePath)
        uploaded.push({ file_name: file.name, file_url: publicUrl, file_type: file.type, file_size: file.size })
      }
      form.setValue("attachments", [...(form.getValues("attachments") ?? []), ...uploaded])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload file(s)")
    } finally {
      setIsUploading(false)
    }
  }

  const removeAttachment = (index: number) =>
    form.setValue(
      "attachments",
      (form.getValues("attachments") ?? []).filter((_, i) => i !== index)
    )

  const banner = errorMsg ?? fundingLoadError

  return (
    <Form {...form}>
      {banner && (
        <div className="border-danger/20 bg-danger-muted text-danger-foreground flex items-center gap-2 rounded-lg border p-3 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      <form
        onSubmit={form.handleSubmit((values) => {
          setErrorMsg(null)
          submit.mutate(values)
        })}
        className="space-y-4 text-xs"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-semibold">Department</Label>
            <Input
              value={department}
              readOnly
              disabled
              placeholder={userDepartment === null ? "Loading…" : "No department set on your profile"}
              className="bg-muted mt-1 cursor-not-allowed text-xs"
            />
          </div>

          <FormField
            control={form.control}
            name="project_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Project / Cost Center</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Solar Maintenance Phase 1" className="text-xs" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="funding_category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Project Funding Category</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select funding source (e.g. Citibank, AfDB)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {fundingCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-xs">
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription className="text-xs">Which funding line this payment is drawn against.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Amount (₦)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 150000"
                    className="text-xs"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(event) => {
                      const value = event.target.valueAsNumber
                      field.onChange(value)
                      // Typing a new amount rewrites the words; the words stay editable.
                      form.setValue(
                        "amount_in_words",
                        !Number.isNaN(value) && value > 0 ? numberToNairaWords(value) : ""
                      )
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount_in_words"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Amount in Words</FormLabel>
                <FormControl>
                  <Input placeholder="One Hundred and Fifty Thousand Naira Only" className="text-xs" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="purpose"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Purpose / Justification</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the detailed purpose for this payment request..."
                  rows={3}
                  className="text-xs"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Emergency (expedited) route */}
        <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <FormField
            control={form.control}
            name="is_emergency"
            render={({ field }) => (
              <FormItem className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-danger-foreground flex items-center gap-1.5 text-xs font-bold">
                    <Siren className="h-3.5 w-3.5" /> Emergency Requisition
                  </FormLabel>
                  <FormDescription className="text-xs">
                    For urgent site needs only. Skips Admin &amp; HR review, Corporate Services authorization and
                    Accounts verification — it goes straight to the MD / Executive Management for a single decision.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      if (!checked) form.setValue("emergency_justification", "")
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {isEmergency && (
            <FormField
              control={form.control}
              name="emergency_justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Why is this an emergency? (required)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Generator failure at the Kaduna site is holding installation — fuel and spares needed today."
                      rows={2}
                      className="text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Minimum {EMERGENCY_JUSTIFICATION_MIN_LENGTH} characters. This is recorded on the form and shown to
                    the approver.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Beneficiary Details Dynamic Table */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              Beneficiary Details
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => beneficiaries.append(emptyBeneficiary())}
              className="h-7 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </Button>
          </div>

          {beneficiaries.fields.map((row, idx) => (
            <div
              key={row.id}
              className="bg-muted/30 relative grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-3"
            >
              {(["account_name", "account_number", "bank_name"] as const).map((key, col) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`beneficiary_details.${idx}.${key}`}
                  render={({ field }) => (
                    <FormItem className={col === 2 ? "flex flex-wrap items-center gap-2 space-y-0" : undefined}>
                      <FormControl>
                        <Input
                          placeholder={
                            key === "account_name"
                              ? "Account Name"
                              : key === "account_number"
                                ? "Account Number"
                                : "Bank Name"
                          }
                          className={col === 2 ? "h-8 min-w-0 flex-1 text-xs" : "h-8 text-xs"}
                          {...field}
                        />
                      </FormControl>
                      {col === 2 && beneficiaries.fields.length > 1 && (
                        <Button
                          aria-label="Remove beneficiary"
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => beneficiaries.remove(idx)}
                          className="text-danger-foreground h-8 w-8 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <FormMessage className="w-full" />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          ))}
          {form.formState.errors.beneficiary_details?.root?.message && (
            <p className="text-danger-foreground text-xs">{form.formState.errors.beneficiary_details.root.message}</p>
          )}
        </div>

        {/* Supporting Document Attachment (optional) */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-emerald-400">
              Attach Supporting Receipts / Documents (Optional)
            </Label>
            <span className="text-muted-foreground text-xs">PDF, PNG, JPG up to 10MB</span>
          </div>

          <div className="hover:bg-muted/30 relative rounded-lg border-2 border-dashed p-4 text-center transition">
            <input
              type="file"
              multiple
              accept="application/pdf,image/*"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div className="pointer-events-none flex flex-col items-center justify-center gap-1.5">
              {isUploading ? (
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
              ) : (
                <Upload className="text-muted-foreground h-6 w-6" />
              )}
              <span className="text-xs font-medium">
                {isUploading ? "Uploading files..." : "Click or drag receipts & invoices here"}
              </span>
            </div>
          </div>

          {attachments.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {attachments.map((att, i) => (
                <div
                  key={att.file_url}
                  className="bg-card flex items-center justify-between rounded border p-2 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate font-medium">{att.file_name}</span>
                  </div>
                  <Button
                    aria-label="Remove attachment"
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttachment(i)}
                    className="text-danger-foreground h-6 w-6"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submit.isPending || isUploading}>
            {submit.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Requisition"
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
