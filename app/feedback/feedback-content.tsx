"use client"

import { useState } from "react"
import { FeedbackForm } from "@/components/feedback-form"
import { UserFeedbackList } from "@/components/user-feedback-list"
import type { Feedback } from "./page"

interface FeedbackContentProps {
  initialFeedback: Feedback[]
  userId: string
}

export function FeedbackContent({ initialFeedback, userId }: FeedbackContentProps) {
  const [userFeedback, setUserFeedback] = useState<any[]>(initialFeedback)

  const handleFeedbackSubmitted = (newFeedback: any) => {
    setUserFeedback([newFeedback, ...userFeedback])
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <h1 className="text-foreground text-3xl font-bold">Feedback & Suggestions</h1>
          <p className="text-muted-foreground">
            Share your concerns, complaints, suggestions, or required items with management
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <FeedbackForm userId={userId} onFeedbackSubmitted={handleFeedbackSubmitted} />
          </div>
          <div className="lg:col-span-2">
            <UserFeedbackList feedback={userFeedback} />
          </div>
        </div>
      </div>
    </div>
  )
}
