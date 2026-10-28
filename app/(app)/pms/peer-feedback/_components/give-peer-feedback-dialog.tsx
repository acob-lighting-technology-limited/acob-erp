"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Profile } from "../page"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type CycleFilterCycle } from "@/components/pms/use-cycle-filters"
import { personName } from "@/lib/format"

interface GivePeerFeedbackDialogProps {
  isDialogOpen: boolean
  setIsDialogOpen: Dispatch<SetStateAction<boolean>>
  handleSubmit: (event: React.FormEvent) => Promise<void>
  selectedColleague: string
  setSelectedColleague: Dispatch<SetStateAction<string>>
  colleagues: Profile[]
  alreadySubmittedKeys: Set<string>
  selectedCycle: string
  setSelectedCycle: Dispatch<SetStateAction<string>>
  cycles: CycleFilterCycle[]
  score: string
  setScore: Dispatch<SetStateAction<string>>
  collaboration: string
  setCollaboration: Dispatch<SetStateAction<string>>
  communication: string
  setCommunication: Dispatch<SetStateAction<string>>
  teamwork: string
  setTeamwork: Dispatch<SetStateAction<string>>
  professionalism: string
  setProfessionalism: Dispatch<SetStateAction<string>>
  comments: string
  setComments: Dispatch<SetStateAction<string>>
  isSubmitting: boolean
}

export function GivePeerFeedbackDialog({
  isDialogOpen,
  setIsDialogOpen,
  handleSubmit,
  selectedColleague,
  setSelectedColleague,
  colleagues,
  alreadySubmittedKeys,
  selectedCycle,
  setSelectedCycle,
  cycles,
  score,
  setScore,
  collaboration,
  setCollaboration,
  communication,
  setCommunication,
  teamwork,
  setTeamwork,
  professionalism,
  setProfessionalism,
  comments,
  setComments,
  isSubmitting,
}: GivePeerFeedbackDialogProps) {
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Give Peer Feedback</DialogTitle>
          <DialogDescription>
            Rate a colleague on their performance this cycle. Your name will not be shown to them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label>Colleague</Label>
            <Select value={selectedColleague} onValueChange={setSelectedColleague}>
              <SelectTrigger>
                <SelectValue placeholder="Select colleague…" />
              </SelectTrigger>
              <SelectContent>
                {colleagues.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {personName(c)} {c.department ? `(${c.department})` : ""}
                    {alreadySubmittedKeys.has(`${c.id}:${selectedCycle}`) ? " ✓" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Review Cycle</Label>
            <Select value={selectedCycle} onValueChange={setSelectedCycle}>
              <SelectTrigger>
                <SelectValue placeholder="Select cycle…" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Overall Score (0–100) *</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 85"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Collaboration</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0–100"
                value={collaboration}
                onChange={(e) => setCollaboration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Communication</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0–100"
                value={communication}
                onChange={(e) => setCommunication(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Teamwork</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0–100"
                value={teamwork}
                onChange={(e) => setTeamwork(e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Professionalism</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0–100"
                value={professionalism}
                onChange={(e) => setProfessionalism(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Comments (optional)</Label>
            <Textarea
              placeholder="Share specific observations or examples…"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Submit Feedback
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
