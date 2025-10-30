import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { Suspense } from "react"
import { Navbar } from "@/components/navbar"
import { createClient } from "@/lib/supabase/server"
import { NProgressProvider } from "@/components/nprogress-provider"
import { NProgressHandler } from "@/components/nprogress-handler"
import "./globals.css"

export const metadata: Metadata = {
  title: "ACOB Lighting Technology Limited Signature Creator",
  description: "Create professional email signatures for ACOB Lighting Technology Limited",
}

async function NavbarWrapper() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  // Fetch admin status from profile
  let isAdmin = false
  if (data?.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single()

    isAdmin = profile?.is_admin === true
  }

  return <Navbar user={data?.user ?? undefined} isAdmin={isAdmin} />
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <NProgressProvider />
            <NProgressHandler />
            <NavbarWrapper />
            {children}
            <Toaster />
          </ThemeProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
