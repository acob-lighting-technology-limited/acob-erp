"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { apiJson } from "@/lib/api-client"
import { applyServerErrors } from "@/lib/forms/server-errors"
import { SiteFieldsSchema, type SiteFields } from "@/lib/sites/schemas"
import { NIGERIA_STATES } from "@/lib/sites/nigeria-states"
import type { SiteRecord } from "@/lib/sites/records"
import { fetchProjectRecords, PROJECTS_QUERY_KEY } from "@/lib/projects/records"
import { usePortfolios } from "@/hooks/use-portfolios"
import { SiteDocumentFields } from "./site-document-fields"

const NONE = "__none__"
const STATE_OPTIONS = NIGERIA_STATES.map((state) => ({ value: state, label: state }))

export function SiteDialog({
  open,
  onOpenChange,
  site,
  defaultPortfolioId,
  onSuccess,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: SiteRecord | null
  /** Preselects the portfolio when a site is added from inside one. */
  defaultPortfolioId?: string | null
  onSuccess: (site: SiteRecord) => void
  /** Shown only when editing; hands off to the delete confirmation. */
  onDelete?: (site: SiteRecord) => void
}) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={site ? "Edit Site" : "Add Site"}
      description="A signed or profiled site, and the state of its conveyance documents."
    >
      {/* Content unmounts when the modal closes, so each opening starts from `site`. */}
      {open && (
        <SiteForm
          site={site}
          defaultPortfolioId={defaultPortfolioId ?? null}
          onSuccess={onSuccess}
          onDelete={onDelete}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </ResponsiveModal>
  )
}

function SiteForm({
  site,
  defaultPortfolioId,
  onSuccess,
  onDelete,
  onCancel,
}: {
  site: SiteRecord | null
  defaultPortfolioId: string | null
  onSuccess: (site: SiteRecord) => void
  onDelete?: (site: SiteRecord) => void
  onCancel: () => void
}) {
  const form = useForm<SiteFields>({
    resolver: zodResolver(SiteFieldsSchema),
    defaultValues: {
      name: site?.name ?? "",
      lga: site?.lga ?? "",
      state: site?.state ?? "",
      date_signed: site?.date_signed ?? "",
      portfolio_id: site?.portfolio_id ?? defaultPortfolioId ?? "",
      project_id: site?.project_id ?? "",
      notes: site?.notes ?? "",
      documents: (site?.documents ?? []).map((doc) => ({
        id: doc.id,
        document_type: doc.document_type,
        label: doc.label ?? "",
        status: doc.status,
        reference: doc.reference ?? "",
        issued_on: doc.issued_on ?? "",
        expires_on: doc.expires_on ?? "",
        notes: doc.notes ?? "",
      })),
    },
  })

  const { data: portfolios } = usePortfolios()
  const { data: projects } = useQuery({ queryKey: PROJECTS_QUERY_KEY, queryFn: fetchProjectRecords })

  const portfolioId = form.watch("portfolio_id")
  const portfolioOptions = useMemo(
    () => [
      { value: NONE, label: "No portfolio" },
      ...(portfolios?.data ?? []).map((p) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name })),
    ],
    [portfolios]
  )
  // A site's project normally sits in the site's portfolio, so that list comes
  // first — but any project stays pickable for sites filed before the portfolio was.
  const projectOptions = useMemo(() => {
    const list = [...(projects ?? [])].sort((a, b) => {
      const aIn = a.portfolio_id === portfolioId ? 0 : 1
      const bIn = b.portfolio_id === portfolioId ? 0 : 1
      return aIn - bIn || a.project_name.localeCompare(b.project_name)
    })
    return [{ value: NONE, label: "No project yet" }, ...list.map((p) => ({ value: p.id, label: p.project_name }))]
  }, [projects, portfolioId])

  const save = useMutation({
    mutationFn: (values: SiteFields) =>
      apiJson<{ data: SiteRecord }>(site ? `/api/sites/${site.id}` : "/api/sites", {
        method: site ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: (payload) => onSuccess(payload.data),
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
              <FormLabel className="text-xs font-semibold">Site *</FormLabel>
              <FormControl>
                <Input placeholder="Ogufa" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="lga"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">LGA</FormLabel>
                <FormControl>
                  <Input placeholder="Nasarawa" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">State</FormLabel>
                <SearchableSelect
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  options={STATE_OPTIONS}
                  placeholder="Select state"
                  searchPlaceholder="Search states..."
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="date_signed"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Date signed</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="portfolio_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Portfolio</FormLabel>
                <SearchableSelect
                  value={field.value || NONE}
                  onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
                  options={portfolioOptions}
                  placeholder="Select portfolio"
                  searchPlaceholder="Search portfolios..."
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="project_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Project</FormLabel>
                <SearchableSelect
                  value={field.value || NONE}
                  onValueChange={(value) => field.onChange(value === NONE ? "" : value)}
                  options={projectOptions}
                  placeholder="Select project"
                  searchPlaceholder="Search projects..."
                />
                <FormDescription className="text-xs">Link it once construction starts.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <SiteDocumentFields control={form.control} watch={form.watch} />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Notes / comments</FormLabel>
              <FormControl>
                <Textarea className="min-h-17.5 text-sm" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="gap-2">
          {site && onDelete && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive sm:mr-auto"
              onClick={() => onDelete(site)}
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
            {site ? "Save Changes" : "Add Site"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
