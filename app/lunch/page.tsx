import type { Metadata } from "next"
import { loadCurrentLunchShareDate, loadLunchSharePreview } from "@/lib/hr/lunch-share-server"
import { LunchShareView, lunchShareMetadata } from "./_components/lunch-share-view"

// The bare /lunch link HR has always posted. It previews whichever menu is
// open for voting now, so the old habit still gets a menu card in WhatsApp.
// WhatsApp may reuse an earlier preview for a link it has seen before, which
// is why the Share to WhatsApp button posts the dated /lunch/YYYY-MM-DD link.
// Signed-in staff are redirected to /hr/lunch before this renders.

export const dynamic = "force-dynamic"

async function loadCurrentPreview() {
  const date = await loadCurrentLunchShareDate()
  return date ? loadLunchSharePreview(date) : null
}

export async function generateMetadata(): Promise<Metadata> {
  return lunchShareMetadata(await loadCurrentPreview(), "/lunch")
}

export default async function LunchCurrentSharePage() {
  return <LunchShareView preview={await loadCurrentPreview()} />
}
