"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface KnowledgeSessionFormProps {
  sessionDate: string
  setSessionDate: (v: string) => void
  sessionTime: string
  setSessionTime: (v: string) => void
  duration: string
  setDuration: (v: string) => void
}

export function KnowledgeSessionForm({
  sessionDate,
  setSessionDate,
  sessionTime,
  setSessionTime,
  duration,
  setDuration,
}: KnowledgeSessionFormProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-2">
        <Label htmlFor="session-date">Session Date</Label>
        <Input
          id="session-date"
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          className="w-[180px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="session-time">Session Time</Label>
        <Input
          id="session-time"
          type="time"
          value={sessionTime}
          onChange={(e) => setSessionTime(e.target.value)}
          className="w-[140px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="session-duration">Duration</Label>
        <Input
          id="session-duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="e.g. 30 minutes"
          className="w-[160px]"
        />
      </div>
    </div>
  )
}
