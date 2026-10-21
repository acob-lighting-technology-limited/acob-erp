"use client"

import { useFieldArray, type Control, type UseFormWatch } from "react-hook-form"
import { FileText, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  SITE_DOCUMENT_STATUSES,
  SITE_DOCUMENT_STATUS_LABELS,
  SITE_DOCUMENT_TYPES,
  SITE_DOCUMENT_TYPE_LABELS,
  type SiteDocumentType,
} from "@/lib/sites/conveyance"
import type { SiteFields } from "@/lib/sites/schemas"

const TYPE_OPTIONS = SITE_DOCUMENT_TYPES.map((value) => ({ value, label: SITE_DOCUMENT_TYPE_LABELS[value] }))
const STATUS_OPTIONS = SITE_DOCUMENT_STATUSES.map((value) => ({ value, label: SITE_DOCUMENT_STATUS_LABELS[value] }))

/** The four documents most sites carry, offered as one-click additions. */
const STANDARD_TYPES: SiteDocumentType[] = ["exclusivity", "mou", "nerc", "nemsa"]

type SiteControl = Control<SiteFields>

/** The site form's conveyance documents: one row per document, added and removed in place. */
export function SiteDocumentFields({ control, watch }: { control: SiteControl; watch: UseFormWatch<SiteFields> }) {
  const { fields, append, remove } = useFieldArray({ control, name: "documents", keyName: "fieldKey" })
  const documents = watch("documents") ?? []
  const missingStandard = STANDARD_TYPES.filter((type) => !documents.some((doc) => doc.document_type === type))

  const addDocument = (document_type: SiteDocumentType) =>
    append({ document_type, label: "", status: "pending", reference: "", issued_on: "", expires_on: "", notes: "" })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <FileText className="text-primary h-3.5 w-3.5" />
          Conveyance documents
        </p>
        <div className="flex flex-wrap gap-1.5">
          {missingStandard.map((type) => (
            <Button key={type} type="button" variant="outline" size="sm" onClick={() => addDocument(type)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {SITE_DOCUMENT_TYPE_LABELS[type]}
            </Button>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => addDocument("other")}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Other
          </Button>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed py-4 text-center text-xs">
          No documents yet. Add the ones this site has, or is waiting on.
        </p>
      ) : (
        <ul className="space-y-3">
          {fields.map((field, index) => {
            const isOther = documents[index]?.document_type === "other"
            const isObtained = documents[index]?.status === "obtained"
            return (
              <li key={field.fieldKey} className="bg-muted/30 space-y-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-3 sm:grid-cols-2">
                    <FormField
                      control={control}
                      name={`documents.${index}.document_type`}
                      render={({ field: typeField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Document</FormLabel>
                          <SearchableSelect
                            value={typeField.value}
                            onValueChange={(value) => typeField.onChange(value as SiteDocumentType)}
                            options={TYPE_OPTIONS}
                            placeholder="Select document"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`documents.${index}.status`}
                      render={({ field: statusField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Status</FormLabel>
                          <SearchableSelect
                            value={statusField.value}
                            onValueChange={statusField.onChange}
                            options={STATUS_OPTIONS}
                            placeholder="Select status"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive mt-5 shrink-0"
                        aria-label="Remove document"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove document</TooltipContent>
                  </Tooltip>
                </div>

                {isOther && (
                  <FormField
                    control={control}
                    name={`documents.${index}.label`}
                    render={({ field: labelField }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Document name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Land agreement" {...labelField} value={labelField.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {isObtained && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField
                      control={control}
                      name={`documents.${index}.reference`}
                      render={({ field: refField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Reference no.</FormLabel>
                          <FormControl>
                            <Input {...refField} value={refField.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`documents.${index}.issued_on`}
                      render={({ field: issuedField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Issued</FormLabel>
                          <FormControl>
                            <Input type="date" {...issuedField} value={issuedField.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`documents.${index}.expires_on`}
                      render={({ field: expiresField }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Expires</FormLabel>
                          <FormControl>
                            <Input type="date" {...expiresField} value={expiresField.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
