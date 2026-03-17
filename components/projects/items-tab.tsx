"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, Plus, Edit, Trash2 } from "lucide-react"
import { EmptyState } from "@/components/ui/patterns"
import type { ProjectItem } from "./project-data"

interface ItemsTabProps {
  items: ProjectItem[]
  getItemStatusColor: (status: string) => string
  onAddItem: () => void
  onEditItem: (item: ProjectItem) => void
  onDeleteItem: (item: ProjectItem) => void
}

export function ItemsTab({ items, getItemStatusColor, onAddItem, onEditItem, onDeleteItem }: ItemsTabProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Project Items</CardTitle>
          <CardDescription>Manage equipment and materials for this project</CardDescription>
        </div>
        <Button onClick={onAddItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            title="No items added yet"
            description='Click "Add Item" to get started.'
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
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => onEditItem(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => onDeleteItem(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
