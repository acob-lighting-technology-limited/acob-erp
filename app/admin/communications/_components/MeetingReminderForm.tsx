"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Employee = {
  id: string
  full_name: string
  company_email: string | null
  additional_email: string | null
  department: string | null
  employment_status: string | null
}

interface MeetingReminderFormProps {
  meetingDate: string
  setMeetingDate: (v: string) => void
  meetingTime: string
  setMeetingTime: (v: string) => void
  teamsLink: string
  setTeamsLink: (v: string) => void
  agendaText: string
  setAgendaText: (v: string) => void
  knowledgeDepartment: string
  setKnowledgeDepartment: (v: string) => void
  knowledgePresenterId: string
  setKnowledgePresenterId: (v: string) => void
  meetingPreparedById: string
  setMeetingPreparedById: (v: string) => void
  departmentOptions: string[]
  presenterOptions: Employee[]
  meetingPreparedByOptions: Employee[]
}

export function MeetingReminderForm({
  meetingDate,
  setMeetingDate,
  meetingTime,
  setMeetingTime,
  teamsLink,
  setTeamsLink,
  agendaText,
  setAgendaText,
  knowledgeDepartment,
  setKnowledgeDepartment,
  knowledgePresenterId,
  setKnowledgePresenterId,
  meetingPreparedById,
  setMeetingPreparedById,
  departmentOptions,
  presenterOptions,
  meetingPreparedByOptions,
}: MeetingReminderFormProps) {
  return (
    <>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label htmlFor="meet-date">Meeting Date</Label>
          <Input
            id="meet-date"
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="w-[180px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meet-time">Meeting Time</Label>
          <Input
            id="meet-time"
            type="time"
            value={meetingTime}
            onChange={(e) => setMeetingTime(e.target.value)}
            className="w-[140px]"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="teams-link">Microsoft Teams Link</Label>
        <Input
          id="teams-link"
          placeholder="Paste Microsoft Teams meeting link..."
          value={teamsLink}
          onChange={(e) => setTeamsLink(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="agenda">Agenda (one item per line)</Label>
        <Textarea
          id="agenda"
          value={agendaText}
          onChange={(e) => setAgendaText(e.target.value)}
          rows={8}
          placeholder={"1. Opening Prayer\n2. Departmental updates\n..."}
        />
        <p className="text-muted-foreground text-xs">Each line becomes one agenda item. Numbering is automatic.</p>
      </div>
      <div className="space-y-3 rounded-lg border border-dashed p-3">
        <div>
          <Label className="text-sm">Knowledge Sharing Presenter (Optional)</Label>
          <p className="text-muted-foreground mt-1 text-xs">
            This updates the agenda line &quot;Knowledge Sharing Session (30 minutes)&quot; with department and
            presenter.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-2">
            <Label htmlFor="ks-department">Department</Label>
            <Select
              value={knowledgeDepartment}
              onValueChange={(value) => {
                setKnowledgeDepartment(value)
                setKnowledgePresenterId("none")
              }}
            >
              <SelectTrigger id="ks-department" className="w-[220px]">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not selected</SelectItem>
                {departmentOptions.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ks-presenter">Presenter</Label>
            <Select
              value={knowledgePresenterId}
              onValueChange={setKnowledgePresenterId}
              disabled={knowledgeDepartment === "none"}
            >
              <SelectTrigger id="ks-presenter" className="w-[260px]">
                <SelectValue placeholder="Select presenter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not selected</SelectItem>
                {presenterOptions.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="meeting-prepared-by">Prepared by</Label>
        <Select value={meetingPreparedById} onValueChange={setMeetingPreparedById}>
          <SelectTrigger id="meeting-prepared-by" className="w-[320px]">
            <SelectValue placeholder="Select person" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select person</SelectItem>
            {meetingPreparedByOptions.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Admin &amp; HR only. This appears as &quot;Prepared by&quot; in the footer.
        </p>
      </div>
    </>
  )
}
