"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { FeedbackForm } from "@/components/feedback-form"
import { UserFeedbackList } from "@/components/user-feedback-list"
import { useState, useEffect } from "react"

export default function FeedbackPage() {
  const router = useRouter()
  const [userFeedback, setUserFeedback] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.getUser()

      if (error || !data?.user) {
        router.push("/auth/login")
        return
      }

      setUserId(data.user.id)

      // Fetch user's feedback
      const { data: feedback } = await supabase
        .from("feedback")
        .select("*")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false })

      setUserFeedback(feedback || [])
      setIsLoading(false)
    }

    fetchData()
  }, [])

  const handleFeedbackSubmitted = (newFeedback: any) => {
    setUserFeedback([newFeedback, ...userFeedback])
  }

  if (isLoading || !userId) {
    return <div className="min-h-screen bg-background" />
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Feedback & Suggestions</h1>
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
