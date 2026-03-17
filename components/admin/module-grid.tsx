import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"
import type { ModuleAction } from "./dashboard-types"

interface PrimaryModuleGridProps {
  modules: ModuleAction[]
}

export function PrimaryModuleGrid({ modules }: PrimaryModuleGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((action) => (
        <Link key={action.href} href={action.href} className="h-full">
          <Card className="group flex h-full cursor-pointer flex-col border transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex flex-1 flex-col p-4">
              <div className="flex items-start gap-3">
                <div className={`${action.color} shrink-0 rounded-lg p-2.5 text-white`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-foreground mb-1 text-sm font-semibold">{action.title}</h3>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{action.description}</p>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 flex-shrink-0 transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

interface SecondaryModuleGridProps {
  modules: ModuleAction[]
}

export function SecondaryModuleGrid({ modules }: SecondaryModuleGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {modules.map((action) => (
        <Link key={action.href} href={action.href} className="h-full">
          <Card className="group bg-muted/20 hover:bg-muted/35 flex h-full cursor-pointer flex-col border transition-all">
            <CardContent className="flex flex-1 flex-col p-3.5">
              <div className="flex items-start gap-3">
                <div className={`${action.color} shrink-0 rounded-md p-2 text-white`}>
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-foreground mb-1 text-sm font-semibold">{action.title}</h3>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{action.description}</p>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary h-4 w-4 flex-shrink-0 transition-colors" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
