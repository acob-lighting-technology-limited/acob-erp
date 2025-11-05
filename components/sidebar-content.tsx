"use client"

import { useSidebar } from "./sidebar-context"
import { cn } from "@/lib/utils"

export function SidebarContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()

  return (
    <main
      className={cn(
        "flex-1 transition-all duration-300",
        isCollapsed ? "lg:pl-20" : "lg:pl-64"
      )}
    >
      <div className="lg:hidden h-16" /> {/* Spacer for mobile header */}
      {children}
    </main>
  )
}

