"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"

const CATEGORIES = [
  "Project Documentation",
  "Meeting Notes",
  "Process Documentation",
  "Technical Guides",
  "Reports",
  "Training Materials",
  "Other",
]

interface DocFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryChange: (value: string) => void
}

export function DocFilterBar({ searchQuery, onSearchChange, categoryFilter, onCategoryChange }: DocFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="min-w-[200px] flex-1">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      <Select value={categoryFilter} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Filter by category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Documents</SelectItem>
          <SelectItem value="published">Published</SelectItem>
          <SelectItem value="draft">Drafts</SelectItem>
          {CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
