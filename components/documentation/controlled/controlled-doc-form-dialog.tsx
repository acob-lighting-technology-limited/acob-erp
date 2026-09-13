"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api-client"
import { toLocalISODate } from "@/lib/utils/date"
import { CANONICAL_DEPARTMENT_ORDER } from "@/shared/departments"
import {
  CONTROLLED_DOC_ACCEPT,
  CONTROLLED_DOC_MAX_FILE_BYTES,
  CONTROLLED_DOC_META,
  isAllowedControlledDocFile,
  type ControlledDocRow,
  type ControlledDocType,
} from "@/lib/documentation/controlled"

const NO_OWNER = "__none__"

interface ControlledDocFormDialogProps {
  type: ControlledDocType
  /** Omit to create; pass a document to edit its details. */
  doc?: ControlledDocRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Departments the caller may own/target SOPs for. `null` = any. */
  manageableDepartments: string[] | null
  onSaved: () => void
}

export function ControlledDocFormDialog({
  type,
  doc,
  open,
  onOpenChange,
  manageableDepartments,
  onSaved,
}: ControlledDocFormDialogProps) {
  const meta = CONTROLLED_DOC_META[type]
  const isEdit = Boolean(doc)
  const isSop = type === "sop"

  const departmentOptions = useMemo(() => {
    const names = manageableDepartments ?? [...CANONICAL_DEPARTMENT_ORDER]
    return names.map((name) => ({ value: name, label: name }))
  }, [manageableDepartments])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [ownerDepartment, setOwnerDepartment] = useState("")
  const [isCompanyWide, setIsCompanyWide] = useState(true)
  const [departments, setDepartments] = useState<string[]>([])
  const [nextReviewDate, setNextReviewDate] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(toLocalISODate(new Date()))
  const [changeSummary, setChangeSummary] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [publish, setPublish] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(doc?.title ?? "")
    setDescription(doc?.description ?? "")
    setCategory(doc?.category ?? "")
    setOwnerDepartment(doc?.owner_department ?? (manageableDepartments?.length === 1 ? manageableDepartments[0] : ""))
    setIsCompanyWide(doc ? doc.is_company_wide : manageableDepartments === null)
    setDepartments(doc?.departments ?? (manageableDepartments?.length === 1 ? [manageableDepartments[0]] : []))
    setNextReviewDate(doc?.next_review_date ?? "")
    setEffectiveDate(toLocalISODate(new Date()))
    setChangeSummary("")
    setFile(null)
    setPublish(false)
  }, [open, doc, manageableDepartments])

  function validate(): string | null {
    if (!title.trim()) return "Title is required"
    if (isSop && !ownerDepartment) return "Choose the department that owns this SOP"
    if (isSop && !isCompanyWide && departments.length === 0) return "Select at least one department"
    if (!isEdit) {
      if (!file) return "Attach the document file"
      if (!isAllowedControlledDocFile(file.name)) return "Upload a PDF, Word, Excel, or PowerPoint file"
      if (file.size > CONTROLLED_DOC_MAX_FILE_BYTES) return "File is larger than 4 MB — compress it and try again"
      if (!effectiveDate) return "Effective date is required"
    }
    return null
  }

  async function handleSubmit() {
    const problem = validate()
    if (problem) {
      toast.error(problem)
      return
    }

    setIsSaving(true)
    try {
      let res: Response
      if (isEdit && doc) {
        res = await apiFetch(`/api/documentation/controlled/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            next_review_date: nextReviewDate || null,
            owner_department: ownerDepartment || null,
            ...(isSop ? { is_company_wide: isCompanyWide, departments: isCompanyWide ? [] : departments } : {}),
          }),
        })
      } else {
        const body = new FormData()
        body.set("type", type)
        body.set("title", title.trim())
        body.set("description", description.trim())
        body.set("category", category.trim())
        body.set("owner_department", ownerDepartment)
        body.set("is_company_wide", String(isSop ? isCompanyWide : true))
        body.set("departments", JSON.stringify(isSop && !isCompanyWide ? departments : []))
        body.set("next_review_date", nextReviewDate)
        body.set("effective_date", effectiveDate)
        body.set("change_summary", changeSummary.trim())
        body.set("publish", String(publish))
        if (file) body.set("file", file)
        res = await apiFetch("/api/documentation/controlled", { method: "POST", body })
      }

      const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(payload.error || "Failed to save")

      toast.success(payload.message || (isEdit ? "Details updated" : `${meta.label} created`))
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${meta.label} Details` : `Add ${meta.label}`}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "To change the document itself, upload a new version instead."
              : `The file is stored in SharePoint under ${meta.sharePointFolder}. A reference code is assigned automatically.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cd-title">Title *</Label>
            <Input
              id="cd-title"
              value={title}
              maxLength={300}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isSop ? "e.g. Processing a vendor payment" : "e.g. Leave Policy"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cd-description">Summary</Label>
            <Textarea
              id="cd-description"
              value={description}
              maxLength={2000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this covers and who it applies to"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cd-category">Category</Label>
              <Input
                id="cd-category"
                value={category}
                maxLength={120}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={isSop ? "e.g. Finance" : "e.g. HR, IT, Health & Safety"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{isSop ? "Owner department *" : "Owner department"}</Label>
              <Select
                value={ownerDepartment || NO_OWNER}
                onValueChange={(value) => setOwnerDepartment(value === NO_OWNER ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {!isSop && <SelectItem value={NO_OWNER}>Not set</SelectItem>}
                  {departmentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isSop && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="cd-company-wide">Company-wide</Label>
                  <p className="text-muted-foreground text-xs">
                    Off: only staff in the selected departments can see this SOP.
                  </p>
                </div>
                <Switch id="cd-company-wide" checked={isCompanyWide} onCheckedChange={setIsCompanyWide} />
              </div>
              {!isCompanyWide && (
                <SearchableMultiSelect
                  label="Departments"
                  values={departments}
                  options={departmentOptions}
                  onChange={setDepartments}
                  placeholder="Select departments"
                  searchPlaceholder="Search departments..."
                />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cd-review">Next review date</Label>
            <Input
              id="cd-review"
              type="date"
              value={nextReviewDate}
              onChange={(e) => setNextReviewDate(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">Flagged as due 30 days before this date.</p>
          </div>

          {!isEdit && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cd-file">Document file *</Label>
                  <Input
                    id="cd-file"
                    type="file"
                    accept={CONTROLLED_DOC_ACCEPT}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-muted-foreground text-xs">PDF, Word, Excel or PowerPoint · max 4 MB</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cd-effective">Effective date *</Label>
                  <Input
                    id="cd-effective"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cd-change">Version note</Label>
                <Input
                  id="cd-change"
                  value={changeSummary}
                  maxLength={500}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Initial version"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <Label htmlFor="cd-publish">Publish now</Label>
                  <p className="text-muted-foreground text-xs">
                    {type === "policy"
                      ? "Notifies all staff and asks them to acknowledge. Leave off to save a draft."
                      : "Notifies the SOP's audience. Leave off to save a draft."}
                  </p>
                </div>
                <Switch id="cd-publish" checked={publish} onCheckedChange={setPublish} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : publish ? "Upload & Publish" : "Save Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
