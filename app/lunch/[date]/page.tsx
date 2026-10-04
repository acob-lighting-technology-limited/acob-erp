import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { lunchSharePath } from "@/lib/hr/lunch-share"
import { loadLunchSharePreview } from "@/lib/hr/lunch-share-server"
import { LunchShareView, lunchShareMetadata } from "../_components/lunch-share-view"

// Public share page for one day's lunch poll — the link HR posts to WhatsApp.
// Exempted from auth in lib/supabase/middleware.ts so link-preview crawlers
// can read the metadata; signed-in staff are redirected to that day's poll
// before this renders. See lib/hr/lunch-share.ts for why the date is in the URL.

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ date: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params
  return lunchShareMetadata(await loadLunchSharePreview(date), lunchSharePath(date))
}

export default async function LunchSharePage({ params }: PageProps) {
  const { date } = await params
  const preview = await loadLunchSharePreview(date)
  if (!preview) notFound()

  return <LunchShareView preview={preview} />
}
