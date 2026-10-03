"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Loader2, AlertCircle } from "lucide-react"
import type { RequisitionFundingCategory } from "@/lib/requisitions/types"
import { FundingCategoryFieldsSchema, type FundingCategoryFields } from "@/lib/requisitions/schemas"

interface FundingCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Category being edited, or null to create a new one. */
  category: RequisitionFundingCategory | null
  onSave: (payload: { name: string; description: string; sort_order: number }) => Promise<void>
  isSaving: boolean
  error: string | null
}

export function FundingCategoryDialog({
  open,
  onOpenChange,
  category,
  onSave,
  isSaving,
  error,
}: FundingCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Funding Category" : "New Funding Category"}</DialogTitle>
          <DialogDescription className="text-xs">
            Funding lines requesters pick from when raising a requisition — e.g. Citibank, AfDB.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="border-danger/20 bg-danger-muted text-danger-foreground flex items-center gap-2 rounded-lg border p-3 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content unmounts when the dialog closes, so each opening starts from `category`. */}
        <FundingCategoryForm
          category={category}
          onSave={onSave}
          isSaving={isSaving}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function FundingCategoryForm({
  category,
  onSave,
  isSaving,
  onCancel,
}: {
  category: RequisitionFundingCategory | null
  onSave: FundingCategoryDialogProps["onSave"]
  isSaving: boolean
  onCancel: () => void
}) {
  const form = useForm<FundingCategoryFields>({
    resolver: zodResolver(FundingCategoryFieldsSchema),
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
      sort_order: category?.sort_order ?? 100,
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          onSave({ name: values.name, description: values.description ?? "", sort_order: values.sort_order })
        )}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. AfDB" className="text-xs" {...field} />
              </FormControl>
              {!category && (
                <FormDescription className="text-xs">
                  A short code is generated from the name and cannot be changed afterwards.
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Description (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="What this funding line covers" rows={2} className="text-xs" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sort_order"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Sort Order</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={9999}
                  className="text-xs"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                />
              </FormControl>
              <FormDescription className="text-xs">Lower numbers appear first in the requisition form.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : category ? (
              "Save Changes"
            ) : (
              "Create Category"
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
