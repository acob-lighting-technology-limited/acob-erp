"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Loader2, User, Laptop, Package, ClipboardList, FileText, MessageSquare, Building2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface SearchResult {
  id: string
  type: "profile" | "device" | "asset" | "task" | "documentation" | "feedback"
  title: string
  subtitle?: string
  description?: string
  href: string
  metadata?: Record<string, any>
}

const typeIcons = {
  profile: User,
  device: Laptop,
  asset: Package,
  task: ClipboardList,
  documentation: FileText,
  feedback: MessageSquare,
}

const typeLabels = {
  profile: "Staff",
  device: "Device",
  asset: "Asset",
  task: "Task",
  documentation: "Documentation",
  feedback: "Feedback",
}

export function UniversalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Search function with debounce
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) throw new Error("Search failed")
      const data = await response.json()
      setResults(data.results || [])
    } catch (error) {
      console.error("Search error:", error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open && query) {
        performSearch(query)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, open, performSearch])

  const handleResultClick = (result: SearchResult) => {
    router.push(result.href)
    setOpen(false)
    setQuery("")
    setResults([])
  }

  return (
    <>
      <Button
        variant="outline"
        className="relative h-10 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-64 lg:w-80"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span>Search anything...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search staff, devices, assets, tasks, documentation, feedback..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                  onClick={() => {
                    setQuery("")
                    setResults([])
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto px-6 pb-6">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found for &quot;{query}&quot;
              </div>
            )}

            {!loading && !query && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Start typing to search...
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="space-y-1">
                {results.map((result) => {
                  const Icon = typeIcons[result.type]
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                        "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{result.title}</p>
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[result.type]}
                          </Badge>
                        </div>
                        {result.subtitle && (
                          <p className="text-sm text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                        )}
                        {result.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                            {result.description}
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

