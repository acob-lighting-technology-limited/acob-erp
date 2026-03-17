"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Plus } from "lucide-react"

interface DocEmptyStateProps {
  hasFilters: boolean
  onCreateClick: () => void
}

export function DocEmptyState({ hasFilters, onCreateClick }: DocEmptyStateProps) {
  return (
    <Card className="border-2">
      <CardContent className="p-12 text-center">
        <FileText className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">
          {hasFilters ? "No documents found" : "No documentation yet"}
        </h3>
        <p className="text-muted-foreground mb-4">
          {hasFilters ? "Try adjusting your filters or search query" : "Create your first document to get started"}
        </p>
        {!hasFilters && (
          <Button onClick={onCreateClick} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Document
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
