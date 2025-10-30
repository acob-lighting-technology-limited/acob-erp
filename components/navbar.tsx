"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { LogOut, Menu, X, User, MessageSquare, LayoutDashboard, FileSignature, ShieldCheck } from "lucide-react"
import Image from "next/image"

interface NavbarProps {
  user?: {
    email?: string
    user_metadata?: {
      first_name?: string
    }
  }
  isAdmin?: boolean
}

export function Navbar({ user, isAdmin = false }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Logged out successfully")
    router.push("/auth/login")
  }

  // Extract initials from email (e.g., "i.chibuikem@..." -> "IC")
  const getInitials = (email?: string): string => {
    if (!email) return "U"

    const localPart = email.split("@")[0] // Get part before @
    const parts = localPart.split(".") // Split by dot

    if (parts.length >= 2) {
      // Get first letter of first part and first letter of second part
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }

    // Fallback: just use first two letters
    return localPart.substring(0, 2).toUpperCase()
  }

  return (
    <nav className="border-b border-border bg-background sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo space */}
            <div className="flex items-center gap-4">
              {/* <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <span className="text-sm font-bold text-green-700">ACOB</span>
              </div>
              <span className="hidden sm:inline text-sm font-semibold text-foreground">ACOB Lighting</span> */}
              <Image src="/acob-logo.webp" alt="ACOB Lighting" width={200} height={200} />
            </div>

            {/* Desktop menu */}
            <div className="hidden md:flex items-center gap-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {getInitials(user?.email)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Account</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/feedback" className="cursor-pointer">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Feedback
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/signature" className="cursor-pointer">
                      <FileSignature className="mr-2 h-4 w-4" />
                      Signature
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Admin
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile menu button */}
            <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile menu */}
          {isOpen && (
            <div className="md:hidden border-t border-border py-4 space-y-2">
              <div className="flex items-center gap-3 px-4 py-2 mb-2">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {getInitials(user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium">Account</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent rounded">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent rounded">
                <User className="h-4 w-4" />
                Profile
              </Link>
              <Link href="/feedback" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent rounded">
                <MessageSquare className="h-4 w-4" />
                Feedback
              </Link>
              <Link href="/signature" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent rounded">
                <FileSignature className="h-4 w-4" />
                Signature
              </Link>
              {isAdmin && (
                <>
                  <div className="border-t border-border my-2"></div>
                  <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent rounded">
                    <ShieldCheck className="h-4 w-4" />
                    Admin
                  </Link>
                </>
              )}
              <div className="border-t border-border my-2"></div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </nav>
  )
}
