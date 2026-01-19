"use client"

import { SidebarProvider } from "@/components/sidebar-context"

interface PortalLayoutProps {
  children: React.ReactNode
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  return <SidebarProvider>{children}</SidebarProvider>
}
