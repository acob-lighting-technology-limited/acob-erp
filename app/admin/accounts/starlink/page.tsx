import type { Metadata } from "next"
import { StarlinkKitsPage } from "./view"

export const metadata: Metadata = {
  title: "Starlink Kits | Matrix",
  description: "Starlink kits, the projects they serve and how their bills stand.",
}

export default function StarlinkKitsRoute() {
  return <StarlinkKitsPage />
}
