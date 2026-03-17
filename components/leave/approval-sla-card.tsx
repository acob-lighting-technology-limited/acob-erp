"use client"

import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySla = any

interface ApprovalSlaCardProps {
  slas: AnySla[]
  onSave: (stage: string, due_hours: number, reminder_hours_before: number) => void
}

export function ApprovalSlaCard({ slas, onSave }: ApprovalSlaCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval SLA</CardTitle>
        <CardDescription>Configure due and reminder timing per stage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {slas.map((sla: AnySla) => (
          <div key={sla.id} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
            <span className="w-40 font-medium">{sla.stage}</span>
            <Input
              className="w-32"
              type="number"
              defaultValue={sla.due_hours}
              onBlur={(e) =>
                onSave(sla.stage, Number(e.target.value || sla.due_hours), Number(sla.reminder_hours_before))
              }
            />
            <span>due hours</span>
            <Input
              className="w-32"
              type="number"
              defaultValue={sla.reminder_hours_before}
              onBlur={(e) =>
                onSave(sla.stage, Number(sla.due_hours), Number(e.target.value || sla.reminder_hours_before))
              }
            />
            <span>reminder hours before</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
