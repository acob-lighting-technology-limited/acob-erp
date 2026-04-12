import Link from "next/link"
import { FolderKanban, Goal, Headset, ClipboardList } from "lucide-react"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const nextSteps = [
  {
    title: "Department Goals",
    href: "/goals",
    icon: Goal,
    description: "Goals are now the planning layer for each department. Leads create yearly goals there.",
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ClipboardList,
    description: "Tasks now sit directly under approved goals and are assigned to one person or the department queue.",
  },
  {
    title: "Help Desk",
    href: "/help-desk",
    icon: Headset,
    description: "Help desk work now links back into goals before execution so KPI tracking stays aligned.",
  },
]

export interface Project {
  id: string
  project_name: string
  location: string
  deployment_start_date: string
  deployment_end_date: string
  capacity_w?: number
  technology_type?: string
  description?: string
  status: string
  created_at: string
  project_manager?: {
    first_name: string
    last_name: string
  }
  created_by_user?: {
    first_name: string
    last_name: string
  }
}

export default function ProjectsPage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Projects Deprecated"
        description="Project workflows have been retired from the active PMS flow. Use goals, tasks, and help desk instead."
        icon={FolderKanban}
        backLink={{ href: "/profile", label: "Back to Dashboard" }}
      />

      <Section
        title="What Changed"
        description="The new workflow starts with department goals, then moves into individual or department tasks."
      >
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            <p>
              Department leads now create yearly goals for their departments. Personal standalone goals and
              project-driven work planning are no longer the main workflow.
            </p>
            <p>
              Tasks are created under those goals and assigned either to one person or to the department queue. Help
              desk items must also link to a goal before work starts.
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section title="Use These Instead" description="These routes replace the old project flow.">
        <div className="grid gap-3 md:grid-cols-3">
          {nextSteps.map((item) => (
            <Card key={item.href}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <item.icon className="text-primary h-5 w-5" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={item.href}>
                  <Button className="w-full">Open {item.title}</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </PageWrapper>
  )
}
