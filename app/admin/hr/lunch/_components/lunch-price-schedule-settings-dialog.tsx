"use client"

import type { Dispatch, SetStateAction } from "react"
import { WEEKDAYS } from "../view"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings } from "lucide-react"

interface LunchPriceScheduleSettingsDialogProps {
  openSettings: boolean
  setOpenSettings: Dispatch<SetStateAction<boolean>>
  handleSaveSettings: (e: React.FormEvent) => Promise<void>
  settingsForm: { cost: number; subsidy_percent: number; eating_days: string[]; voting_deadline: string }
  setSettingsForm: Dispatch<
    SetStateAction<{ cost: number; subsidy_percent: number; eating_days: string[]; voting_deadline: string }>
  >
  toggleFormWeekday: (day: string, checked: boolean) => void
  loading: boolean
}

export function LunchPriceScheduleSettingsDialog({
  openSettings,
  setOpenSettings,
  handleSaveSettings,
  settingsForm,
  setSettingsForm,
  toggleFormWeekday,
  loading,
}: LunchPriceScheduleSettingsDialogProps) {
  return (
    <Dialog open={openSettings} onOpenChange={setOpenSettings}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSaveSettings}>
          <DialogHeader>
            <DialogTitle>Lunch Price & Schedule Settings</DialogTitle>
            <DialogDescription>
              Adjust the daily price of food, subsidy, and lunch schedule days of the week. Changes apply to logs
              starting today.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <Label htmlFor="cost">Food Cost per Meal (₦)</Label>
              <Input
                id="cost"
                type="number"
                value={settingsForm.cost || ""}
                onChange={(e) => setSettingsForm({ ...settingsForm, cost: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subsidy">Company Subsidy Percentage (%)</Label>
              <Input
                id="subsidy"
                type="number"
                min="0"
                max="100"
                value={settingsForm.subsidy_percent}
                onChange={(e) => setSettingsForm({ ...settingsForm, subsidy_percent: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voting-deadline">Voting Deadline</Label>
              <Input
                id="voting-deadline"
                type="time"
                value={settingsForm.voting_deadline}
                onChange={(e) => setSettingsForm({ ...settingsForm, voting_deadline: e.target.value })}
                required
              />
              <p className="text-muted-foreground text-xs">
                Default cut-off for staff to vote on each day&apos;s menu. Individual menus can override it.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Lunch Schedule Days</Label>
              <div className="bg-muted/20 mt-1 grid grid-cols-2 gap-2 rounded-lg border p-3">
                {WEEKDAYS.map((day) => {
                  const isChecked = settingsForm.eating_days.includes(day)
                  return (
                    <div key={day} className="flex items-center gap-2">
                      <Checkbox
                        id={`day-${day}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => toggleFormWeekday(day, !!checked)}
                      />
                      <Label htmlFor={`day-${day}`} className="cursor-pointer text-xs font-medium">
                        {day}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-muted/40 space-y-1.5 rounded-lg border p-3 text-xs">
              <div className="flex justify-between">
                <span>Calculated Employee Pay:</span>
                <span className="font-bold text-red-600">
                  ₦
                  {(settingsForm.cost * (1 - settingsForm.subsidy_percent / 100)).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Calculated Company Subsidy:</span>
                <span className="font-bold text-emerald-600">
                  ₦
                  {(settingsForm.cost * (settingsForm.subsidy_percent / 100)).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenSettings(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              Save Settings
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
