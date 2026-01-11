"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Users,
  Target,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  Plus,
  ArrowRight,
  Building2,
  UserPlus,
  CheckCircle,
  BarChart3,
} from "lucide-react"
import Link from "next/link"

interface DashboardMetrics {
  total_contacts: number
  leads_count: number
  customers_count: number
  open_opportunities: number
  total_pipeline_value: number
  weighted_pipeline_value: number
  won_this_month: number
  won_value_this_month: number
  activities_due_today: number
  overdue_activities: number
  conversion_rate: number
}

interface PipelineStage {
  count: number
  value: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function CRMDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [pipelineByStage, setPipelineByStage] = useState<Record<string, PipelineStage>>({})
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/crm/dashboard")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setMetrics(data.metrics)
      setPipelineByStage(data.pipelineByStage)
      setRecentActivities(data.recentActivities)
      setUpcomingFollowUps(data.upcomingFollowUps)
    } catch (error: any) {
      console.error("Error loading dashboard:", error)
      toast.error("Failed to load dashboard")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="mb-2 h-4 w-20" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <p className="text-muted-foreground">Manage your leads, customers, and sales pipeline</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/crm/activities"
            className="border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Activities
          </Link>
          <Link
            href="/admin/crm/contacts/new"
            className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Contact
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Contacts</p>
                <p className="text-3xl font-bold">{metrics?.total_contacts || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Leads</p>
                <p className="text-3xl font-bold">{metrics?.leads_count || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-950">
                <UserPlus className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Customers</p>
                <p className="text-3xl font-bold">{metrics?.customers_count || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                <Building2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Conversion Rate</p>
                <p className="text-3xl font-bold">{metrics?.conversion_rate || 0}%</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Open Deals</p>
                <p className="text-3xl font-bold">{metrics?.open_opportunities || 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950">
                <Target className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Pipeline Value</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.total_pipeline_value || 0)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Won This Month</p>
                <p className="text-3xl font-bold">{metrics?.won_this_month || 0}</p>
                <p className="text-muted-foreground text-xs">{formatCurrency(metrics?.won_value_this_month || 0)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Weighted Value</p>
                <p className="text-2xl font-bold">{formatCurrency(metrics?.weighted_pipeline_value || 0)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activities & Follow-ups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Activities Due */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Activities</CardTitle>
            <div className="flex gap-2">
              {(metrics?.overdue_activities || 0) > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {metrics?.overdue_activities} overdue
                </Badge>
              )}
              {(metrics?.activities_due_today || 0) > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {metrics?.activities_due_today} today
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {recentActivities.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          activity.type === "call"
                            ? "bg-blue-100 text-blue-600"
                            : activity.type === "email"
                              ? "bg-green-100 text-green-600"
                              : activity.type === "meeting"
                                ? "bg-purple-100 text-purple-600"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {activity.type === "call" ? (
                          <Phone className="h-4 w-4" />
                        ) : activity.type === "email" ? (
                          <Mail className="h-4 w-4" />
                        ) : (
                          <Calendar className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{activity.subject}</p>
                        <p className="text-muted-foreground text-xs">
                          {activity.contact?.contact_name || "No contact"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={activity.completed ? "secondary" : "outline"}>
                      {activity.completed ? "Done" : activity.priority}
                    </Badge>
                  </div>
                ))}
                <Link
                  href="/admin/crm/activities"
                  className="hover:bg-accent hover:text-accent-foreground inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                >
                  View all activities
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Calendar className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>No recent activities</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Follow-ups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingFollowUps.length > 0 ? (
              <div className="space-y-3">
                {upcomingFollowUps.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/admin/crm/contacts/${contact.id}`}
                    className="bg-muted/50 hover:bg-muted flex items-center justify-between rounded-lg p-3 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{contact.contact_name}</p>
                      <p className="text-muted-foreground text-xs">{contact.company_name || "No company"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">
                        {new Date(contact.next_follow_up).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
                <Link
                  href="/admin/crm/contacts?filter=follow-up"
                  className="hover:bg-accent hover:text-accent-foreground inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
                >
                  View all follow-ups
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>No upcoming follow-ups</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Stages */}
      {Object.keys(pipelineByStage).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {Object.entries(pipelineByStage).map(([stage, data]) => (
                <div key={stage} className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium">{stage}</p>
                  <p className="text-2xl font-bold">{data.count}</p>
                  <p className="text-muted-foreground text-xs">{formatCurrency(data.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href="/admin/crm/contacts">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex items-center gap-4 p-6">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="font-medium">All Contacts</p>
                <p className="text-muted-foreground text-sm">View and manage contacts</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/crm/opportunities">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex items-center gap-4 p-6">
              <Target className="h-8 w-8 text-orange-600" />
              <div>
                <p className="font-medium">Opportunities</p>
                <p className="text-muted-foreground text-sm">Track your sales pipeline</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/crm/reports">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex items-center gap-4 p-6">
              <BarChart3 className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-medium">Reports</p>
                <p className="text-muted-foreground text-sm">Sales analytics</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
