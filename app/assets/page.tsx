"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatName } from "@/lib/utils"
import { Package, Calendar, User, FileText, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Asset {
  id: string
  Asset_name: string
  Asset_type: string
  Asset_model?: string
  serial_number?: string
  status: string
}

interface AssetAssignment {
  id: string
  assigned_at: string
  assignment_notes?: string
  assigned_by: string
  Asset: Asset
  assigner?: {
    first_name: string
    last_name: string
  }
}


export default function AssetsPage() {
  const [assignments, setAssignments] = useState<AssetAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadAssets()
  }, [])

  const loadAssets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("Asset_assignments")
        .select(`
          id,
          assigned_at,
          assignment_notes,
          assigned_by,
          Asset_id
        `)
        .eq("assigned_to", user.id)
        .eq("is_current", true)
        .order("assigned_at", { ascending: false })

      if (error) throw error
      
      // Fetch Asset and assigner details separately
      const assignmentsWithDetails = await Promise.all((data || []).map(async (assignment: any) => {
        const [AssetResult, assignerResult] = await Promise.all([
          supabase
            .from("Assets")
            .select("id, Asset_name, Asset_type, Asset_model, serial_number, status")
            .eq("id", assignment.Asset_id)
            .single(),
          assignment.assigned_by ? supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", assignment.assigned_by)
            .single() : Promise.resolve({ data: null })
        ])
        
        return {
          ...assignment,
          Asset: AssetResult.data,
          assigner: assignerResult.data
        }
      }))
      
      setAssignments(assignmentsWithDetails as any || [])
    } catch (error: any) {
      console.error("Error loading Assets:", error)
      const errorMessage = error?.message || error?.toString() || "Failed to load Assets"
      toast.error(`Failed to load Assets: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "maintenance":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "available":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-48 bg-muted rounded"></div>
              <div className="h-48 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            My Assets
          </h1>
          <p className="text-muted-foreground mt-2">
            View your currently assigned Assets and equipment
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active Assets</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{assignments.length}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assets List */}
        {assignments.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {assignments.map((assignment) => (
              <Card key={assignment.id} className="border-2 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-background">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Package className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{assignment.Asset.Asset_name}</CardTitle>
                        <CardDescription className="mt-1">
                          {assignment.Asset.Asset_type}
                          {assignment.Asset.Asset_model && ` • ${assignment.Asset.Asset_model}`}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(assignment.Asset.status)}>
                      {assignment.Asset.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {assignment.Asset.serial_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Serial:</span>
                      <span className="font-mono text-foreground">{assignment.Asset.serial_number}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned:</span>
                    <span className="text-foreground">{formatDate(assignment.assigned_at)}</span>
                  </div>

                  {assignment.assigner && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Assigned by:</span>
                      <span className="text-foreground">
                        {formatName(assignment.assigner.first_name)} {formatName(assignment.assigner.last_name)}
                      </span>
                    </div>
                  )}

                  {assignment.assignment_notes && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium text-foreground mb-1">Notes:</p>
                      <p className="text-sm text-muted-foreground">{assignment.assignment_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Assets Assigned</h3>
              <p className="text-muted-foreground">
                You don't have any Assets assigned to you at the moment.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  )
}
