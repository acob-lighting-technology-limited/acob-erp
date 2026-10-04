"use client"

import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Loader2, Save } from "lucide-react"
import type { AttendancePolicy } from "@/lib/org-config"
import { grossDayHoursFor, netDayHoursFor } from "@/lib/hr/attendance-ssot"
import { apiJson } from "@/lib/api-client"
import { applyServerErrors } from "@/lib/forms/server-errors"
import { AttendancePolicySchema, type AttendancePolicyInput } from "@/lib/hr/attendance-policy-schema"

interface AttendanceFormProps {
  initialPolicy: AttendancePolicy
}

type TimeField = "startTime" | "lateCutoff" | "endTime"
type NumberField = "incompletePenalty" | "lunchMinutes" | "lunchQualifyingHours"

export function AttendanceForm({ initialPolicy }: AttendanceFormProps) {
  const router = useRouter()
  const form = useForm<AttendancePolicyInput>({
    resolver: zodResolver(AttendancePolicySchema),
    defaultValues: initialPolicy,
  })

  // Shown back to the admin so the effect of a change is obvious before saving.
  const draft = useWatch({ control: form.control }) as AttendancePolicy
  const grossDayHours = grossDayHoursFor(draft)
  const netDayHours = netDayHoursFor(draft)

  const save = useMutation({
    mutationFn: (values: AttendancePolicyInput) =>
      apiJson("/api/admin/settings/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      toast.success("Attendance policy updated successfully.")
      router.refresh()
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, Object.keys(form.getValues()))
      if (message) toast.error(message)
    },
  })

  const timeField = (name: TimeField, label: string, hint: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="time" className="w-full font-medium" {...field} />
          </FormControl>
          <FormDescription className="text-xs">{hint}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const numberField = (
    name: NumberField,
    label: string,
    hint: string,
    limits: { step: string; min: string; max: string }
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              {...limits}
              className="w-full font-medium"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={Number.isNaN(field.value) ? "" : field.value}
              onChange={(event) => field.onChange(event.target.valueAsNumber)}
            />
          </FormControl>
          <FormDescription className="text-xs">{hint}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <Card className="border-2 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Workday & Penalties Configuration</CardTitle>
            <CardDescription>
              Configure official business hours, grace periods, and credit deductions for incomplete days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              {timeField("startTime", "Workday Start Time (HH:MM)", "Official opening hour. Default is 08:00 AM.")}
              {timeField(
                "lateCutoff",
                "Lateness Grace Cutoff (HH:MM)",
                "Clock-ins after this time are marked Late. Default is 08:20 AM."
              )}
              {timeField("endTime", "Workday End Time (HH:MM)", "Official closing hour. Default is 05:00 PM.")}
              {numberField(
                "incompletePenalty",
                "Incomplete Punch Penalty (Hours)",
                "Hours charged when an employee misses a punch, on top of the side that was recorded. Default is 1.0.",
                { step: "0.5", min: "0", max: "9" }
              )}
              {numberField(
                "lunchMinutes",
                "Lunch Break (Minutes)",
                "Unpaid break deducted from a qualifying day. Default is 30 minutes.",
                { step: "5", min: "0", max: "240" }
              )}
              {numberField(
                "lunchQualifyingHours",
                "Lunch Qualifying Day (Hours)",
                "Shortest day that earns the lunch break. Default is 5 hours.",
                { step: "0.5", min: "0", max: "24" }
              )}
            </div>

            <div className="bg-muted/40 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs">
                A full working day is{" "}
                <span className="text-foreground font-semibold">{netDayHours.toFixed(2)} hours</span> —{" "}
                {grossDayHours.toFixed(2)}h from {draft.startTime} to {draft.endTime}, less the {draft.lunchMinutes}
                -minute lunch. Every penalty in the system is capped at this figure, and arriving after{" "}
                {draft.lateCutoff} costs one hour per hour-bracket.
              </p>
            </div>

            <FormField
              control={form.control}
              name="emailNotificationsEnabled"
              render={({ field }) => (
                <FormItem className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-semibold">Email Notifications</FormLabel>
                    <FormDescription className="text-xs">
                      When on, manual attendance alterations and LWP/AWP appeal decisions email the affected employee
                      and the Admin &amp; HR lead.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="border-muted flex justify-end border-t pt-6">
            <Button type="submit" disabled={save.isPending} className="flex items-center gap-2 px-6 font-semibold">
              {save.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Policy...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
