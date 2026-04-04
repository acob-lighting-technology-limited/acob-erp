"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { writeAuditLogClient } from "@/lib/audit/client"
import type { FeedbackRecord } from "@/components/feedback/types"

interface FeedbackFormProps {
  userId: string
  onFeedbackSubmitted?: (feedback: FeedbackRecord) => void
  variant?: "card" | "modal"
}

const FeedbackFormSchema = z.object({
  feedbackType: z.string().min(1, "Feedback type is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
})

type FeedbackFormValues = z.infer<typeof FeedbackFormSchema>

export function FeedbackForm({ userId, onFeedbackSubmitted, variant = "card" }: FeedbackFormProps) {
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(FeedbackFormSchema),
    defaultValues: {
      feedbackType: "",
      title: "",
      description: "",
    },
  })
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const onSubmit = form.handleSubmit(async (data) => {
    const supabase = createClient()
    setIsLoading(true)

    try {
      // Insert feedback - set user_id to null if anonymous
      const { data: createdFeedback, error } = await supabase
        .from("feedback")
        .insert({
          user_id: isAnonymous ? null : userId,
          feedback_type: data.feedbackType,
          title: data.title,
          description: data.description,
          status: "open",
          is_anonymous: isAnonymous,
        })
        .select()

      if (error) throw error

      // Log audit for all feedback - anonymous ones will show as "Anonymous" in the audit log
      if (createdFeedback && createdFeedback.length > 0) {
        await writeAuditLogClient(
          supabase,
          {
            action: "create",
            entityType: "feedback",
            entityId: createdFeedback[0].id,
            newValues: {
              feedback_type: data.feedbackType,
              title: data.title,
              description: data.description,
              status: "open",
              is_anonymous: isAnonymous,
            },
            context: {
              source: "ui",
              route: "/feedback",
            },
          },
          { failOpen: true }
        )
      }

      toast.success(isAnonymous ? "Anonymous feedback submitted" : "Feedback submitted successfully!")
      form.reset({
        feedbackType: "",
        title: "",
        description: "",
      })
      setIsAnonymous(false)

      if (onFeedbackSubmitted && createdFeedback && createdFeedback.length > 0) {
        onFeedbackSubmitted(createdFeedback[0])
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to submit feedback"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  })

  const formContent = (
    <form onSubmit={onSubmit} className="space-y-4">
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
        <Select value={form.watch("feedbackType")} onValueChange={(value) => form.setValue("feedbackType", value)}>
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
        {form.formState.errors.feedbackType && (
          <p className="text-destructive text-sm">{form.formState.errors.feedbackType.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...form.register("title")} placeholder="Brief title of your feedback" />
        {form.formState.errors.title && (
          <p className="text-destructive text-sm">{form.formState.errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...form.register("description")}
          placeholder="Provide more details about your feedback..."
          rows={4}
        />
      </div>

      <Button type="submit" loading={isLoading} className={variant === "modal" ? "w-full" : "w-full"}>
        {isAnonymous ? "Submit Anonymously" : "Submit Feedback"}
      </Button>
    </form>
  )

  if (variant === "modal") {
    return formContent
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Feedback</CardTitle>
        <CardDescription>Share your thoughts with us</CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  )
}
