import Link from "next/link"
import { ClipboardList, FolderKanban, Goal, Headset } from "lucide-react"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const adminLinks = [
  {
    title: "PMS Goals",
    href: "/admin/hr/pms/goals",
    icon: Goal,
    description: "Department leads now create and monitor goals from the PMS goals area.",
  },
  {
    title: "Task Management",
    href: "/admin/tasks",
    icon: ClipboardList,
    description: "Create individual or department tasks directly under approved goals.",
  },
  {
    title: "Help Desk Management",
    href: "/admin/help-desk",
    icon: Headset,
    description: "Track tickets that must be linked to goals before execution starts.",
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
  project_manager_id?: string
  project_manager?: {
    first_name: string
    last_name: string
  }
}

export interface employee {
  id: string
  first_name: string
  last_name: string
  company_email: string
  department: string
  employment_status?: string | null
}

export default function AdminProjectsPage() {
  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Projects Deprecated"
        description="The old project management module is being retired from active operations."
        icon={FolderKanban}
        backLink={{ href: "/admin", label: "Back to Admin" }}
      />

      <Section
        title="Admin Workflow"
        description="The replacement flow is now department goal -> task assignment -> approved weekly progress."
      >
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            <p>
              Project planning is no longer the primary work-management path. Department leads should create yearly
              department goals, then create tasks under those goals for individual staff or the department queue.
            </p>
            <p>
              Help desk work also joins this model: once a department receives a ticket, the assigned handler must link
              it to a goal before work proceeds.
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section title="Use These Admin Areas" description="These admin routes replace the retired project flow.">
        <div className="grid gap-3 md:grid-cols-3">
          {adminLinks.map((item) => (
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
