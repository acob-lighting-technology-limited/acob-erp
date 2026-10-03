"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, type QueryClient } from "@tanstack/react-query"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Loader2, Mail, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { QUERY_KEYS } from "@/lib/query-keys"
import { apiJson } from "@/lib/api-client"
import { applyServerErrors } from "@/lib/forms/server-errors"
import { InviteUserSchema, type InviteUserInput } from "@/lib/users/schemas"

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleOptions: string[]
  queryClient?: QueryClient
}

function roleLabel(role: string) {
  return role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1)
}

export function InviteUserDialog({ open, onOpenChange, roleOptions, queryClient }: InviteUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite User
          </DialogTitle>
          <DialogDescription>Send an invitation to a new team member without leaving this page.</DialogDescription>
        </DialogHeader>
        {/* Content unmounts when the dialog closes, so each opening starts a fresh form. */}
        <InviteUserForm roleOptions={roleOptions} queryClient={queryClient} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function InviteUserForm({
  roleOptions,
  queryClient,
  onDone,
}: {
  roleOptions: string[]
  queryClient?: QueryClient
  onDone: () => void
}) {
  const router = useRouter()
  const form = useForm<InviteUserInput>({
    resolver: zodResolver(InviteUserSchema),
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      role: (roleOptions[0] || "employee") as InviteUserInput["role"],
      department: "",
    },
  })

  const invite = useMutation({
    mutationFn: (values: InviteUserInput) =>
      apiJson("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: async (_data, values) => {
      toast.success(`Invitation sent to ${values.email}`)
      await queryClient?.invalidateQueries({ queryKey: QUERY_KEYS.adminUsersSettings() })
      onDone()
      router.refresh()
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, Object.keys(form.getValues()))
      if (message) toast.error(message)
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => invite.mutate(values))} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="user@company.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="First name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Last name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Engineering" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={invite.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
