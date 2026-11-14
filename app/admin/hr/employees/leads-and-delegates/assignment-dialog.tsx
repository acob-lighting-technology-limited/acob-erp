"use client"

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ResponsiveModal } from "@/components/ui/patterns/responsive-modal"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { CONSOLE_PAGE_KEYS, DEPT_DELEGABLE_PAGES } from "@/lib/dept/delegated-pages"
import { DEPT_APPROVALS } from "@/lib/dept/approval-permissions"
import { delegationFields } from "@/lib/dept/admin-delegations"
import { toLocalDateTimeInput } from "@/lib/utils/date"
import { formatFullName } from "@/lib/utils"
import { isSameDepartment } from "@/shared/departments"
import type { Editor, LeadDirectory } from "./types"

const formSchema = z.object({
  departmentId: z.string().uuid("Choose a department"),
  userId: z.string().uuid("Choose an employee"),
  pages: z.array(z.string()),
  end: z.string(),
})

export function AssignmentDialog({
  editor,
  directory,
  close,
  save,
}: {
  editor: Editor
  directory: LeadDirectory
  close: () => void
  save: (path: "leads" | "delegations", method: "POST" | "PATCH", data: Record<string, unknown>) => Promise<void>
}) {
  const editing = editor.type === "delegate" ? editor.delegation : undefined
  const lead = editor.type === "lead"
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      departmentId: editor.type === "lead" ? editor.department.id : (editing?.department_id ?? ""),
      userId: editor.type === "lead" ? (editor.department.lead_id ?? "") : (editing?.delegate_id ?? ""),
      pages: editing?.pages ?? [],
      end: editing ? toLocalDateTimeInput(new Date(editing.valid_until)) : "",
    },
  })
  const departmentId = useWatch({ control: form.control, name: "departmentId" })
  const department = directory.departments.find((item) => item.id === departmentId)
  const candidates = directory.candidates.filter(
    (item) =>
      lead || (department && item.id !== department.lead_id && isSameDepartment(item.department, department.name))
  )
  const busy = form.formState.isSubmitting
  const submit = form.handleSubmit(async (values) => {
    try {
      if (lead) {
        await save("leads", "POST", { departmentId: values.departmentId, userId: values.userId })
      } else {
        const parsed = delegationFields.safeParse({
          departmentId: values.departmentId,
          delegateId: values.userId,
          pages: values.pages,
          validUntil: `${values.end}:00+01:00`,
        })
        if (!parsed.success) {
          form.setError("root", { message: "Choose at least one page and enter an end date and time." })
          return
        }
        await save(
          "delegations",
          editing ? "PATCH" : "POST",
          editing ? { ...parsed.data, id: editing.id } : parsed.data
        )
      }
      close()
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "Could not save assignment" })
    }
  })

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !busy) close()
      }}
      title={lead ? "Assign department lead" : editing ? "Edit delegation" : "Add delegate"}
      description={department?.name}
      desktopClassName="sm:max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        {!lead && !editing && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Department</p>
            <Controller
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value)
                    form.setValue("userId", "")
                  }}
                  options={directory.departments
                    .filter((item) => item.lead_id)
                    .map((item) => ({ value: item.id, label: item.name }))}
                  placeholder="Choose a department"
                />
              )}
            />
            {form.formState.errors.departmentId && (
              <p className="text-destructive text-sm">{form.formState.errors.departmentId.message}</p>
            )}
          </div>
        )}
        {!editing && (
          <div className="space-y-1">
            <p className="text-sm font-medium">{lead ? "Lead" : "Delegate"}</p>
            <Controller
              control={form.control}
              name="userId"
              render={({ field }) => (
                <SearchableSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  options={candidates.map((item) => ({
                    value: item.id,
                    label: [formatFullName(item.first_name, item.last_name), lead ? item.department : null]
                      .filter(Boolean)
                      .join(" · "),
                  }))}
                  placeholder="Choose an employee"
                />
              )}
            />
            {form.formState.errors.userId && (
              <p className="text-destructive text-sm">{form.formState.errors.userId.message}</p>
            )}
          </div>
        )}
        {!lead && (
          <>
            {editing && <p className="text-sm font-medium">{editing.delegate}</p>}
            <label className="block space-y-1 text-sm font-medium">
              <span>Ends at (WAT)</span>
              <Input type="datetime-local" required {...form.register("end")} />
            </label>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Department console access</legend>
              <Controller
                control={form.control}
                name="pages"
                render={({ field }) => (
                  <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                    <label className="col-span-full flex items-center gap-2 border-b pb-3 text-sm font-medium">
                      <Checkbox
                        checked={
                          CONSOLE_PAGE_KEYS.every((key) => field.value.includes(key))
                            ? true
                            : CONSOLE_PAGE_KEYS.some((key) => field.value.includes(key))
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true ? [...new Set([...field.value, ...CONSOLE_PAGE_KEYS])] : [])
                        }
                      />
                      Select all
                    </label>
                    {DEPT_DELEGABLE_PAGES.map((page) => (
                      <label key={page.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value.includes(page.key)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked === true
                                ? [...field.value, page.key]
                                : field.value.filter((key) => key !== page.key && key !== `approve:${page.key}`)
                            )
                          }
                        />
                        {page.label}
                      </label>
                    ))}
                    <div className="col-span-full space-y-2 border-t pt-3">
                      <p className="text-sm font-medium">Act for department lead</p>
                      <p className="text-muted-foreground text-xs">
                        Enable page access above to grant its approval permission.
                      </p>
                      {DEPT_APPROVALS.map(({ key, page, label }) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={field.value.includes(key)}
                            disabled={!field.value.includes(page)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked === true ? [...field.value, key] : field.value.filter((item) => item !== key)
                              )
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              />
            </fieldset>
          </>
        )}
        {form.formState.errors.root && (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.root.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : lead ? "Assign lead" : "Save delegation"}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  )
}
