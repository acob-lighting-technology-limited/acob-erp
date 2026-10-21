"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, type QueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Loader2 } from "lucide-react"
import { QUERY_KEYS } from "@/lib/query-keys"
import { toast } from "sonner"
import { apiJson } from "@/lib/api-client"
import { applyServerErrors } from "@/lib/forms/server-errors"
import { SupplierSchema, type SupplierInput } from "@/lib/purchasing/schemas"

export interface SupplierFormValues {
  id?: string
  name: string
  code: string
  email: string
  phone: string
  address: string
  contact_person: string
  is_active: boolean
}

interface SupplierFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  queryClient?: QueryClient
  supplier?: SupplierFormValues | null
}

const emptySupplier: SupplierInput = {
  name: "",
  code: "",
  email: "",
  phone: "",
  address: "",
  contact_person: "",
  is_active: true,
}

export function SupplierFormDialog({ open, onOpenChange, queryClient, supplier = null }: SupplierFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
        {/* Content unmounts when the dialog closes, so each opening starts from `supplier`. */}
        <SupplierForm supplier={supplier} queryClient={queryClient} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function SupplierForm({
  supplier,
  queryClient,
  onDone,
}: {
  supplier: SupplierFormValues | null
  queryClient?: QueryClient
  onDone: () => void
}) {
  const router = useRouter()
  const isEdit = Boolean(supplier?.id)
  const form = useForm<SupplierInput>({
    resolver: zodResolver(SupplierSchema),
    defaultValues: supplier
      ? {
          name: supplier.name,
          code: supplier.code,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          contact_person: supplier.contact_person,
          is_active: supplier.is_active,
        }
      : emptySupplier,
  })

  const save = useMutation({
    mutationFn: (values: SupplierInput) => {
      // Optional text the user left empty is stored as null, not "".
      const payload = {
        ...values,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address || null,
        contact_person: values.contact_person || null,
      }
      return apiJson(isEdit ? `/api/admin/purchasing/suppliers/${supplier!.id}` : "/api/admin/purchasing/suppliers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async () => {
      toast.success(isEdit ? "Supplier updated" : "Supplier created")
      if (isEdit) await queryClient?.invalidateQueries({ queryKey: QUERY_KEYS.adminSupplierDetail(supplier!.id!) })
      await queryClient?.invalidateQueries({ queryKey: QUERY_KEYS.adminSuppliers() })
      onDone()
      router.refresh()
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, Object.keys(form.getValues()))
      if (message) toast.error(message)
    },
  })

  const textField = (name: "name" | "code" | "email" | "phone" | "contact_person", label: string, type?: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={name === "code" ? "e.g., SUP-001" : undefined}
              {...field}
              value={field.value ?? ""}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add"} Supplier</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("name", "Name *")}
            {textField("code", "Code *")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("email", "Email", "email")}
            {textField("phone", "Phone")}
          </div>
          {textField("contact_person", "Contact Person")}
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel>Active</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
