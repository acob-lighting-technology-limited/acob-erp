"use client"

import { WatermarkStudio } from "@/components/watermark-studio"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Droplet } from "lucide-react"

export default function WatermarkPage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Watermark Studio"
        description="Add ACOB branding watermarks to your images and videos"
        icon={Droplet}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />
      <WatermarkStudio />
    </PageWrapper>
  )
}
