"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquare, Send } from "lucide-react"
import { EmptyState } from "@/components/ui/patterns"

interface ProjectUpdateUser {
  first_name: string
  last_name: string
}

interface ProjectUpdate {
  id: string
  content?: string
  update_type: string
  created_at: string
  user?: ProjectUpdateUser
}

interface ProjectActivityTabProps {
  updates: ProjectUpdate[]
  newComment: string
  isSaving: boolean
  onCommentChange: (value: string) => void
  onAddComment: () => void
  formatDateTime: (dateString: string) => string
}

export function ProjectActivityTab({
  updates,
  newComment,
  isSaving,
  onCommentChange,
  onAddComment,
  formatDateTime,
}: ProjectActivityTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity &amp; Comments</CardTitle>
        <CardDescription>Project updates and team communication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => onCommentChange(e.target.value)}
            className="flex-1"
          />
          <Button onClick={onAddComment} disabled={isSaving || !newComment.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {updates.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Be the first to post a project comment."
              icon={MessageSquare}
              className="border-0"
            />
          ) : (
            updates.map((update) => (
              <div key={update.id} className="flex gap-3 rounded-lg border p-3">
                <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                  <MessageSquare className="text-primary h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {update.user ? `${update.user.first_name} ${update.user.last_name}` : "Unknown User"}
                    </p>
                    <span className="text-muted-foreground text-xs">{formatDateTime(update.created_at)}</span>
                  </div>
                  {update.content && (
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">{update.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
