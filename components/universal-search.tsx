"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import {
  Search,
  Loader2,
  User,
  Laptop,
  Package,
  ClipboardList,
  FileText,
  MessageSquare,
  LifeBuoy,
  CalendarDays,
  Mail,
  Banknote,
  Building2,
  MapPin,
  X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"

type SearchType =
  | "profile"
  | "device"
  | "asset"
  | "task"
  | "documentation"
  | "feedback"
  | "helpdesk"
  | "leave"
  | "correspondence"
  | "payment"
  | "department"
  | "office_location"

interface SearchResult {
  id: string
  type: SearchType
  title: string
  subtitle?: string
  description?: string
  href: string
  metadata?: Record<string, unknown>
}

interface UniversalSearchProps {
  isAdminMode?: boolean
}

const typeIcons: Record<SearchType, typeof User> = {
  profile: User,
  device: Laptop,
  asset: Package,
  task: ClipboardList,
  documentation: FileText,
  feedback: MessageSquare,
  helpdesk: LifeBuoy,
  leave: CalendarDays,
  correspondence: Mail,
  payment: Banknote,
  department: Building2,
  office_location: MapPin,
}

const typeLabels: Record<SearchType, string> = {
  profile: "Employee",
  device: "Device",
  asset: "Asset",
  task: "Task",
  documentation: "Documentation",
  feedback: "Feedback",
  helpdesk: "Help Desk",
  leave: "Leave",
  correspondence: "Correspondence",
  payment: "Payment",
  department: "Department",
  office_location: "Room / Office",
}

async function performSearch(q: string, deptId?: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q })
  if (deptId) params.set("dept", deptId)
  const response = await fetch(`/api/search?${params.toString()}`)
  if (!response.ok) throw new Error("Search failed")
  const data = await response.json()
  return data.results || []
}

export function UniversalSearch({ isAdminMode = false }: UniversalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const router = useRouter()
  const pathname = usePathname()
  // When searching from inside the dept console (/dept/[id]/…), pass the dept
  // id so the API scopes results to that department and routes links there.
  const deptId = useMemo(() => pathname?.match(/^\/dept\/([^/]+)/)?.[1], [pathname])
  const isDeptRoute = Boolean(deptId)
  const isAdminRoute = Boolean(pathname?.startsWith("/admin"))
  const isScoped = isAdminMode || isAdminRoute || isDeptRoute
  const scopeMode = isDeptRoute ? "lead" : isAdminRoute || isAdminMode ? "global" : undefined

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

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: results = [], isFetching: loading } = useQuery({
    queryKey: [QUERY_KEYS.search(debouncedQuery), deptId ?? "global"],
    queryFn: () => performSearch(debouncedQuery, deptId),
    enabled: open && debouncedQuery.trim().length > 0,
    staleTime: 30 * 1000,
  })

  const handleResultClick = (result: SearchResult) => {
    router.push(result.href)
    setOpen(false)
    setQuery("")
    setDebouncedQuery("")
  }

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "group text-muted-foreground border-input/60 bg-muted/40 hover:bg-muted/80 hover:border-input hover:text-foreground relative h-9.5 w-full justify-start text-sm font-normal transition-all duration-200 sm:pr-12 md:w-64 lg:w-80",
          isScoped &&
            "border-[var(--navbar-admin-sidebar-border,var(--admin-sidebar-border))] bg-[var(--navbar-admin-accent-soft,var(--admin-accent-soft))] text-[var(--navbar-admin-primary,var(--admin-primary))] hover:bg-[var(--navbar-admin-accent-soft,var(--admin-accent-soft))]/80 hover:text-[var(--navbar-admin-primary,var(--admin-primary))]"
        )}
        onClick={() => setOpen(true)}
      >
        <Search
          className={cn(
            "text-muted-foreground group-hover:text-foreground mr-2 h-4 w-4 transition-colors",
            isScoped &&
              "text-[var(--navbar-admin-primary,var(--admin-primary))] group-hover:text-[var(--navbar-admin-primary,var(--admin-primary))]"
          )}
        />
        <span className="group-hover:text-foreground transition-colors">Search anything...</span>
        <kbd
          className={cn(
            "border-border/60 bg-background/80 text-muted-foreground group-hover:border-border group-hover:bg-background group-hover:text-foreground pointer-events-none absolute top-1.5 right-1.5 hidden h-6 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium transition-colors select-none sm:flex",
            isScoped &&
              "bg-background/40 group-hover:bg-background/60 border-[var(--navbar-admin-sidebar-border,var(--admin-sidebar-border))] text-[var(--navbar-admin-primary,var(--admin-primary))]"
          )}
        >
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn("max-w-2xl overflow-hidden p-0", isScoped && "admin-shell")}
          data-scope={scopeMode}
        >
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-foreground text-lg font-semibold">Search</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search employees, assets, tasks, tickets, leave, correspondence, payments..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="focus-visible:ring-primary focus-visible:border-primary/50 pl-9"
                autoFocus
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                  onClick={() => {
                    setQuery("")
                    setDebouncedQuery("")
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
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            )}

            {!loading && query && results.length === 0 && (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No results found for &quot;{query}&quot;
              </div>
            )}

            {!loading && !query && (
              <div className="text-muted-foreground py-8 text-center text-sm">Start typing to search...</div>
            )}

            {!loading && results.length > 0 && (
              <div className="space-y-1.5">
                {results.map((result) => {
                  const Icon = typeIcons[result.type]
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="group border-border/80 bg-card/60 hover:border-primary/50 hover:bg-primary/5 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150 hover:shadow-xs"
                    >
                      <div className="bg-primary/10 text-primary group-hover:bg-primary/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <p className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
                            {result.title}
                          </p>
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 text-primary text-[11px] font-medium"
                          >
                            {typeLabels[result.type]}
                          </Badge>
                        </div>
                        {result.subtitle && <p className="text-muted-foreground truncate text-sm">{result.subtitle}</p>}
                        {result.description && (
                          <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">{result.description}</p>
                        )}
                      </div>
                      <span className="text-primary shrink-0 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                        Open →
                      </span>
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
