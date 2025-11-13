"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface FeedbackEditModalProps {
  feedback: any
  onClose: () => void
  onSave: (feedback: any) => void
}

export function FeedbackEditModal({ feedback, onClose, onSave }: FeedbackEditModalProps) {
  const [formData, setFormData] = useState({
    feedbackType: feedback.feedback_type,
    title: feedback.title,
    description: feedback.description,
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    const supabase = createClient()
    setIsLoading(true)

    try {
      const { error } = await supabase
        .from("feedback")
        .update({
          feedback_type: formData.feedbackType,
          title: formData.title,
          description: formData.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", feedback.id)

      if (error) throw error

      // Log audit
      await supabase.rpc("log_audit", {
        p_action: "update",
        p_entity_type: "feedback",
        p_entity_id: feedback.id,
        p_old_values: {
          feedback_type: feedback.feedback_type,
          title: feedback.title,
          description: feedback.description,
        },
        p_new_values: {
          feedback_type: formData.feedbackType,
          title: formData.title,
          description: formData.description,
        },
      })

      toast.success("Feedback updated successfully!")
      onSave({
        ...feedback,
        ...formData,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update feedback"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Feedback</DialogTitle>
          <DialogDescription>Update your feedback details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedbackType">Feedback Type</Label>
            <Select
              value={formData.feedbackType}
              onValueChange={(value) => setFormData({ ...formData, feedbackType: value })}
            >
              <SelectTrigger id="feedbackType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concern">Concern</SelectItem>
                <SelectItem value="complaint">Complaint</SelectItem>
                <SelectItem value="suggestion">Suggestion</SelectItem>
                <SelectItem value="required_item">Required Item</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} loading={isLoading} className="flex-1">
              Save Changes
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1 bg-transparent">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
