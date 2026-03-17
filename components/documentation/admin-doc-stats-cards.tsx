"use client"

import { Card, CardContent } from "@/components/ui/card"
import { FileText, Calendar } from "lucide-react"

interface AdminDocStatsCardsProps {
  total: number
  published: number
  drafts: number
  thisMonth: number
}

export function AdminDocStatsCards({ total, published, drafts, thisMonth }: AdminDocStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
      <Card className="border-2">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">
                Total Documents
              </p>
              <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{total}</p>
            </div>
            <div className="ml-1 shrink-0 rounded-lg bg-blue-100 p-1.5 sm:p-2 md:p-3 dark:bg-blue-900/30">
              <FileText className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">Published</p>
              <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{published}</p>
            </div>
            <div className="ml-1 shrink-0 rounded-lg bg-green-100 p-1.5 sm:p-2 md:p-3 dark:bg-green-900/30">
              <FileText className="h-4 w-4 text-green-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-green-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">Drafts</p>
              <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{drafts}</p>
            </div>
            <div className="ml-1 shrink-0 rounded-lg bg-yellow-100 p-1.5 sm:p-2 md:p-3 dark:bg-yellow-900/30">
              <FileText className="h-4 w-4 text-yellow-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-yellow-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">This Month</p>
              <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{thisMonth}</p>
            </div>
            <div className="ml-1 shrink-0 rounded-lg bg-purple-100 p-1.5 sm:p-2 md:p-3 dark:bg-purple-900/30">
              <Calendar className="h-4 w-4 text-purple-600 sm:h-5 sm:w-5 md:h-6 md:w-6 dark:text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
