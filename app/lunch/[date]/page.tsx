import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { formatLunchDeadline, lunchSharePath } from "@/lib/hr/lunch-share"
import { loadLunchSharePreview, type LunchSharePreview } from "@/lib/hr/lunch-share-server"
import { LunchShareRedirect } from "./share-redirect"

// Public share page for one day's lunch poll — the link HR posts to WhatsApp.
// Exempted from auth in lib/supabase/middleware.ts so link-preview crawlers
// can read the metadata; people are forwarded to the real poll at /hr/lunch.
// See lib/hr/lunch-share.ts for why the date is in the URL.

export const dynamic = "force-dynamic"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://matrix.acoblighting.com"

interface PageProps {
  params: Promise<{ date: string }>
}

function describeMenu(preview: LunchSharePreview): string {
  const dishes = preview.groups
    .map((group) => (group.name ? `${group.name}: ${group.dishes.join(", ")}` : group.dishes.join(" · ")))
    .join(" | ")
  const cta = preview.votingOpen
    ? `Vote before ${formatLunchDeadline(preview.deadline)}.`
    : "Voting for this menu has closed."
  return dishes ? `${dishes} — ${cta}` : cta
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params
  const preview = await loadLunchSharePreview(date)
  if (!preview) return { title: "Lunch menu | Matrix" }

  const title = `Lunch menu — ${preview.dayLabel}`
  const description = describeMenu(preview)
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Matrix",
      url: lunchSharePath(date),
    },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function LunchSharePage({ params }: PageProps) {
  const { date } = await params
  const preview = await loadLunchSharePreview(date)
  if (!preview) notFound()

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <p className="text-muted-foreground text-sm">Lunch menu — {preview.dayLabel}</p>
        <p className="mt-2 font-medium">Opening the lunch poll…</p>
        <LunchShareRedirect />
      </div>
    </main>
  )
}
