"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface HelpDeskStatsProps {
  myOpenTickets: number
  resolvedCount: number
  avgCsat: string
}

export function HelpDeskStats({ myOpenTickets, resolvedCount, avgCsat }: HelpDeskStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">My Open Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold sm:text-2xl">{myOpenTickets}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Resolved Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold sm:text-2xl">{resolvedCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Avg CSAT</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold sm:text-2xl">{avgCsat}</p>
        </CardContent>
      </Card>
    </div>
  )
}
