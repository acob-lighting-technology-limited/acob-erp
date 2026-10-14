import { cn } from "@/lib/utils"

/**
 * The flat Matrix logo, drawn from two alpha masks so both colours come from
 * theme tokens instead of baked-in PNGs:
 *   - M + wordmark → --logo-ink (charcoal in light mode, white in dark)
 *   - the A        → --logo-accent (brand green; gold on admin, navy on dept)
 * The tokens live in app/globals.css. Both masks share the 906×659 canvas of
 * matrix-logo-light.png, so they overlay exactly.
 *
 * Exports, emails and the auth screens keep the fixed green PNGs; the surface
 * tint is an in-app signal only.
 */
export function MatrixLogo({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Matrix" className={cn("relative inline-block aspect-[906/659]", className)}>
      <span aria-hidden className="matrix-logo-layer matrix-logo-ink" />
      <span aria-hidden className="matrix-logo-layer matrix-logo-accent" />
    </span>
  )
}
