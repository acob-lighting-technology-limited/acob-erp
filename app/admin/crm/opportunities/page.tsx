"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Plus,
  Search,
  DollarSign,
  Target,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Building2,
} from "lucide-react"
import Link from "next/link"
import type { CRMOpportunity, CRMPipeline } from "@/types/crm"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount)
}

const stageColors: Record<string, string> = {
  new: "border-l-gray-400",
  qualified: "border-l-blue-500",
  proposal: "border-l-indigo-500",
  negotiation: "border-l-orange-500",
  won: "border-l-green-500",
  lost: "border-l-red-500",
}

interface PipelineStage {
  name: string
  order: number
  probability: number
}

export default function OpportunitiesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [opportunities, setOpportunities] = useState<CRMOpportunity[]>([])
  const [pipeline, setPipeline] = useState<CRMPipeline | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("open")
  const [view, setView] = useState<"kanban" | "list">("kanban")

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const loadData = async () => {
    try {
      setIsLoading(true)

      // Load pipeline and opportunities in parallel
      const [pipelineRes, opportunitiesRes] = await Promise.all([
        fetch("/api/crm/pipelines"),
        fetch(`/api/crm/opportunities?status=${statusFilter}${search ? `&search=${search}` : ""}`),
      ])

      const pipelineData = await pipelineRes.json()
      const opportunitiesData = await opportunitiesRes.json()

      if (pipelineData.data?.length > 0) {
        // Get default pipeline or first one
        const defaultPipeline = pipelineData.data.find((p: CRMPipeline) => p.is_default) || pipelineData.data[0]
        setPipeline(defaultPipeline)
      }

      setOpportunities(opportunitiesData.data || [])
    } catch (error: any) {
      console.error("Error loading data:", error)
      toast.error("Failed to load opportunities")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStageChange = async (opportunityId: string, newStage: string) => {
    try {
      const response = await fetch(`/api/crm/opportunities/${opportunityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      toast.success("Stage updated")
      loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to update stage")
    }
  }

  const handleStatusChange = async (opportunityId: string, status: "won" | "lost") => {
    try {
      const response = await fetch(`/api/crm/opportunities/${opportunityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }

      toast.success(`Opportunity marked as ${status}`)
      loadData()
    } catch (error: any) {
      toast.error(error.message || "Failed to update status")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this opportunity?")) return

    try {
      const response = await fetch(`/api/crm/opportunities/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete")
      toast.success("Opportunity deleted")
      loadData()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const stages: PipelineStage[] = pipeline?.stages || [
    { name: "New", order: 1, probability: 10 },
    { name: "Qualified", order: 2, probability: 25 },
    { name: "Proposal", order: 3, probability: 50 },
    { name: "Negotiation", order: 4, probability: 75 },
  ]

  const getOpportunitiesByStage = (stageName: string) => {
    return opportunities.filter((o) => o.stage?.toLowerCase() === stageName.toLowerCase())
  }

  const getTotalByStage = (stageName: string) => {
    return getOpportunitiesByStage(stageName).reduce((sum, o) => sum + (o.value || 0), 0)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Opportunities</h1>
          <p className="text-muted-foreground">Track and manage your sales pipeline</p>
        </div>
        <Link
          href="/admin/crm/opportunities/new"
          className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Opportunity
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search opportunities..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadData()}
                  className="pl-9"
                />
              </div>
              <Button variant="secondary" onClick={loadData}>
                Search
              </Button>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Total Opportunities</p>
            <p className="text-2xl font-bold">{opportunities.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Total Value</p>
            <p className="text-2xl font-bold">
              {formatCurrency(opportunities.reduce((sum, o) => sum + (o.value || 0), 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Weighted Value</p>
            <p className="text-2xl font-bold">
              {formatCurrency(opportunities.reduce((sum, o) => sum + (o.weighted_value || 0), 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-sm">Avg Deal Size</p>
            <p className="text-2xl font-bold">
              {formatCurrency(
                opportunities.length > 0
                  ? opportunities.reduce((sum, o) => sum + (o.value || 0), 0) / opportunities.length
                  : 0
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      {statusFilter === "open" ? (
        <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-4 md:grid-cols-2 lg:grid-cols-4">
          {stages.slice(0, -2).map((stage) => {
            const stageOpps = getOpportunitiesByStage(stage.name)
            const stageTotal = getTotalByStage(stage.name)
            const stageKey = stage.name.toLowerCase()

            return (
              <div key={stage.name} className="min-w-[280px]">
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{stage.name}</h3>
                    <Badge variant="secondary">{stage.probability}%</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {stageOpps.length} deals • {formatCurrency(stageTotal)}
                  </p>
                </div>

                <div className="space-y-3">
                  {stageOpps.map((opp) => (
                    <Card
                      key={opp.id}
                      className={`border-l-4 ${stageColors[stageKey] || "border-l-gray-400"} cursor-pointer transition-shadow hover:shadow-md`}
                    >
                      <CardContent className="p-4">
                        <div className="mb-2 flex items-start justify-between">
                          <Link href={`/admin/crm/opportunities/${opp.id}`} className="flex-1">
                            <p className="hover:text-primary font-medium">{opp.name}</p>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/admin/crm/opportunities/${opp.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleStatusChange(opp.id, "won")}>
                                Mark as Won
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(opp.id, "lost")}>
                                Mark as Lost
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(opp.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {opp.contact && (
                          <p className="text-muted-foreground mb-2 flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3" />
                            {opp.contact.company_name || opp.contact.contact_name}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-lg font-semibold">{formatCurrency(opp.value)}</p>
                          {opp.expected_close && (
                            <p className="text-muted-foreground text-xs">
                              {new Date(opp.expected_close).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        {/* Stage navigation */}
                        <div className="mt-3 flex gap-1">
                          {stages.slice(0, -2).map((s, i) => {
                            const isActive = s.name.toLowerCase() === opp.stage?.toLowerCase()
                            const isPast =
                              stages.findIndex((st) => st.name.toLowerCase() === opp.stage?.toLowerCase()) > i
                            return (
                              <button
                                key={s.name}
                                onClick={() => handleStageChange(opp.id, s.name)}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${
                                  isActive ? "bg-primary" : isPast ? "bg-primary/40" : "bg-muted"
                                }`}
                                title={`Move to ${s.name}`}
                              />
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {stageOpps.length === 0 && (
                    <div className="text-muted-foreground rounded-lg border-2 border-dashed p-4 text-center text-sm">
                      No opportunities
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List view for won/lost */
        <Card>
          <CardContent className="p-0">
            {opportunities.length > 0 ? (
              <div className="divide-y">
                {opportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/admin/crm/opportunities/${opp.id}`}
                    className="hover:bg-muted/50 flex items-center justify-between p-4 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{opp.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {opp.contact?.company_name || opp.contact?.contact_name || "No contact"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(opp.value)}</p>
                      <Badge variant={opp.status === "won" ? "default" : "destructive"}>{opp.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground p-12 text-center">
                <Target className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No {statusFilter} opportunities</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
