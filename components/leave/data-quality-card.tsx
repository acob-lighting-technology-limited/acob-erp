"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/patterns"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEntry = any

interface DataQualityCardProps {
  dataQuality: AnyEntry[]
}

export function DataQualityCard({ dataQuality }: DataQualityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Data Quality</CardTitle>
        <CardDescription>Employees missing required leave-policy profile fields</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {dataQuality.length === 0 && (
          <EmptyState
            title="No data-quality gaps found"
            description="All required leave-policy profile fields are populated."
            className="p-4"
          />
        )}
        {dataQuality.map((entry: AnyEntry) => (
          <div key={entry.id} className="rounded border p-3 text-sm">
            <p className="font-medium">{entry.full_name || entry.company_email || entry.id}</p>
            <p>
              Missing:{" "}
              {[
                !entry.gender && "gender",
                !entry.employment_date && "employment_date",
                !entry.employment_type && "employment_type",
                !entry.work_location && "work_location",
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
