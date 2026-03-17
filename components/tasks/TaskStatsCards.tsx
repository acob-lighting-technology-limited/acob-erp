"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ClipboardList } from "lucide-react"

interface TaskStats {
  total: number
  pending: number
  in_progress: number
  completed: number
}

interface TaskStatsCardsProps {
  stats: TaskStats
}

export function TaskStatsCards({ stats }: TaskStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
      <Card className="border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total Tasks</p>
              <p className="text-foreground mt-1 text-lg font-bold sm:mt-2 sm:text-3xl">{stats.total}</p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
              <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Pending</p>
              <p className="text-foreground mt-1 text-lg font-bold sm:mt-2 sm:text-3xl">{stats.pending}</p>
            </div>
            <div className="rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900/30">
              <ClipboardList className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">In Progress</p>
              <p className="text-foreground mt-1 text-lg font-bold sm:mt-2 sm:text-3xl">{stats.in_progress}</p>
            </div>
            <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
              <ClipboardList className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Completed</p>
              <p className="text-foreground mt-1 text-lg font-bold sm:mt-2 sm:text-3xl">{stats.completed}</p>
            </div>
            <div className="rounded-lg bg-green-100 p-3 dark:bg-green-900/30">
              <ClipboardList className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
