"use client"

import { usePathname } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { AuthHeader } from "@/components/auth-header"

interface HeaderWrapperProps {
  user?: {
    email?: string
    user_metadata?: {
      first_name?: string
    }
  }
  isAdmin?: boolean
}

export function HeaderWrapper({ user, isAdmin = false }: HeaderWrapperProps) {
  const pathname = usePathname()

  // Don't show header on root page (shutdown page)
  if (pathname === "/") {
    return null
  }

  // Show simple header on auth pages
  const isAuthPage = pathname?.startsWith("/auth")

  if (isAuthPage) {
    return <AuthHeader />
  }

  return <Navbar user={user} isAdmin={isAdmin} />
}
