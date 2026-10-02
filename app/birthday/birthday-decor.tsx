import type { CSSProperties } from "react"

const CONFETTI_COLORS = ["var(--bd-gold)", "var(--bd-green)", "var(--bd-cream)", "var(--bd-gold-deep)"]

// Deterministic scatter (no Math.random) so server and client render identical markup.
const CONFETTI = Array.from({ length: 34 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: -((i * 1.7) % 14),
  duration: 11 + ((i * 7) % 9),
  size: 6 + ((i * 5) % 7),
  drift: ((i % 5) - 2) * 18,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}))

const BALLOONS = [
  { left: "3%", color: "var(--bd-green)", delay: "0s", scale: 1 },
  { left: "9%", color: "var(--bd-gold)", delay: "-3s", scale: 0.8 },
  { left: "88%", color: "var(--bd-green)", delay: "-1.5s", scale: 0.9 },
  { left: "94%", color: "var(--bd-gold)", delay: "-4.5s", scale: 0.75 },
]

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

      {BALLOONS.map((b, i) => (
        <div
          key={i}
          className="birthday-balloon"
          style={{ left: b.left, animationDelay: b.delay, "--bd-balloon": b.color, scale: b.scale } as CSSProperties}
        />
      ))}

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
