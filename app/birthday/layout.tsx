import type { Metadata } from "next"
import { Great_Vibes, Playfair_Display } from "next/font/google"
import "./birthday.css"

// Display faces scoped to the spotlight only — the rest of the ERP stays on Geist.
const script = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-birthday-script" })
const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-birthday-serif",
})

export const metadata: Metadata = {
  title: "Birthday Spotlight | ACOB Lighting Technology Limited",
  description: "Weekly birthday spotlight in the ERP",
}

export default function BirthdayLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className={`birthday-route ${script.variable} ${serif.variable}`}>{children}</div>
}
