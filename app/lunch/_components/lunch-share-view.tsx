import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatLunchDeadline, lunchPollPath } from "@/lib/hr/lunch-share"
import type { LunchSharePreview } from "@/lib/hr/lunch-share-server"

// Shared by the public lunch share pages (/lunch and /lunch/[date]). They exist
// for WhatsApp's link-preview crawler, which has no session; signed-in staff
// are redirected to the poll by the middleware before either page renders, so
// the card below is only ever seen by someone who isn't signed in.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://matrix.acoblighting.com"

function describeMenu(preview: LunchSharePreview): string {
  const dishes = preview.groups
    .map((group) => (group.name ? `${group.name}: ${group.dishes.join(", ")}` : group.dishes.join(" · ")))
    .join(" | ")
  const cta = preview.votingOpen
    ? `Vote before ${formatLunchDeadline(preview.deadline)}.`
    : "Voting for this menu has closed."
  return dishes ? `${dishes} — ${cta}` : cta
}

/**
 * Link-preview metadata for a menu. `path` is the URL being shared; the image
 * always comes from the dated route, so the bare /lunch link gets a different
 * image address every day rather than one WhatsApp could serve from cache.
 */
export function lunchShareMetadata(preview: LunchSharePreview | null, path: string): Metadata {
  if (!preview) {
    return {
      metadataBase: new URL(SITE_URL),
      title: "Lunch poll | Matrix",
      description: "Vote for your lunch on Matrix.",
      openGraph: { title: "Lunch poll | Matrix", description: "Vote for your lunch on Matrix.", siteName: "Matrix" },
    }
  }

  const title = `Lunch menu — ${preview.dayLabel}`
  const description = describeMenu(preview)
  const image = { url: `/lunch/${preview.date}/opengraph-image`, width: 1200, height: 630, alt: title }
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Matrix", url: path, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  }
}

export function LunchShareView({ preview }: { preview: LunchSharePreview | null }) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {preview ? (
          <>
            <CardHeader>
              <CardDescription className="font-semibold tracking-wide text-emerald-600 uppercase">
                Lunch menu
              </CardDescription>
              <CardTitle className="text-2xl">{preview.dayLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {preview.groups.map((group, index) => (
                <div key={index} className="space-y-1.5">
                  {group.name && <p className="text-muted-foreground text-xs font-semibold uppercase">{group.name}</p>}
                  <ul className="space-y-1">
                    {group.dishes.map((dish) => (
                      <li key={dish} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                        <span>{dish}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className={preview.votingOpen ? "text-sm text-emerald-600" : "text-muted-foreground text-sm"}>
                {preview.votingOpen
                  ? `Vote before ${formatLunchDeadline(preview.deadline)}.`
                  : "Voting for this menu has closed."}
              </p>
              <Button asChild className="w-full">
                <Link href={lunchPollPath(preview.date)}>
                  {preview.votingOpen ? "Sign in to vote" : "Sign in to view the poll"}
                </Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Lunch poll</CardTitle>
              <CardDescription>No lunch menu is open for voting right now.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/hr/lunch">Sign in to Matrix</Link>
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  )
}
