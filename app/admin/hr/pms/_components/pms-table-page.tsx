"use client"

import { useMemo, useState } from "react"
import { Brain, CheckCircle2, Clock3, Download, FileText, Search, ShieldCheck, Target } from "lucide-react"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExportOptionsDialog } from "@/components/admin/export-options-dialog"
import { exportPmsRowsToExcel, exportPmsRowsToPdf } from "@/lib/pms/export"

type IconKey = "kpi" | "goals" | "attendance" | "cbt" | "behaviour" | "reviews"
type TableColumn = { key: string; label: string }
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
  summaryCards?: Array<{ label: string; value: string | number }>
  filterKey?: string
  filterLabel?: string
  filterAllLabel?: string
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
  summaryCards = [],
  filterKey = "department",
  filterLabel = "Department",
  filterAllLabel = "All Departments",
}: PmsTablePageProps) {
  const Icon = iconMap[icon]
  const [searchQuery, setSearchQuery] = useState("")
  const [secondaryFilter, setSecondaryFilter] = useState("all")
  const [isExportOpen, setIsExportOpen] = useState(false)

  const secondaryFilterOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => normalizeCell(row[filterKey])).filter((option) => option !== "-"))).sort(),
    [rows, filterKey]
  )

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return rows.filter((row) => {
      const values = columns.map((column) => normalizeCell(row[column.key]).toLowerCase())
      const filterValue = normalizeCell(row[filterKey])
      const matchesQuery = query.length === 0 || values.some((value) => value.includes(query))
      const matchesSecondary = secondaryFilter === "all" || filterValue === secondaryFilter
      return matchesQuery && matchesSecondary
    })
  }, [rows, columns, filterKey, searchQuery, secondaryFilter])

  const exportRows = filteredRows.map((row, index) =>
    Object.fromEntries([["S/N", index + 1], ...columns.map((column) => [column.label, normalizeCell(row[column.key])])])
  )

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
            onClick={() => setIsExportOpen(true)}
            disabled={filteredRows.length === 0}
            className="h-8 gap-2"
            size="sm"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        }
      />

      {summaryCards.length > 0 ? (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">{card.label}</p>
                <p className="text-2xl font-semibold">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

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
            <Select value={secondaryFilter} onValueChange={setSecondaryFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder={filterLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{filterAllLabel}</SelectItem>
                {secondaryFilterOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
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
              <div className="overflow-x-auto">
                <Table className="min-w-[1050px]">
                  <TableHeader className="bg-emerald-50 dark:bg-emerald-950/30">
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
            </div>
          )}
        </CardContent>
      </Card>

      <ExportOptionsDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        title={`Export ${title}`}
        options={[
          { id: "excel", label: "Excel (.xlsx)", icon: "excel" },
          { id: "pdf", label: "PDF", icon: "pdf" },
        ]}
        onSelect={(id) => {
          const filename = `${title.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}`
          if (id === "excel") {
            void exportPmsRowsToExcel(exportRows, filename)
            return
          }
          void exportPmsRowsToPdf(exportRows, filename, title)
        }}
      />
    </PageWrapper>
  )
}
