import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { IconFill } from "@/components/ui/icon-fill"
import { cn } from "@/lib/utils"

export interface ModuleHubCard {
  title: string
  description: string
  href: string
  icon: LucideIcon
  /** Small pill in the top-right corner (e.g. "Weekly", "4 tools"). */
  tag?: string | number | null
  /** Muted text in the card footer. */
  footer?: string | null
  /** Icon chip + tag tint, e.g. "bg-indigo-500/10 text-info border-indigo-500/20". */
  color: string
  /** Solid fill shown behind the icon on hover, e.g. "bg-indigo-500". */
  fill: string
  /** Card border on hover. */
  hoverBorder: string
  /** Title colour on hover. */
  hoverText: string
}

/**
 * The card grid used by every module landing page (Reports, HR, Tools, PMS…).
 * One implementation so the hubs look and behave the same everywhere.
 */
export function ModuleHubGrid({ cards, className }: { cards: ModuleHubCard[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="group block">
          <div
            className={cn(
              "bg-card border-border flex h-full flex-col justify-between rounded-xl border p-4.5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
              card.hoverBorder
            )}
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <IconFill
                    icon={card.icon}
                    fillColor={card.fill}
                    className={cn(
                      "h-9 w-9 rounded-lg border transition-transform duration-200 group-hover:scale-105",
                      card.color
                    )}
                    iconClassName="h-5 w-5"
                  />
                  <h3 className={cn("text-foreground text-base font-semibold transition-colors", card.hoverText)}>
                    {card.title}
                  </h3>
                </div>
                {card.tag != null && card.tag !== "" ? (
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", card.color)}
                  >
                    {card.tag}
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">{card.description}</p>
            </div>
            <div className="border-border/40 mt-4 flex items-center justify-between border-t pt-2.5">
              <span className="text-muted-foreground text-xs font-medium">{card.footer}</span>
              <IconFill
                icon={ChevronRight}
                fillColor={card.fill}
                hoverTextClassName="group-hover:text-white"
                className={cn(
                  "border-border h-6 w-6 rounded-full border transition-all duration-200 group-hover:translate-x-0.5",
                  card.hoverBorder
                )}
                iconClassName="text-muted-foreground h-3.5 w-3.5"
                aria-hidden="true"
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
