"use client"

import { cn } from "@/lib/utils"
import {
  IMPACT_LEVELS,
  LIKELIHOOD_LEVELS,
  RATING_BANDS,
  RATING_LABELS,
  ratingForScore,
  type RiskRating,
  type RiskRow,
} from "@/lib/risk-register/model"
import { RATING_STYLES } from "./risk-badges"

/**
 * 5 x 5 inherent-risk matrix: likelihood down the side (5 at the top), impact
 * along the bottom. Each cell shows how many risks sit at that position.
 */
export function RiskHeatMap({ risks }: { risks: RiskRow[] }) {
  const counts = new Map<string, number>()
  for (const r of risks) counts.set(`${r.likelihood}:${r.impact}`, (counts.get(`${r.likelihood}:${r.impact}`) || 0) + 1)

  const likelihoodTopDown = [...LIKELIHOOD_LEVELS].reverse()

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="mx-auto border-separate border-spacing-1" aria-label="Risk heat map">
          <tbody>
            {likelihoodTopDown.map((l) => (
              <tr key={l.value}>
                <th scope="row" className="text-muted-foreground pr-2 text-right text-xs font-medium whitespace-nowrap">
                  <span className="text-foreground">{l.value}</span> {l.label}
                  <span className="block text-[10px] font-normal">{l.band}</span>
                </th>
                {IMPACT_LEVELS.map((i) => {
                  const score = l.value * i.value
                  const count = counts.get(`${l.value}:${i.value}`) || 0
                  return (
                    <td
                      key={i.value}
                      title={`Likelihood ${l.value} × Impact ${i.value} = ${score}: ${count} risk${count === 1 ? "" : "s"}`}
                      className={cn(
                        "h-14 w-14 rounded-md border text-center align-middle sm:h-16 sm:w-20",
                        RATING_STYLES[ratingForScore(score)],
                        count === 0 && "opacity-40"
                      )}
                    >
                      <span className="block text-lg font-bold">{count || ""}</span>
                      <span className="block text-[10px] opacity-70">{score}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td />
              {IMPACT_LEVELS.map((i) => (
                <th key={i.value} scope="col" className="text-muted-foreground pt-1 text-center text-xs font-medium">
                  <span className="text-foreground">{i.value}</span>
                  <span className="block text-[10px] font-normal">{i.label}</span>
                </th>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-center text-xs">Likelihood (rows) × Impact (columns)</p>
      <div className="flex flex-wrap justify-center gap-2 text-xs">
        {(Object.keys(RATING_LABELS) as RiskRating[]).map((rating) => (
          <span key={rating} className={cn("rounded-md border px-2 py-1", RATING_STYLES[rating])}>
            {RATING_LABELS[rating]}: {RATING_BANDS[rating]}
          </span>
        ))}
      </div>
    </div>
  )
}
