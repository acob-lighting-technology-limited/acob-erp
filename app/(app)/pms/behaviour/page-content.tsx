"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function BehaviourContent({
  rows,
  average,
  cycle,
  strengths,
  areasForImprovement,
  managerComments,
}: {
  rows: Array<{ competency: string; value: number }>
  average: number | null
  cycle: string
  strengths: string
  areasForImprovement: string
  managerComments: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS Behaviour"
        description="Your behaviour review by competency, with manager notes under the expandable section."
        icon={ShieldCheck}
        backLink={{ href: "/pms", label: "Back to PMS" }}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Competencies</p>
            <p className="text-2xl font-semibold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Average</p>
            <p className="text-2xl font-semibold">{average === null ? "-" : `${average}%`}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">Comments</p>
            <p className="text-2xl font-semibold">
              {[strengths, areasForImprovement, managerComments].filter(Boolean).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Behaviour Competencies</CardTitle>
          <CardDescription>
            Expand the row below to see strengths, areas for improvement, and manager comments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-end">
            <Select value={cycle || "-"} onValueChange={() => undefined}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={cycle || "-"}>{cycle || "-"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
                <TableRow>
                  <TableHead className="w-16">S/N</TableHead>
                  {rows.map((row) => (
                    <TableHead key={row.competency}>{row.competency}</TableHead>
                  ))}
                  <TableHead>Average</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground font-medium">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto px-0 py-0 font-semibold hover:bg-transparent hover:text-inherit"
                      onClick={() => setExpanded((current) => !current)}
                    >
                      {expanded ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}1
                    </Button>
                  </TableCell>
                  {rows.map((row) => (
                    <TableCell key={row.competency}>{String(row.value).padStart(2, "0")}</TableCell>
                  ))}
                  <TableCell className="font-medium">{average === null ? "-" : `${average}%`}</TableCell>
                </TableRow>
                {expanded ? (
                  <TableRow>
                    <TableCell colSpan={rows.length + 2} className="px-0">
                      <div className="px-4 py-3">
                        <div className="space-y-3 rounded-lg border p-4">
                          <div>
                            <p className="text-sm font-semibold">Strengths</p>
                            <p className="text-muted-foreground text-sm">{strengths || "-"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold">Areas for Improvement</p>
                            <p className="text-muted-foreground text-sm">{areasForImprovement || "-"}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold">Manager Comments</p>
                            <p className="text-muted-foreground text-sm">{managerComments || "-"}</p>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
