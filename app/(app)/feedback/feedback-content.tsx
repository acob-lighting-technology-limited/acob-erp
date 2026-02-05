"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FeedbackForm } from "@/components/feedback-form"
import { FeedbackEditModal } from "@/components/feedback-edit-modal"
import { AppTablePage } from "@/components/app/app-table-page"
import { Edit2, MessageSquare, Plus, Search, Trash2 } from "lucide-react"
import type { Feedback } from "./page"

interface FeedbackContentProps {
  initialFeedback: Feedback[]
  userId: string
}

export function FeedbackContent({ initialFeedback, userId }: FeedbackContentProps) {
  const [userFeedback, setUserFeedback] = useState<Feedback[]>(initialFeedback)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitOpen, setIsSubmitOpen] = useState(false)
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const filteredFeedback = useMemo(() => {
    if (!searchQuery) return userFeedback
    const query = searchQuery.toLowerCase()
    return userFeedback.filter(
      (item) =>
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.feedback_type?.toLowerCase().includes(query) ||
        item.status?.toLowerCase().includes(query)
    )
  }, [userFeedback, searchQuery])

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

  const handleFeedbackSubmitted = (newFeedback: Feedback) => {
    setUserFeedback((prev) => [newFeedback, ...prev])
    setIsSubmitOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return
    const supabase = createClient()

    try {
      const feedbackToDelete = userFeedback.find((item) => item.id === id)
      const { error } = await supabase.from("feedback").delete().eq("id", id)
      if (error) throw error

      if (feedbackToDelete) {
        try {
          await supabase.rpc("log_audit", {
            p_action: "delete",
            p_entity_type: "feedback",
            p_entity_id: id,
            p_old_values: {
              feedback_type: feedbackToDelete.feedback_type,
              title: feedbackToDelete.title,
              description: feedbackToDelete.description,
              status: feedbackToDelete.status,
            },
          })
        } catch (auditError) {
          console.error("Failed to log audit for feedback deletion:", auditError)
        }
      }

      setUserFeedback((prev) => prev.filter((item) => item.id !== id))
      toast.success("Feedback deleted successfully!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete feedback"
      toast.error(message)
    }
  }

  const handleEdit = (item: Feedback) => {
    setSelectedFeedback(item)
    setShowEditModal(true)
  }

  const handleSaveEdit = (updatedFeedback: Feedback) => {
    setUserFeedback((prev) => prev.map((item) => (item.id === updatedFeedback.id ? updatedFeedback : item)))
    setShowEditModal(false)
    setSelectedFeedback(null)
  }

  return (
    <AppTablePage
      title="Feedback & Suggestions"
      description="Share your concerns, complaints, suggestions, or required items with management"
      icon={MessageSquare}
      actions={
        <Button onClick={() => setIsSubmitOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Submit Feedback
        </Button>
      }
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              placeholder="Search feedback..."
              className="pl-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      }
    >
      {filteredFeedback.length === 0 ? (
        <Card className="border-2">
          <CardContent className="p-12 text-center">
            <MessageSquare className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
            <h3 className="text-foreground mb-2 text-xl font-semibold">No Feedback Yet</h3>
            <p className="text-muted-foreground">
              {searchQuery ? "No feedback matches your search." : "Submit your first feedback to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.map((item, index) => (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-foreground font-medium">{item.title}</div>
                        {item.description && (
                          <div className="text-muted-foreground line-clamp-2 text-xs">{item.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(item.feedback_type)}>
                        {item.feedback_type.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(item.status)}>{item.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Feedback</DialogTitle>
            <DialogDescription>Share your thoughts with management</DialogDescription>
          </DialogHeader>
          <FeedbackForm userId={userId} onFeedbackSubmitted={handleFeedbackSubmitted} variant="modal" />
        </DialogContent>
      </Dialog>

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
    </AppTablePage>
  )
}
