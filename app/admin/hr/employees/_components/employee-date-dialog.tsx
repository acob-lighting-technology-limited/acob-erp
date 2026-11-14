"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { apiFetch } from "@/lib/api-client"
import { employeeDateEditSchema, type EmployeeDateField } from "@/lib/hr/employee-date-edit"
import { QUERY_KEYS } from "@/lib/query-keys"
import type { Employee } from "./employee-types"

export function EmployeeDateDialog({
  employee,
  field,
  label,
  close,
}: {
  employee: Employee
  field: EmployeeDateField
  label: string
  close: () => void
}) {
  const queryClient = useQueryClient()
  const birthday = field === "birthday"
  const form = useForm<z.infer<typeof employeeDateEditSchema>>({
    resolver: zodResolver(employeeDateEditSchema),
    defaultValues: { field, value: employee[field]?.split("T")[0] ?? "" },
  })
  const saving = form.formState.isSubmitting

  const save = form.handleSubmit(async (values) => {
    try {
      const response = await apiFetch(`/api/admin/hr/employees/${employee.id}/dates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error("Could not save this date. Check your access and try again.")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminEmployees() }),
        ...(birthday ? [queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminHrBirthdaysAll() })] : []),
      ])
      toast.success(`${label} saved`)
      close()
    } catch (error) {
      form.setError("value", { message: error instanceof Error ? error.message : "Could not save this date" })
    }
  })

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !saving) close()
      }}
      title={`Edit ${label.toLowerCase()}`}
      description={`${employee.first_name} ${employee.last_name}`}
      desktopClassName="sm:max-w-md"
    >
      <Form {...form}>
        <form className="space-y-4" onSubmit={save} noValidate>
          <FormField
            control={form.control}
            name="value"
            render={({ field: input }) => (
              <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                  <Input
                    {...input}
                    type={birthday ? "text" : "date"}
                    placeholder={birthday ? "MM-DD" : undefined}
                    maxLength={birthday ? 5 : undefined}
                    disabled={saving}
                  />
                </FormControl>
                <FormDescription>
                  {birthday
                    ? "Use month and day, for example 06-16. Leave blank to clear."
                    : "Leave blank to clear the recorded date."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.formState.isDirty}>
              {saving ? "Saving…" : "Save date"}
            </Button>
          </div>
        </form>
      </Form>
    </ResponsiveModal>
  )
}
