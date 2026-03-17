"use client"

import { useEffect, useState } from "react"
import {
  addMonths,
  addYears,
  addQuarters,
  format,
  parseISO,
  isBefore,
  isSameDay,
  differenceInDays,
  startOfDay,
} from "date-fns"
import type { Payment, ScheduleItem, PaymentDocument } from "./payment-types"

export function usePaymentSchedule(payment: Payment | null) {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])

  useEffect(() => {
    if (payment && payment.payment_type === "recurring" && payment.next_payment_due && payment.recurrence_period) {
      setSchedule(buildSchedule(payment))
    }
  }, [payment])

  return schedule
}

function buildSchedule(payment: Payment): ScheduleItem[] {
  if (!payment.next_payment_due || !payment.recurrence_period) return []

  const nextDue = parseISO(payment.next_payment_due)

  let startDate = parseISO(payment.created_at)
  const paymentDate = payment.payment_date ? parseISO(payment.payment_date) : null

  if (paymentDate && isBefore(paymentDate, startDate)) {
    startDate = paymentDate
  }

  if (payment.documents?.length) {
    for (const doc of payment.documents) {
      if (!doc.applicable_date) continue
      const docDate = parseISO(doc.applicable_date)
      if (isBefore(docDate, startDate)) {
        startDate = docDate
      }
    }
  }

  const today = startOfDay(new Date())
  const items: ScheduleItem[] = []

  const addPeriod = (date: Date, count: number) => {
    switch (payment.recurrence_period) {
      case "monthly":
        return addMonths(date, count)
      case "quarterly":
        return addQuarters(date, count)
      case "yearly":
        return addYears(date, count)
      default:
        return addMonths(date, count)
    }
  }

  const getDocsForDate = (date: Date): PaymentDocument[] => {
    if (!payment.documents) return []
    const dateStr = format(date, "yyyy-MM-dd")
    return payment.documents.filter((d) => d.applicable_date === dateStr)
  }

  let lookbackCount = 1
  while (lookbackCount <= 12) {
    const pastDate = addPeriod(nextDue, -lookbackCount)
    if (isBefore(pastDate, startDate) && !isSameDay(pastDate, startDate)) break

    items.unshift({
      date: pastDate,
      status: "paid",
      label: "Completed",
      documents: getDocsForDate(pastDate),
    })
    lookbackCount++
  }

  for (let i = 0; i < 6; i++) {
    const date = addPeriod(nextDue, i)
    const daysDiff = differenceInDays(date, today)

    let status: "due" | "overdue" | "upcoming" | "paid" = "upcoming"
    let label = "Scheduled"

    if (isBefore(date, today)) {
      status = "overdue"
      label = "Overdue"
    } else if (daysDiff <= 7) {
      status = "due"
      label = "Due Soon"
    } else {
      label = "Upcoming"
    }

    if (status === "upcoming") {
      const isFirstUpcoming = !items.some((item) => item.status === "upcoming" || item.status === "due")
      if (!isFirstUpcoming) {
        label = "Scheduled"
      }
    }

    items.push({ date, status, label, documents: getDocsForDate(date) })
  }

  return items
}
