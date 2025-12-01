"use client"

import * as React from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface SearchableMultiSelectProps {
  label: string
  icon?: React.ReactNode
  values: string[]
  options: { value: string; label: string; icon?: React.ReactNode }[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
}

export function SearchableMultiSelect({
  label,
  icon,
  values,
  options,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
}: SearchableMultiSelectProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options
    return options.filter((option) => option.label.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [options, searchQuery])

  const toggleValue = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value))
    } else {
      onChange([...values, value])
    }
  }

  const removeValue = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(values.filter((v) => v !== value))
  }

  const selectedOptions = options.filter((opt) => values.includes(opt.value))

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "border-input ring-offset-background focus:ring-ring flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span className="min-w-0 flex-1 truncate text-left">
              {selectedOptions.length > 0 ? (
                <span className="text-muted-foreground text-xs">
                  {selectedOptions.length} selected
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-hidden rounded-md border shadow-md"
          align="start"
        >
          <div className="border-b p-2">
            <div className="mb-2 flex items-center gap-2">
              {icon && <span className="flex-shrink-0">{icon}</span>}
              <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            {selectedOptions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="text-xs"
                    onClick={(e) => removeValue(option.value, e)}
                  >
                    {option.label}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="max-h-[250px] overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = values.includes(option.value)
                return (
                  <div
                    key={option.value}
                    onClick={() => toggleValue(option.value)}
                    className={cn(
                      "group relative flex w-full cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-8 text-sm outline-none transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "dark:hover:bg-accent dark:hover:text-foreground",
                      isSelected && "bg-accent/50"
                    )}
                  >
                    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                      {isSelected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <div className="h-4 w-4 rounded border border-input" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                      <span className="truncate">{option.label}</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-muted-foreground py-6 text-center text-sm">No results found</div>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}






