"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package } from "lucide-react"
import { EmptyState } from "@/components/ui/patterns"

interface ProjectItemReadOnly {
  id: string
  item_name: string
  description?: string
  quantity: number
  unit?: string
  status: string
  notes?: string
}

interface ProjectItemsReadTabProps {
  items: ProjectItemReadOnly[]
  getItemStatusColor: (status: string) => string
}

export function ProjectItemsReadTab({ items, getItemStatusColor }: ProjectItemsReadTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Items</CardTitle>
        <CardDescription>Equipment and materials for this project</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            title="No items added to this project yet"
            description="Project equipment and materials will appear here."
            icon={Package}
            className="border-0"
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-medium">{item.item_name}</p>
                      <Badge className={getItemStatusColor(item.status)}>{item.status}</Badge>
                    </div>
                    {item.description && <p className="text-muted-foreground mb-2 text-sm">{item.description}</p>}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Quantity: <span className="text-foreground font-medium">{item.quantity}</span>
                        {item.unit && ` ${item.unit}`}
                      </span>
                    </div>
                    {item.notes && <p className="text-muted-foreground mt-2 text-xs">Note: {item.notes}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
