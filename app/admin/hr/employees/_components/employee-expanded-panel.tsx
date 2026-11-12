"use client"

import type { Employee } from "./employee-types"
import { Briefcase, Building2, Phone } from "lucide-react"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import { formatDateOfBirth, formatDDMMYYYY } from "@/lib/utils/date"

/** The expanded row for one employee: employment, workplace and contact, in three sections. */
export function EmployeeExpandedPanel({ r }: { r: Employee }) {
  return (
    <div className="animate-in fade-in slide-in-from-top-2 bg-muted/15 grid gap-0 border-y md:grid-cols-3 md:divide-x">
      <section className="space-y-3 p-4">
        <SectionHeading title="Employment" aside={<Briefcase className="text-muted-foreground h-4 w-4" />} />
        <DetailList
          className="grid-cols-1"
          items={[
            { label: "Staff ID", value: r.employee_number },
            { label: "Started", value: r.employment_date ? formatDDMMYYYY(r.employment_date) : null },
            {
              label: "Confirmed",
              value: r.confirmation_date ? formatDDMMYYYY(r.confirmation_date) : "Pending",
            },
            ...(r.separation_date ? [{ label: "Exit date", value: formatDDMMYYYY(r.separation_date) }] : []),
          ]}
        />
      </section>
      <section className="space-y-3 border-t p-4 md:border-t-0">
        <SectionHeading title="Workplace" aside={<Building2 className="text-muted-foreground h-4 w-4" />} />
        <DetailList
          className="grid-cols-1"
          items={[
            { label: "Designation", value: r.designation || null },
            { label: "Office", value: r.office_location || null },
            { label: "Address", value: r.residential_address || null, wide: true },
          ]}
        />
      </section>
      <section className="space-y-3 border-t p-4 md:border-t-0">
        <SectionHeading title="Contact" aside={<Phone className="text-muted-foreground h-4 w-4" />} />
        <DetailList
          className="grid-cols-1"
          items={[
            { label: "Date of birth", value: formatDateOfBirth(r.date_of_birth, r.birthday) ?? null },
            {
              label: "Phone",
              value: r.phone_number ? (
                <a href={`tel:${r.phone_number}`} className="hover:text-foreground hover:underline">
                  {r.phone_number}
                </a>
              ) : null,
            },
            {
              label: "Personal email",
              value: r.additional_email ? (
                <a href={`mailto:${r.additional_email}`} className="hover:text-foreground break-all hover:underline">
                  {r.additional_email}
                </a>
              ) : null,
            },
          ]}
        />
      </section>
    </div>
  )
}
