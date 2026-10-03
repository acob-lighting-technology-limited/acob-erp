"use client"
import { SlidersHorizontal as FiltersIcon, Search, SlidersHorizontal, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { useDataTableState } from "./use-data-table-state"

export function DataTableToolbar<TData>({ state }: { state: ReturnType<typeof useDataTableState<TData>> }) {
  const {
    columns,
    searchPlaceholder,
    searchDisabled,
    filters,
    columnToggle,
    stickyToolbar,
    searchInput,
    setSearchInput,
    filterValues,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    setManualViewMode,
    contactsAvailable,
    viewMode,
    responsivePair,
    toolbarRef,
    hiddenColumns,
    setHiddenColumns,
    activeFilterPills,
    handleFilterChange,
    clearAllFilters,
    viewOptions,
    showViewToggle,
    showToolbar,
  } = state
  const toolbar = showToolbar ? (
    <div
      ref={toolbarRef}
      className={cn(
        "space-y-3 p-4",
        // Clears the app bar and any sticky app banner. Card has no overflow of its
        // own, so the sticky context is the page scroller, which is what we want.
        stickyToolbar && "bg-card/95 sticky top-[calc(4rem+var(--app-banner-h,0px))] z-20 rounded-t-xl backdrop-blur-md"
      )}
    >
      {/* Row 1: search + column toggle + view toggle */}
      <div className="flex items-center gap-2">
        {!searchDisabled && (
          <div className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder={searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pr-9 pl-10"
              aria-label="Search"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {/* Mobile filters: one button + sheet, instead of a stack of selects */}
          {filters.length > 0 && (
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-9 w-9 md:hidden" aria-label="Filters">
                  <FiltersIcon className="h-4 w-4" />
                  {activeFilterPills.length > 0 && (
                    <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold">
                      {activeFilterPills.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 sm:px-6">
                <div className="mx-auto w-full max-w-lg space-y-4 py-2">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3 pb-2">
                    {filters.map((filter) => (
                      <div key={filter.key} className="space-y-1.5">
                        <p className="text-muted-foreground text-xs font-medium">{filter.label}</p>
                        {filter.render ? (
                          filter.render(filterValues[filter.key] ?? [], (vals) => handleFilterChange(filter.key, vals))
                        ) : filter.multi === false ? (
                          <Select
                            value={filterValues[filter.key]?.[0] ?? "all"}
                            onValueChange={(val) => handleFilterChange(filter.key, val === "all" ? [] : [val])}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={filter.placeholder ?? filter.label} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{filter.placeholder ?? `All ${filter.label}`}</SelectItem>
                              {filter.options.map((opt: { value: string; label: string }) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <SearchableMultiSelect
                            label={filter.label}
                            icon={filter.icon}
                            values={filterValues[filter.key] ?? []}
                            options={filter.options}
                            onChange={(vals) => handleFilterChange(filter.key, vals)}
                            placeholder={filter.placeholder ?? `All ${filter.label}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <SheetFooter className="flex-row gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={clearAllFilters}>
                      Clear all
                    </Button>
                    <SheetClose asChild>
                      <Button className="flex-1">Apply</Button>
                    </SheetClose>
                  </SheetFooter>
                </div>
              </SheetContent>
            </Sheet>
          )}

          {columnToggle && columns.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden h-9 gap-2 md:inline-flex">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Columns</span>
                  {hiddenColumns.size > 0 && (
                    <Badge variant="secondary" className="h-5 px-1 text-xs">
                      {hiddenColumns.size}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={!hiddenColumns.has(col.key)}
                    onCheckedChange={(checked) => {
                      setHiddenColumns((prev) => {
                        const next = new Set(prev)
                        if (checked) {
                          next.delete(col.key)
                        } else {
                          next.add(col.key)
                        }
                        return next
                      })
                    }}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {hiddenColumns.size > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={false}
                      onCheckedChange={() => setHiddenColumns(new Set())}
                      className="text-primary font-medium"
                    >
                      <Check className="mr-2 h-3.5 w-3.5" />
                      Show all
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Row 2: filter dropdowns (desktop) with the view switcher pinned right.
          On mobile the filters live in the sheet from row 1, so this row carries
          just the switcher — stretched full-width, since a lone control hugging
          the right edge leaves a dead half-row. */}
      {(filters.length > 0 || showViewToggle) && (
        <div className="flex items-center gap-2">
          <div className="hidden grid-cols-2 gap-2 md:grid md:flex-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {filters.map((filter) =>
              filter.render ? (
                <div key={filter.key}>
                  {filter.render(filterValues[filter.key] ?? [], (vals) => handleFilterChange(filter.key, vals))}
                </div>
              ) : filter.multi === false ? (
                <Select
                  key={filter.key}
                  value={filterValues[filter.key]?.[0] ?? "all"}
                  onValueChange={(val) => handleFilterChange(filter.key, val === "all" ? [] : [val])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={filter.placeholder ?? filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{filter.placeholder ?? `All ${filter.label}`}</SelectItem>
                    {filter.options.map((opt: { value: string; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <SearchableMultiSelect
                  key={filter.key}
                  label={filter.label}
                  icon={filter.icon}
                  values={filterValues[filter.key] ?? []}
                  options={filter.options}
                  onChange={(vals) => handleFilterChange(filter.key, vals)}
                  placeholder={filter.placeholder ?? `All ${filter.label}`}
                />
              )
            )}
          </div>

          <div className="w-full md:ml-auto md:w-auto md:shrink-0">
            {/* Segmented view switcher. Desktop-only unless the page offers the
                contacts list, which is a mode phones need to reach as well. */}
            {showViewToggle && (
              <div
                className={cn(
                  // Identical surface to the selects beside it: `border-input` over
                  // transparent, so it picks up the card underneath rather than the
                  // page background (which is a shade darker and reads as dull).
                  "border-input h-9 items-center rounded-lg border bg-transparent p-1",
                  contactsAvailable ? "flex w-full md:inline-flex md:w-auto md:shrink-0" : "hidden md:inline-flex"
                )}
                role="group"
                aria-label="View mode"
              >
                {viewOptions.map(({ key, label, Icon, hint }) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setManualViewMode(key)}
                        className={cn(
                          "inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors md:flex-none",
                          // While the body is CSS-resolved, so is the pressed state —
                          // otherwise the highlight says "Table" for a frame on a phone
                          // that is already showing the list.
                          responsivePair
                            ? cn(
                                key === "contacts"
                                  ? "bg-muted text-foreground md:text-muted-foreground shadow-xs md:bg-transparent md:shadow-none"
                                  : "text-muted-foreground hover:text-foreground",
                                key === "list" && "md:bg-muted md:text-foreground md:shadow-xs"
                              )
                            : viewMode === key
                              ? "bg-muted text-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-label={`${label} view`}
                        // aria-pressed cannot vary by media query; it reports the
                        // desktop mode, which is what the first paint renders.
                        aria-pressed={responsivePair ? key === "list" : viewMode === key}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className={cn(contactsAvailable ? "inline" : "hidden lg:inline")}>{label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{hint || `${label} view`}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null

  // ─── Status bar: pills + row count + bulk actions ────────────────────────

  return toolbar
}
