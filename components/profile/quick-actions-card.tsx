import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileSignature, MessageSquare, Droplet, CreditCard } from "lucide-react"

const quickActions = [
  { name: "Email Signature", href: "/signature", icon: FileSignature, description: "Create professional signature" },
  { name: "Submit Feedback", href: "/feedback", icon: MessageSquare, description: "Share your thoughts" },
  { name: "Watermark Tool", href: "/watermark", icon: Droplet, description: "Add watermarks to images" },
  { name: "Payments", href: "/payments", icon: CreditCard, description: "Manage department payments" },
]

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.name} href={action.href}>
              <div className="hover:border-primary/50 hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors">
                <div className="bg-primary/10 rounded-full p-3">
                  <action.icon className="text-primary h-5 w-5" />
                </div>
                <span className="text-sm font-medium">{action.name}</span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
