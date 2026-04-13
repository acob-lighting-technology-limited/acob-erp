"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader, PageWrapper } from "@/components/layout"
import type { DataTablePageProps } from "./types"

/**
 * Standard full-page layout wrapper for ALL table pages in this app.
 *
 * Layout order (fixed — never rearrange):
 *   1. Page header  — title · icon · back link · action buttons (Add / Export / etc.)
 *   2. Tabs         — optional, only when a page has multiple named views
 *   3. Stats cards  — optional, key metrics at a glance
 *   4. Children     — <DataTable> (includes search, filters, toolbar, table, pagination)
 */
export function DataTablePage({
  title,
  description,
  icon,
  backLink,
  actions,
  tabs,
  activeTab,
  onTabChange,
  stats,
  children,
}: DataTablePageProps) {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      {/* 1 ── Header */}
      <PageHeader title={title} description={description} icon={icon} backLink={backLink} actions={actions} />

      {/* 2 ── Tabs */}
      {tabs && tabs.length > 0 && activeTab && onTabChange && (
        <Tabs value={activeTab} onValueChange={onTabChange} className="mb-4">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.icon && <tab.icon className="mr-1.5 h-4 w-4" />}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* 3 ── Stats */}
      {stats && <div className="mb-4">{stats}</div>}

      {/* 4 ── Table content */}
      <div className="space-y-4">{children}</div>
    </PageWrapper>
  )
}
