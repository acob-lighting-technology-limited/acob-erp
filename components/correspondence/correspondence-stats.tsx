"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CorrespondenceStatsProps {
  total: number
  open: number
  closed: number
  incoming: number
}

export function CorrespondenceStats({ total, open, closed, incoming }: CorrespondenceStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Total Records</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold sm:text-2xl">{total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Open</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold sm:text-2xl">{open}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Closed / Finalized</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold sm:text-2xl">{closed}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Incoming</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-bold sm:text-2xl">{incoming}</p>
        </CardContent>
      </Card>
    </div>
  )
}
