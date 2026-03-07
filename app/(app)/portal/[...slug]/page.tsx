import { redirect } from "next/navigation"

interface Props {
  params: Promise<{ slug?: string[] }>
}

export default async function PortalCatchAllPage({ params }: Props) {
  const { slug = [] } = await params
  if (slug.length === 0) {
    redirect("/dashboard/profile")
  }
  redirect(`/dashboard/${slug.join("/")}`)
}
