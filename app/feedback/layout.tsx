import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Feedback | ACOB Lighting Technology Limited",
  description: "Submit feedback, concerns, complaints, or suggestions to ACOB Lighting Technology Limited",
}

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
