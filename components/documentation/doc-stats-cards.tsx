"use client"

import { Card, CardContent } from "@/components/ui/card"
import { FileText, Eye, EyeOff } from "lucide-react"

interface DocStatsCardsProps {
  total: number
  published: number
  draft: number
}

export function DocStatsCards({ total, published, draft }: DocStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
      <Card className="border-2">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">
                Total Documents
              </p>
              <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{total}</p>
            </div>
            <FileText className="h-5 w-5 shrink-0 text-blue-600 sm:h-6 sm:w-6 md:h-8 md:w-8 dark:text-blue-400" />
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
            <Eye className="h-5 w-5 shrink-0 text-green-600 sm:h-6 sm:w-6 md:h-8 md:w-8 dark:text-green-400" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-2">
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[10px] font-medium sm:text-xs md:text-sm">Drafts</p>
              <p className="text-foreground mt-1 text-lg font-bold sm:text-xl md:mt-2 md:text-3xl">{draft}</p>
            </div>
            <EyeOff className="h-5 w-5 shrink-0 text-yellow-600 sm:h-6 sm:w-6 md:h-8 md:w-8 dark:text-yellow-400" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
