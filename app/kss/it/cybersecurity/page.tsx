import { PresentationDeck } from "@/components/kss/presentation-deck"
import { cyberPresentationScenes } from "@/lib/kss/cyber-presentation-content"

export const metadata = {
  title: "Cybersecurity Overview and Strategy",
  description: "ACOB Lighting Technology Limited Cybersecurity KSS",
}

export default function CybersecurityKSSPresentationPage() {
  return <PresentationDeck scenes={cyberPresentationScenes} />
}
