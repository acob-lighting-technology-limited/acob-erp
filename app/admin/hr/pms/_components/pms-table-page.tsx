"use client"

import { useMemo, useState } from "react"
import { Brain, CheckCircle2, Clock3, Download, FileText, Search, ShieldCheck, Target } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type IconKey = "kpi" | "goals" | "attendance" | "cbt" | "behaviour" | "reviews"

type TableColumn = {
  key: string
  label: string
}

type TableRowData = Record<string, string | number | null | undefined>

interface PmsTablePageProps {
  title: string
  description: string
  backHref: string
  backLabel: string
  icon: IconKey
  tableTitle: string
  tableDescription: string
  rows: TableRowData[]
  columns: TableColumn[]
  searchPlaceholder?: string
}

const iconMap = {
  kpi: Target,
  goals: CheckCircle2,
  attendance: Clock3,
  cbt: Brain,
  behaviour: ShieldCheck,
  reviews: FileText,
}

function normalizeCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "-"
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return String(value)
}

export function PmsTablePage({
  title,
  description,
  backHref,
  backLabel,
  icon,
  tableTitle,
  tableDescription,
  rows,
  columns,
  searchPlaceholder = "Search records...",
}: PmsTablePageProps) {
  const Icon = iconMap[icon]
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  const departments = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => normalizeCell(row.department)).filter((department) => department !== "-"))
      ).sort(),
    [rows]
  )

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return rows.filter((row) => {
      const values = columns.map((column) => normalizeCell(row[column.key]).toLowerCase())
      const department = normalizeCell(row.department)
      const matchesQuery = query.length === 0 || values.some((value) => value.includes(query))
      const matchesDepartment = departmentFilter === "all" || department === departmentFilter
      return matchesQuery && matchesDepartment
    })
  }, [rows, columns, searchQuery, departmentFilter])

  function handleExport() {
    if (filteredRows.length === 0) return
    const header = ["S/N", ...columns.map((column) => column.label)].join(",")
    const body = filteredRows
      .map((row, index) =>
        [index + 1, ...columns.map((column) => normalizeCell(row[column.key]))]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n")
    const csv = `${header}\n${body}`
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title={title}
        description={description}
        icon={Icon}
        backLink={{ href: backHref, label: backLabel }}
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={filteredRows.length === 0}
            className="h-8 gap-2"
            size="sm"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      <Card className="mb-4 border-2">
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tableTitle}</CardTitle>
          <CardDescription>{tableDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">No records found.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Showing {filteredRows.length} of {rows.length} record(s).
              </p>
              <Table className="min-w-[1050px]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-16">S/N</TableHead>
                    {columns.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => (
                    <TableRow key={`${normalizeCell(row.department)}-${index}`}>
                      <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                      {columns.map((column) => (
                        <TableCell key={column.key}>{normalizeCell(row[column.key])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
