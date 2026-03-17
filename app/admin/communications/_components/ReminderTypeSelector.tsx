"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Video, BookOpen } from "lucide-react"

type ReminderType = "meeting" | "knowledge_sharing" | "admin_broadcast"

interface ReminderTypeSelectorProps {
  reminderType: ReminderType
  setReminderType: (v: ReminderType) => void
}

const OPTIONS = [
  {
    value: "meeting" as ReminderType,
    label: "General Meeting Reminder",
    icon: Video,
    desc: "Weekly meeting with agenda & Teams link",
  },
  {
    value: "knowledge_sharing" as ReminderType,
    label: "Knowledge Sharing Session",
    icon: BookOpen,
    desc: "Pre-meeting knowledge sharing reminder",
  },
] as const

export function ReminderTypeSelector({ reminderType, setReminderType }: ReminderTypeSelectorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-orange-600" />
          Reminder Type
        </CardTitle>
        <CardDescription>Choose which reminder to send</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setReminderType(opt.value)}
              className={`flex min-w-[240px] flex-1 items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                reminderType === opt.value
                  ? "border-orange-600 bg-orange-50 dark:border-orange-500 dark:bg-orange-950/30"
                  : "hover:border-muted-foreground/30 bg-muted/30 border-transparent"
              }`}
            >
              <opt.icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${reminderType === opt.value ? "text-orange-600" : "text-muted-foreground"}`}
              />
              <div>
                <div
                  className={`font-semibold ${reminderType === opt.value ? "text-orange-700 dark:text-orange-400" : ""}`}
                >
                  {opt.label}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
