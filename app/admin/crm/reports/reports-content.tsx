"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { BarChart3, TrendingUp, Users, Target, DollarSign, Calendar, PieChart } from "lucide-react"

export interface ReportsData {
  contactsThisMonth: number
  contactsLastMonth: number
  opportunitiesWonCount: number
  opportunitiesWonValue: number
  opportunitiesLostCount: number
  opportunitiesLostValue: number
  totalPipelineCount: number
  totalPipelineValue: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

interface ReportsContentProps {
  initialData: ReportsData
}

export function ReportsContent({ initialData }: ReportsContentProps) {
  // Transform initial data to display format
  const metrics = {
    total_contacts: initialData.contactsThisMonth + initialData.contactsLastMonth,
    total_leads: 0, // Would need separate query
    total_customers: 0, // Would need separate query
    total_opportunities: initialData.totalPipelineCount,
    total_pipeline_value: initialData.totalPipelineValue,
    won_opportunities: initialData.opportunitiesWonCount,
    won_value: initialData.opportunitiesWonValue,
    lost_opportunities: initialData.opportunitiesLostCount,
    conversion_rate:
      initialData.contactsThisMonth > 0
        ? Math.round((initialData.opportunitiesWonCount / Math.max(initialData.contactsThisMonth, 1)) * 100)
        : 0,
    avg_deal_size:
      initialData.totalPipelineCount > 0 ? initialData.totalPipelineValue / initialData.totalPipelineCount : 0,
    activities_this_month: 0,
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">CRM Reports</h1>
        <p className="text-muted-foreground">Sales analytics and performance metrics</p>
      </div>

      {/* Contact Metrics */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Contact Overview</h2>
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
                  <p className="text-muted-foreground text-sm">Leads</p>
                  <p className="text-3xl font-bold">{metrics?.total_leads || 0}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-950">
                  <Users className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Customers</p>
                  <p className="text-3xl font-bold">{metrics?.total_customers || 0}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                  <Users className="h-6 w-6 text-green-600" />
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
      </div>

      {/* Sales Metrics */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Sales Performance</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Open Opportunities</p>
                  <p className="text-3xl font-bold">{metrics?.total_opportunities || 0}</p>
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
                  <p className="text-3xl font-bold">{metrics?.won_opportunities || 0}</p>
                  <p className="text-muted-foreground text-xs">{formatCurrency(metrics?.won_value || 0)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Avg Deal Size</p>
                  <p className="text-2xl font-bold">{formatCurrency(metrics?.avg_deal_size || 0)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Coming Soon Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Advanced Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-12 text-center">
            <BarChart3 className="mx-auto mb-4 h-16 w-16 opacity-50" />
            <h3 className="mb-2 text-lg font-medium">Coming Soon</h3>
            <p className="text-sm">
              Advanced charts, trend analysis, and detailed sales reports will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
