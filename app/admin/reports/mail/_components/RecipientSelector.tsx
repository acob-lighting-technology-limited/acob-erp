"use client"

import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserPlus, Mail, Plus, Search, X, RotateCcw } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

type Employee = {
  id: string
  full_name: string
  company_email: string | null
  additional_email: string | null
  department: string | null
  employment_status: string | null
}

type RecipientMode = "all" | "select" | "manual" | "all_plus" | "resend_missed"

interface RecipientSelectorProps {
  employees: Employee[]
  filteredEmployees: Employee[]
  recipientMode: RecipientMode
  setRecipientMode: (mode: RecipientMode) => void
  selectedEmployeeIds: Set<string>
  toggleEmployee: (id: string) => void
  selectAll: () => void
  deselectAll: () => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  manualEmails: string[]
  manualInput: string
  setManualInput: (v: string) => void
  addManualEmail: () => void
  removeManualEmail: (email: string) => void
  /** Resend-missed mode: the raw text of already-delivered emails pasted by the user */
  deliveredEmailsText: string
  setDeliveredEmailsText: (v: string) => void
  /** Emails that will be sent to in resend_missed mode (computed outside) */
  missedRecipients: string[]
}

export function RecipientSelector({
  employees,
  filteredEmployees,
  recipientMode,
  setRecipientMode,
  selectedEmployeeIds,
  toggleEmployee,
  selectAll,
  deselectAll,
  searchQuery,
  setSearchQuery,
  manualEmails,
  manualInput,
  setManualInput,
  addManualEmail,
  removeManualEmail,
  deliveredEmailsText,
  setDeliveredEmailsText,
  missedRecipients,
}: RecipientSelectorProps) {
  const modes = [
    { value: "all" as RecipientMode, label: "All Employees", icon: Users },
    { value: "select" as RecipientMode, label: "Select Specific", icon: UserPlus },
    { value: "manual" as RecipientMode, label: "Enter Manually", icon: Mail },
    { value: "all_plus" as RecipientMode, label: "All + Add More", icon: Plus },
    { value: "resend_missed" as RecipientMode, label: "Resend Missed", icon: RotateCcw },
  ]

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        addManualEmail()
      }
    },
    [addManualEmail]
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-purple-600" />
          Recipients
        </CardTitle>
        <CardDescription>Choose who receives the email</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Pills */}
        <div className="flex flex-wrap gap-2">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setRecipientMode(mode.value)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                recipientMode === mode.value
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <mode.icon className="h-4 w-4" />
              {mode.label}
            </button>
          ))}
        </div>

        {/* Employee Selection (for "select" mode) */}
        {recipientMode === "select" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Clear
              </Button>
            </div>
            <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-lg border p-2">
              {filteredEmployees.map((emp) => (
                <label
                  key={emp.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                    selectedEmployeeIds.has(emp.id) ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/50"
                  }`}
                >
                  <Checkbox checked={selectedEmployeeIds.has(emp.id)} onCheckedChange={() => toggleEmployee(emp.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{emp.full_name}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {[emp.company_email, emp.additional_email].filter(Boolean).join(" | ")}
                    </div>
                  </div>
                  {emp.department && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {emp.department}
                    </Badge>
                  )}
                </label>
              ))}
              {filteredEmployees.length === 0 && (
                <div className="text-muted-foreground py-8 text-center text-sm">No employees found</div>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {selectedEmployeeIds.size} of {employees.length} selected
            </p>
          </div>
        )}

        {/* Manual Email Input (for "manual" and "all_plus" modes) */}
        {(recipientMode === "manual" || recipientMode === "all_plus") && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter email address..."
                type="email"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button variant="outline" onClick={addManualEmail}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            {manualEmails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {manualEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1.5 py-1.5 pr-1.5 pl-3">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeManualEmail(email)}
                      className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {recipientMode === "all_plus" && (
              <p className="text-muted-foreground text-xs">
                All {employees.length} employee emails will be included, plus any emails you add above.
              </p>
            )}
          </div>
        )}

        {recipientMode === "all" && (
          <p className="text-muted-foreground text-sm">
            The weekly report will be sent to all <strong>{employees.length}</strong> active employees.
          </p>
        )}

        {/* Resend Missed Mode */}
        {recipientMode === "resend_missed" && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Paste the email addresses that <strong>already received</strong> the report (one per line, or
              comma-separated). The system will send <strong>only to the employees not in that list</strong>.
            </p>
            <Textarea
              placeholder={`Paste delivered emails here, e.g.\nd.abdulsamad@org.acoblighting.com\na.nurudeen@org.acoblighting.com\n...`}
              value={deliveredEmailsText}
              onChange={(e) => setDeliveredEmailsText(e.target.value)}
              className="font-mono text-xs"
              rows={8}
            />
            {missedRecipients.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-orange-600">
                  {missedRecipients.length} missed recipient{missedRecipients.length !== 1 ? "s" : ""} found:
                </p>
                <div className="max-h-[200px] overflow-y-auto rounded-lg border bg-orange-50 p-3 dark:bg-orange-950/20">
                  {missedRecipients.map((email) => (
                    <div key={email} className="py-0.5 font-mono text-xs text-orange-800 dark:text-orange-300">
                      {email}
                    </div>
                  ))}
                </div>
              </div>
            ) : deliveredEmailsText.trim() ? (
              <p className="text-sm text-green-600">✅ All active employees appear to have received the email.</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Start pasting delivered emails above to compute who was missed.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
