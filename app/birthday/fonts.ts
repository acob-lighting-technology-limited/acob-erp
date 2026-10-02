import { Great_Vibes, Playfair_Display } from "next/font/google"

// Display faces scoped to the spotlight only — the rest of the ERP stays on Geist.
export const birthdayScript = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-birthday-script" })

export const birthdaySerif = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-birthday-serif",
})
