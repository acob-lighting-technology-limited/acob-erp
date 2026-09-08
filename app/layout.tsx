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
import { resolveAdminScope } from "@/lib/admin/rbac"
import { NProgressProvider } from "@/components/nprogress-provider"
import { NProgressHandler } from "@/components/nprogress-handler"
import { ClientErrorMonitor } from "@/components/telemetry/client-error-monitor"
import { QueryProvider } from "@/providers/query-provider"
import { SeasonalFaviconSwitcher } from "@/components/seasonal-favicon-switcher"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { getAvatarSignedUrl } from "@/lib/profile-photos"
import "./globals.css"

export const metadata: Metadata = {
  title: "Matrix",
  description: "Matrix — the internal workspace platform for ACOB Lighting Technology Limited",
  applicationName: "Matrix",
  manifest: "/manifest.webmanifest",
  // iOS ignores the manifest's icons and name for home-screen installs, so the
  // Apple-specific tags below are what actually control the installed app.
  appleWebApp: {
    capable: true,
    title: "Matrix",
    // "default" keeps the status bar opaque so iOS lays content out below it.
    // "black-translucent" would render the header under the notch, because
    // nothing in the app pads for env(safe-area-inset-top) yet.
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Standalone mode paints the status bar and gesture area with this, so it
  // has to track the active theme or one of the two modes looks wrong.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f0ee" },
    { media: "(prefers-color-scheme: dark)", color: "#080707" },
  ],
  // Fills the iOS safe areas (notch / home indicator) once the app runs
  // full-screen, which only happens after Add to Home Screen.
  viewportFit: "cover",
}

async function HeaderWrapperWithData() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  // Only show header for authenticated users
  if (!data?.user) {
    return null
  }

  const canAccessAdmin = Boolean(await resolveAdminScope(supabase, data.user.id))

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const { data: profile } = await dataClient
    .from("profiles")
    .select("avatar_path, first_name, last_name")
    .eq("id", data.user.id)
    .maybeSingle()

  const avatarUrl = profile?.avatar_path ? await getAvatarSignedUrl(dataClient, profile.avatar_path) : null

  // Serialize only the necessary user data to avoid hydration issues
  const userData = {
    email: data.user.email,
    user_metadata: {
      ...data.user.user_metadata,
      first_name: profile?.first_name || data.user.user_metadata?.first_name,
      last_name: profile?.last_name || data.user.user_metadata?.last_name,
      avatar_url: avatarUrl || data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
    },
  }

  return <HeaderWrapper user={userData} canAccessAdmin={canAccessAdmin} avatarUrl={avatarUrl} />
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} overflow-x-clip`}>
        <Suspense fallback={null}>
          {/* Theme follows system preference automatically (light/dark mode) */}
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="acob-theme">
            <QueryProvider>
              <SeasonalFaviconSwitcher />
              <SidebarProvider>
                <NProgressProvider />
                <NProgressHandler />
                <ClientErrorMonitor />
                <HeaderWrapperWithData />
                {/* Intentionally public routes outside (app): /employee/new, /maintenance */}
                {children}
                <Toaster />
              </SidebarProvider>
            </QueryProvider>
          </ThemeProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
