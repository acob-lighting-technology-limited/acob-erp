import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { formatLunchDeadline } from "@/lib/hr/lunch-share"
import { loadLunchSharePreview } from "@/lib/hr/lunch-share-server"

// The menu card WhatsApp shows in the link preview for /lunch/[date]. The
// preview's description gets cut to a line or two, so the dishes have to be
// legible here. Text only — menus carry no photos.

export const alt = "Lunch menu"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const dynamic = "force-dynamic"

const BRAND_GREEN = "#12802e"
const INK = "#111111"
const MUTED = "#6b6b6b"
const MAX_GROUPS = 3
const MAX_DISHES = 6

async function loadLogo(): Promise<string | null> {
  try {
    const data = await readFile(join(process.cwd(), "public/images/matrix-logo-light.png"))
    return `data:image/png;base64,${data.toString("base64")}`
  } catch {
    // The wordmark text below still identifies the card without it.
    return null
  }
}

export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const [preview, logo] = await Promise.all([loadLunchSharePreview(date), loadLogo()])

  const groups = preview?.groups.slice(0, MAX_GROUPS) ?? []
  const hiddenGroups = (preview?.groups.length ?? 0) - groups.length
  // A fixed meal is one line on an otherwise empty card — let it fill the space.
  const dishCount = groups.reduce((total, group) => total + Math.min(group.dishes.length, MAX_DISHES), 0)
  const dishFontSize = groups.length > 1 ? 30 : dishCount <= 2 ? 52 : 36
  const footer = !preview
    ? "No menu has been published for this day."
    : preview.votingOpen
      ? `Vote before ${formatLunchDeadline(preview.deadline)}`
      : "Voting for this menu has closed"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          borderLeft: `20px solid ${BRAND_GREEN}`,
          padding: "48px 64px",
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> only
            <img src={logo} width={88} height={64} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: 6 }}>MATRIX</div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, color: BRAND_GREEN, fontWeight: 700, letterSpacing: 2 }}>
              LUNCH MENU
            </div>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>{preview?.dayLabel ?? date}</div>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, gap: 48, marginTop: 40 }}>
          {groups.map((group, index) => {
            const dishes = group.dishes.slice(0, MAX_DISHES)
            const more = group.dishes.length - dishes.length
            return (
              <div key={index} style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                {group.name && (
                  <div
                    style={{
                      display: "flex",
                      fontSize: 22,
                      fontWeight: 700,
                      color: MUTED,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 12,
                    }}
                  >
                    {group.name}
                  </div>
                )}
                {dishes.map((dish, dishIndex) => (
                  <div
                    key={dishIndex}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      fontSize: dishFontSize,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        background: BRAND_GREEN,
                        marginRight: 16,
                        marginTop: dishFontSize * 0.55,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: "flex" }}>{dish}</div>
                  </div>
                ))}
                {more > 0 && <div style={{ display: "flex", fontSize: 24, color: MUTED }}>+{more} more</div>}
              </div>
            )
          })}
          {hiddenGroups > 0 && (
            <div style={{ display: "flex", fontSize: 24, color: MUTED, alignSelf: "flex-end" }}>
              +{hiddenGroups} more {hiddenGroups === 1 ? "category" : "categories"}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "2px solid #e5e5e5",
            paddingTop: 24,
            fontSize: 28,
          }}
        >
          <div style={{ display: "flex", fontWeight: 700, color: preview?.votingOpen ? BRAND_GREEN : MUTED }}>
            {footer}
          </div>
          {preview?.votingOpen && (
            <div style={{ display: "flex", color: MUTED, fontSize: 24 }}>Tap to vote on Matrix</div>
          )}
        </div>
      </div>
    ),
    size
  )
}
