"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import WireframeForms from "@/components/ui/wireframe-forms"
import GridTraces from "@/components/ui/grid-traces"
import { getSeasonalLogoPaths } from "@/lib/seasonal-branding"
import { cn } from "@/lib/utils"

/** Card styling shared by every `/auth/*` page so they sit on the shell consistently. */
export const authCardClassName =
  "border-border/60 bg-card/85 rounded-2xl shadow-2xl shadow-black/5 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 dark:shadow-black/40"

type AuthShellProps = {
  children: ReactNode
  /** Short guidance lines shown under the brand copy on large screens. */
  highlights?: string[]
  /** Brand-panel tagline. */
  tagline?: string
  className?: string
}

/**
 * Hides the rotating matrix wireframe without removing it. Flip to `true` to
 * bring it back in the brand panel (and faintly behind the card on phones).
 */
const SHOW_MATRIX = false

const DEFAULT_TAGLINE =
  "Secure access for authorized employees across operations, reporting, and administrative workflows."

export function AuthShell({ children, highlights, tagline = DEFAULT_TAGLINE, className }: AuthShellProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Light until mounted so SSR and first client render match.
  const mode = mounted && resolvedTheme === "dark" ? "dark" : "light"
  const logoSrc = getSeasonalLogoPaths(mode).navbar

  return (
    <div className="bg-background text-foreground relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-10 md:px-8">
      {/* Graph-paper grid + brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_30%_50%,black,transparent_75%)] [background-size:44px_44px] opacity-50"
      />
      {/* Streaks of light wandering the grid lines */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {mounted && <GridTraces cellSize={44} mode={mode} />}
      </div>

      <div
        aria-hidden="true"
        className="bg-primary/15 pointer-events-none absolute top-1/2 left-1/2 h-[560px] w-[760px] -translate-x-[65%] -translate-y-1/2 rounded-full blur-[120px]"
      />

      {/* Faint backdrop on small screens, where there is no brand panel to hold it */}
      {SHOW_MATRIX && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[45%] opacity-[0.12] lg:hidden"
        >
          {mounted && <WireframeForms variant="matrix" mode={mode} speed={0.8} size={0.8} />}
        </div>
      )}

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_400px] lg:gap-16">
        <section className="hidden flex-col justify-center lg:flex">
          {/* Logo sits with the copy as one block, vertically centred. */}
          <div className="max-w-lg space-y-7">
            <Image src={logoSrc} alt="ACOB Lighting" width={200} height={52} priority className="h-11 w-auto" />

            {/* Reserved for the matrix wireframe; see SHOW_MATRIX. */}
            {SHOW_MATRIX && mounted && (
              <div aria-hidden="true" className="pointer-events-none h-[320px]">
                <WireframeForms variant="matrix" mode={mode} speed={1} size={1} />
              </div>
            )}

            <div className="space-y-3">
              <p className="text-primary font-mono text-xs tracking-[0.2em] uppercase">ACOB Lighting · Matrix</p>
              <h2 className="text-4xl font-semibold tracking-tight xl:text-5xl">Every workflow, in one matrix.</h2>
              <p className="text-muted-foreground text-base leading-7">{tagline}</p>
            </div>

            {highlights && highlights.length > 0 && (
              <ul className="text-muted-foreground space-y-2.5 text-sm">
                {highlights.map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <span className="bg-primary/70 mt-2 h-1 w-1 shrink-0 rounded-full" />
                    {line}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-muted-foreground/70 font-mono text-[11px]">ACOB Lighting Technology Limited</p>
          </div>
        </section>

        <main className={cn("flex w-full flex-col justify-center", className)}>
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <div className="mb-6 flex justify-center lg:hidden">
              <Image src={logoSrc} alt="ACOB Lighting" width={200} height={52} priority className="h-12 w-auto" />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
