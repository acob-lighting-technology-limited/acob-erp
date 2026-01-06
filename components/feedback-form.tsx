"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { EyeOff } from "lucide-react"

interface FeedbackFormProps {
  userId: string
  onFeedbackSubmitted?: (feedback: any) => void
}

export function FeedbackForm({ userId, onFeedbackSubmitted }: FeedbackFormProps) {
  const [formData, setFormData] = useState({
    feedbackType: "",
    title: "",
    description: "",
  })
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)

    try {
      if (!formData.feedbackType || !formData.title) {
        toast.error("Please fill in all required fields")
        setIsLoading(false)
        return
      }

      // Insert feedback - set user_id to null if anonymous
      const { data, error } = await supabase
        .from("feedback")
        .insert({
          user_id: isAnonymous ? null : userId,
          feedback_type: formData.feedbackType,
          title: formData.title,
          description: formData.description,
          status: "open",
          is_anonymous: isAnonymous,
        })
        .select()

      if (error) throw error

      // Log audit for all feedback - anonymous ones will show as "Anonymous" in the audit log
      if (data && data.length > 0) {
        const { error: auditError } = await supabase.rpc("log_audit", {
          p_action: "create",
          p_entity_type: "feedback",
          p_entity_id: data[0].id,
          p_new_values: {
            feedback_type: formData.feedbackType,
            title: formData.title,
            description: formData.description,
            status: "open",
            is_anonymous: isAnonymous,
          },
        })
        if (auditError) {
          console.error("Failed to log audit:", auditError)
        }
      }

      toast.success(isAnonymous ? "Anonymous feedback submitted" : "Feedback submitted successfully!")
      setFormData({
        feedbackType: "",
        title: "",
        description: "",
      })
      setIsAnonymous(false)

      if (onFeedbackSubmitted && data && data.length > 0) {
        onFeedbackSubmitted(data[0])
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit feedback"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Feedback</CardTitle>
        <CardDescription>Share your thoughts with us</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Anonymous Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <EyeOff className={`h-4 w-4 ${isAnonymous ? "text-primary" : "text-muted-foreground"}`} />
              <Label htmlFor="anonymous" className="cursor-pointer">
                Submit anonymously
              </Label>
            </div>
            <Switch id="anonymous" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedbackType">Feedback Type *</Label>
            <Select
              value={formData.feedbackType}
              onValueChange={(value) => setFormData({ ...formData, feedbackType: value })}
            >
              <SelectTrigger id="feedbackType">
                <SelectValue placeholder="Select type" />
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
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief title of your feedback"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide more details about your feedback..."
              rows={4}
            />
          </div>

          <Button type="submit" loading={isLoading} className="w-full">
            {isAnonymous ? "Submit Anonymously" : "Submit Feedback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
