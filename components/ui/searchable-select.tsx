"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  options: { value: string; label: string; icon?: React.ReactNode }[]
  searchPlaceholder?: string
  icon?: React.ReactNode
  className?: string
  disabled?: boolean
}

export function SearchableSelect({
  value,
  onValueChange,
  placeholder,
  options,
  searchPlaceholder = "Search...",
  icon,
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options
    return options.filter((option) => option.label.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [options, searchQuery])

  const selectedOption = options.find((opt) => opt.value === value)

  // Clear search when dropdown closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("")
    } else {
      // Focus the input when dropdown opens
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [open])

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "border-input ring-offset-background data-[placeholder]:text-muted-foreground focus:ring-ring flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        disabled={disabled}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span className="min-w-0 flex-1 truncate">
            <SelectPrimitive.Value placeholder={placeholder}>
              {selectedOption?.label || placeholder}
            </SelectPrimitive.Value>
          </span>
        </div>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-[300px] min-w-[8rem] overflow-hidden rounded-md border shadow-md"
          position="popper"
        >
          <div className="border-b p-2" onPointerDownOutside={(e) => e.preventDefault()}>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 transform z-10 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  const newValue = e.target.value
                  setSearchQuery(newValue)
                }}
                className="border-input file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-8 w-full rounded-md border bg-transparent pl-8 pr-2 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                onClick={(e) => {
                  e.stopPropagation()
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  // Allow Escape to close the dropdown
                  if (e.key === "Escape") {
                    setOpen(false)
                  }
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                }}
                autoFocus
              />
            </div>
          </div>
          <SelectPrimitive.Viewport className="max-h-[250px] overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  onSelect={() => {
                    setSearchQuery("")
                    setOpen(false)
                  }}
                >
                  <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                    <SelectPrimitive.ItemText className="truncate">{option.label}</SelectPrimitive.ItemText>
                  </div>
                </SelectPrimitive.Item>
              ))
            ) : (
              <div className="text-muted-foreground py-6 text-center text-sm">No results found</div>
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
