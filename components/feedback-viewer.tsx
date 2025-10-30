"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { toast } from "sonner"
import { Eye } from "lucide-react"

interface FeedbackViewerProps {
  feedback: any[]
}

export function FeedbackViewer({ feedback }: FeedbackViewerProps) {
  const [filteredFeedback, setFilteredFeedback] = useState(feedback)
  const [selectedType, setSelectedType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Real-time filtering with useEffect
  useEffect(() => {
    let filtered = feedback

    if (selectedType !== "all") {
      filtered = filtered.filter((item) => item.feedback_type === selectedType)
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((item) => item.status === selectedStatus)
    }

    setFilteredFeedback(filtered)
  }, [feedback, selectedType, selectedStatus])

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

  const handleViewDetails = (item: any) => {
    setSelectedFeedback(item)
    setIsModalOpen(true)
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedFeedback) return

    const supabase = createClient()
    setIsUpdating(true)

    try {
      const { error } = await supabase
        .from("feedback")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedFeedback.id)

      if (error) throw error

      toast.success("Status updated successfully!")
      
      // Update local state
      const updatedFeedback = { ...selectedFeedback, status: newStatus }
      setSelectedFeedback(updatedFeedback)
      
      // Update in the list
      setFilteredFeedback(
        filteredFeedback.map((item) => (item.id === selectedFeedback.id ? updatedFeedback : item))
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update status"
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Feedback Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="concern">Concern</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="required_item">Required Item</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Items</CardTitle>
          <CardDescription>Total: {filteredFeedback.length} items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">
                          {item.profiles?.first_name} {item.profiles?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.profiles?.company_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(item.feedback_type)}>{item.feedback_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{item.title}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetails(item)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Link href="/admin">
        <Button variant="outline">Back to Admin Dashboard</Button>
      </Link>

      {/* Feedback Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feedback Details</DialogTitle>
            <DialogDescription>View and manage feedback details</DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* User Information */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Submitted By</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">
                    {selectedFeedback.profiles?.first_name} {selectedFeedback.profiles?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedFeedback.profiles?.company_email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {new Date(selectedFeedback.created_at).toLocaleString()}
                  </p>
                  {selectedFeedback.updated_at !== selectedFeedback.created_at && (
                    <p className="text-xs text-muted-foreground">
                      Updated: {new Date(selectedFeedback.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Feedback Type and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Feedback Type</Label>
                  <div>
                    <Badge className={getTypeColor(selectedFeedback.feedback_type)}>
                      {selectedFeedback.feedback_type}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Status</Label>
                  <div>
                    <Badge className={getStatusColor(selectedFeedback.status)}>{selectedFeedback.status}</Badge>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Title</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p>{selectedFeedback.title}</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Description</Label>
                <div className="p-3 bg-muted rounded-md min-h-[100px]">
                  <p className="whitespace-pre-wrap">{selectedFeedback.description || "No description provided."}</p>
                </div>
              </div>

              {/* Update Status */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Update Status</Label>
                <Select
                  value={selectedFeedback.status}
                  onValueChange={handleUpdateStatus}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setIsModalOpen(false)} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
