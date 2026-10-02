"use client"

import { use } from "react"
import { PaymentDetailView } from "@/components/payments/payment-detail-view"

export default function PaymentDetailsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params)
  return <PaymentDetailView paymentId={id} basePath="/accounts/payments" scope="app" />
}
