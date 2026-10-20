"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { apiJson } from "@/lib/api-client"
import { applyServerErrors } from "@/lib/forms/server-errors"
import { PortfolioFieldsSchema, type PortfolioFields } from "@/lib/projects/schemas"
import type { Portfolio } from "./portfolios-content"

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "closed", label: "Closed" },
]

export function PortfolioDialog({
  open,
  onOpenChange,
  portfolio,
  onSuccess,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolio: Portfolio | null
  onSuccess: () => void
  /** Shown only when editing; hands off to the delete confirmation. */
  onDelete?: (portfolio: Portfolio) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>{portfolio ? "Edit Portfolio" : "Add Portfolio"}</DialogTitle>
          <DialogDescription>
            A portfolio groups related projects under one programme, client, or funding arrangement.
          </DialogDescription>
        </DialogHeader>
        {/* Content unmounts when the dialog closes, so each opening starts from `portfolio`. */}
        <PortfolioForm
          portfolio={portfolio}
          onSuccess={onSuccess}
          onDelete={onDelete}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function PortfolioForm({
  portfolio,
  onSuccess,
  onDelete,
  onCancel,
}: {
  portfolio: Portfolio | null
  onSuccess: () => void
  onDelete?: (portfolio: Portfolio) => void
  onCancel: () => void
}) {
  const form = useForm<PortfolioFields>({
    resolver: zodResolver(PortfolioFieldsSchema),
    defaultValues: {
      name: portfolio?.name ?? "",
      code: portfolio?.code ?? "",
      description: portfolio?.description ?? "",
      status: portfolio?.status ?? "active",
    },
  })

  const save = useMutation({
    mutationFn: (values: PortfolioFields) =>
      apiJson(portfolio ? `/api/portfolios/${portfolio.id}` : "/api/portfolios", {
        method: portfolio ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          code: values.code || null,
          description: values.description || null,
          status: values.status,
        }),
      }),
    onSuccess,
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, Object.keys(form.getValues()))
      if (message) toast.error(message)
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-4 py-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Portfolio Name *</FormLabel>
              <FormControl>
                <Input placeholder="Minimum Subsidy Tender" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Short Code</FormLabel>
              <FormControl>
                <Input placeholder="MST" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormDescription className="text-xs">
                Shown on project rows where the full name would not fit.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Description</FormLabel>
              <FormControl>
                <Textarea className="min-h-17.5 text-sm" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Status</FormLabel>
              <SearchableSelect
                value={field.value}
                onValueChange={(value) => field.onChange(value as PortfolioFields["status"])}
                options={STATUS_OPTIONS}
                placeholder="Select status"
                searchPlaceholder="Search status..."
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="gap-2">
          {portfolio && onDelete && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive sm:mr-auto"
              onClick={() => onDelete(portfolio)}
              disabled={save.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {portfolio ? "Save Changes" : "Create Portfolio"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
