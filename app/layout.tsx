import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { Suspense } from "react"
import { HeaderWrapper } from "@/components/header-wrapper"
import { SidebarProvider } from "@/components/sidebar-context"
import { createClient } from "@/lib/supabase/server"
import { NProgressProvider } from "@/components/nprogress-provider"
import { NProgressHandler } from "@/components/nprogress-handler"
import { cookies } from "next/headers"
import "./globals.css"

export const metadata: Metadata = {
  title: "ACOB Lighting Technology Limited Signature Creator",
  description: "Create professional email signatures for ACOB Lighting Technology Limited",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

async function HeaderWrapperWithData() {
  const cookieStore = await cookies()
  const bypassCookie = cookieStore.get("shutdown_bypass")
  
  // Don't show header if no bypass cookie (shutdown mode)
  if (!bypassCookie || bypassCookie.value !== "true") {
    return null
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  // Fetch admin status from profile
  let isAdmin = false
  if (data?.user) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single()

    isAdmin = profile?.is_admin === true
  }

  // Serialize only the necessary user data to avoid hydration issues
  const userData = data?.user
    ? {
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      }
    : undefined

  return <HeaderWrapper user={userData} isAdmin={isAdmin} />
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} overflow-x-hidden`}>
        <Suspense fallback={null}>
          {/* Theme follows system preference automatically (light/dark mode) */}
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem enableColorScheme storageKey="acob-theme">
            <SidebarProvider>
              <NProgressProvider />
              <NProgressHandler />
              <HeaderWrapperWithData />
              {children}
              <Toaster />
            </SidebarProvider>
          </ThemeProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
