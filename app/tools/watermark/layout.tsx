import type { Metadata } from "next"
import { AppLayout } from "@/components/app-layout"

export const metadata: Metadata = {
  title: "Watermark Tool | ACOB Lighting Technology Limited",
  description: "Add watermarks to your images and documents",
}

export default function WatermarkLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
