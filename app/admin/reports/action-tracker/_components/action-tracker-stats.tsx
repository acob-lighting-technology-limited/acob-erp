"use client"

import { Card, CardContent } from "@/components/ui/card"
import { FileSpreadsheet, CheckCircle2, Clock, RefreshCw } from "lucide-react"

interface ActionTrackerStatsProps {
  total: number
  completed: number
  pending: number
  notStarted: number
  inProgress: number
}

export function ActionTrackerStats({ total, completed, pending, notStarted, inProgress }: ActionTrackerStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5 md:gap-4">
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Total Actions</p>
            <p className="text-lg font-bold sm:text-2xl">{total}</p>
          </div>
          <FileSpreadsheet className="h-8 w-8 text-blue-500 opacity-20" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Completed</p>
            <p className="text-lg font-bold text-green-600 sm:text-2xl">{completed}</p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-green-500 opacity-20" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Pending</p>
            <p className="text-lg font-bold text-orange-600 sm:text-2xl">{pending}</p>
          </div>
          <Clock className="h-8 w-8 text-orange-500 opacity-20" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Not Started</p>
            <p className="text-lg font-bold text-amber-600 sm:text-2xl">{notStarted}</p>
          </div>
          <Clock className="h-8 w-8 text-amber-500 opacity-20" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-muted-foreground text-sm font-medium">In Progress</p>
            <p className="text-lg font-bold text-blue-600 sm:text-2xl">{inProgress}</p>
          </div>
          <RefreshCw className="h-8 w-8 text-blue-500 opacity-20" />
        </CardContent>
      </Card>
    </div>
  )
}
