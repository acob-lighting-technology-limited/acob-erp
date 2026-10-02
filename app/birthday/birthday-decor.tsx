import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

const CONFETTI_COLORS = ["var(--bd-green)", "var(--bd-green-bright)", "var(--bd-cream)", "var(--bd-gold)"]

// A light sprinkle, not a storm. Deterministic scatter (no Math.random) so server and
// client render identical markup.
const CONFETTI = Array.from({ length: 12 }, (_, i) => ({
  left: (i * 41 + 7) % 100,
  delay: -((i * 2.9) % 18),
  duration: 16 + ((i * 7) % 8),
  size: 5 + ((i * 3) % 4),
  drift: ((i % 5) - 2) * 18,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}))

// Two tethered bunches, one tied at each bottom corner. Coordinates are in the
// bunch's own 260×480 viewBox; the right bunch mirrors x so highlights stay top-left.
const BUNCH_W = 260
const BUNCH_H = 480
const TIE = { x: 34, y: 466 }

const BUNCH = [
  { x: 82, y: 118, s: 0.95, color: "var(--bd-green)", sway: 7, delay: 0 },
  { x: 178, y: 92, s: 0.8, color: "var(--bd-gold)", sway: 8.5, delay: -2.5 },
  { x: 140, y: 214, s: 0.72, color: "var(--bd-green)", sway: 6.2, delay: -4.2 },
]

/** Teardrop balloon body centred on (0,0): ~100 wide, ~122 tall, knot at y≈62. */
const BALLOON_PATH =
  "M0,-60 C33,-60 50,-33 50,-6 C50,28 24,52 4,61 L-4,61 C-24,52 -50,28 -50,-6 C-50,-33 -33,-60 0,-60 Z"

function BalloonBunch({ side }: { side: "left" | "right" }) {
  const mx = (x: number) => (side === "left" ? x : BUNCH_W - x)
  const tieX = mx(TIE.x)

  return (
    <svg
      className={cn("birthday-balloons", side === "left" ? "birthday-balloons--left" : "birthday-balloons--right")}
      viewBox={`0 0 ${BUNCH_W} ${BUNCH_H}`}
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        {BUNCH.map((b, i) => (
          <radialGradient key={i} id={`bd-balloon-${side}-${i}`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" style={{ stopColor: `color-mix(in oklab, ${b.color} 55%, white)` }} />
            <stop offset="45%" style={{ stopColor: b.color }} />
            <stop offset="100%" style={{ stopColor: `color-mix(in oklab, ${b.color} 55%, black)` }} />
          </radialGradient>
        ))}
      </defs>

      {BUNCH.map((b, i) => {
        const x = mx(b.x)
        const knotY = b.y + 61 * b.s
        return (
          <g
            key={i}
            className="birthday-balloon-sway"
            style={
              {
                transformOrigin: `${tieX}px ${TIE.y}px`,
                animationDuration: `${b.sway}s`,
                animationDelay: `${b.delay}s`,
              } as CSSProperties
            }
          >
            {/* String: a lazy curve from the knot down to the tie point. */}
            <path
              d={`M${x} ${knotY + 8 * b.s} Q${(x + tieX) / 2 + (side === "left" ? 22 : -22)} ${(knotY + TIE.y) / 2} ${tieX} ${TIE.y}`}
              fill="none"
              stroke="var(--bd-cream)"
              strokeOpacity="0.55"
              strokeWidth="1.2"
            />
            <g transform={`translate(${x} ${b.y}) scale(${b.s})`}>
              <path d={BALLOON_PATH} fill={`url(#bd-balloon-${side}-${i})`} />
              <ellipse
                cx="-19"
                cy="-28"
                rx="9"
                ry="19"
                fill="white"
                fillOpacity="0.38"
                transform="rotate(-24 -19 -28)"
              />
              <path d="M-5,61 L5,61 L7,70 L-7,70 Z" fill={`color-mix(in oklab, ${b.color} 60%, black)`} />
            </g>
          </g>
        )
      })}

      {/* Gold bow where the strings are tied. */}
      <g transform={`translate(${tieX} ${TIE.y})`}>
        <ellipse cx="-8" cy="-2" rx="8" ry="4.5" fill="var(--bd-gold)" transform="rotate(-25 -8 -2)" />
        <ellipse cx="8" cy="-2" rx="8" ry="4.5" fill="var(--bd-gold)" transform="rotate(25 8 -2)" />
        <circle r="3.2" fill="var(--bd-gold-deep)" />
      </g>
    </svg>
  )
}

/** Ambient party backdrop shared by the spotlight, its setup screen and the loading state. */
export function BirthdayDecor() {
  return (
    <div className="birthday-decor" aria-hidden="true">
      <div className="birthday-decor__glow birthday-decor__glow--green" />
      <div className="birthday-decor__glow birthday-decor__glow--gold" />
      <div className="birthday-decor__stars" />

      <svg className="birthday-decor__bunting" viewBox="0 0 1200 70" preserveAspectRatio="none">
        <path d="M0 4 Q600 64 1200 4" fill="none" stroke="var(--bd-cream)" strokeOpacity="0.35" strokeWidth="1.5" />
        {Array.from({ length: 15 }, (_, i) => {
          const x = 40 + i * 80
          const t = x / 1200
          const y = 4 + 120 * t * (1 - t)
          return (
            <path
              key={i}
              d={`M${x - 16} ${y} L${x + 16} ${y} L${x} ${y + 30} Z`}
              fill={CONFETTI_COLORS[i % 4]}
              fillOpacity="0.85"
            />
          )
        })}
      </svg>

      <BalloonBunch side="left" />
      <BalloonBunch side="right" />

      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="birthday-confetti"
          style={
            {
              left: `${c.left}%`,
              width: `${c.size}px`,
              height: `${c.round ? c.size : c.size * 1.8}px`,
              borderRadius: c.round ? "999px" : "2px",
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              "--bd-drift": `${c.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
