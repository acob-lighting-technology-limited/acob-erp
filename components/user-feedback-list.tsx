"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Edit2 } from "lucide-react"
import { toast } from "sonner"
import { FeedbackEditModal } from "./feedback-edit-modal"

interface UserFeedbackListProps {
  feedback: any[]
}

export function UserFeedbackList({ feedback }: UserFeedbackListProps) {
  const [feedbackList, setFeedbackList] = useState(feedback)
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const getTypeColor = (type: string) => {
    switch (type) {
      case "concern":
        return "bg-yellow-100 text-yellow-800"
      case "complaint":
        return "bg-red-100 text-red-800"
      case "suggestion":
        return "bg-blue-100 text-blue-800"
      case "required_item":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-100 text-green-800"
      case "in_progress":
        return "bg-blue-100 text-blue-800"
      case "resolved":
        return "bg-purple-100 text-purple-800"
      case "closed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return

    const supabase = createClient()

    try {
      const { error } = await supabase.from("feedback").delete().eq("id", id)

      if (error) throw error

      setFeedbackList(feedbackList.filter((item) => item.id !== id))
      toast.success("Feedback deleted successfully!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete feedback"
      toast.error(message)
    }
  }

  const handleEdit = (item: any) => {
    setSelectedFeedback(item)
    setShowEditModal(true)
  }

  const handleSaveEdit = (updatedFeedback: any) => {
    setFeedbackList(feedbackList.map((item) => (item.id === updatedFeedback.id ? updatedFeedback : item)))
    setShowEditModal(false)
    setSelectedFeedback(null)
  }

  if (feedbackList.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Feedback</CardTitle>
          <CardDescription>No feedback submitted yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Submit your first feedback using the form on the left to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Your Feedback</CardTitle>
          <CardDescription>Total: {feedbackList.length} items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbackList.map((item) => (
            <div key={item.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className={getTypeColor(item.feedback_type)}>{item.feedback_type.replace("_", " ")}</Badge>
                <Badge className={getStatusColor(item.status)}>{item.status.replace("_", " ")}</Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {showEditModal && selectedFeedback && (
        <FeedbackEditModal
          feedback={selectedFeedback}
          onClose={() => {
            setShowEditModal(false)
            setSelectedFeedback(null)
          }}
          onSave={handleSaveEdit}
        />
      )}
    </>
  )
}
