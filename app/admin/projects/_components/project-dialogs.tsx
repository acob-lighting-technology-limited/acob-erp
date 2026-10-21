"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import {
  DEFAULT_PROJECT_PRIORITY,
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  normalizePriority,
} from "@/lib/projects/priority"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import type { Project } from "@/components/projects/project-list-content"
import { apiJson } from "@/lib/api-client"
import { applyServerErrors } from "@/lib/forms/server-errors"
import { ProjectInputSchema, type ProjectInput } from "@/lib/projects/schemas"
import { usePortfolios } from "@/hooks/use-portfolios"

const PRIORITY_OPTIONS = PROJECT_PRIORITIES.map((value) => ({ value, label: PROJECT_PRIORITY_LABELS[value] }))

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Ongoing (Active)" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

type Profile = {
  id: string
  first_name: string
  last_name: string
  full_name?: string | null
  department: string
}

interface ProjectDialogsProps {
  profiles: Profile[]
  isAddOpen: boolean
  setIsAddOpen: (open: boolean) => void
  isEditOpen: boolean
  setIsEditOpen: (open: boolean) => void
  selectedProject: Project | null
  onSuccess: () => void
  /** Pre-selects the portfolio when adding, e.g. when creating from a portfolio. */
  defaultPortfolioId?: string | null
}

export function ProjectDialogs({
  profiles,
  isAddOpen,
  setIsAddOpen,
  isEditOpen,
  setIsEditOpen,
  selectedProject,
  onSuccess,
  defaultPortfolioId = null,
}: ProjectDialogsProps) {
  return (
    <>
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>Add Project Profile</DialogTitle>
            <DialogDescription>Create a new ongoing project deployment record.</DialogDescription>
          </DialogHeader>
          {/* Content unmounts when the dialog closes, so each opening starts a blank project. */}
          <ProjectForm
            project={null}
            defaultPortfolioId={defaultPortfolioId}
            profiles={profiles}
            onCancel={() => setIsAddOpen(false)}
            onSaved={() => {
              setIsAddOpen(false)
              onSuccess()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen && Boolean(selectedProject)} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>Edit Project Profile</DialogTitle>
            <DialogDescription>Modify fields and overall status of the deployment profile.</DialogDescription>
          </DialogHeader>
          {selectedProject && (
            <ProjectForm
              key={selectedProject.id}
              project={selectedProject}
              defaultPortfolioId={null}
              profiles={profiles}
              onCancel={() => setIsEditOpen(false)}
              onSaved={() => {
                setIsEditOpen(false)
                onSuccess()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** One form for both dialogs — they were two copies that had to be kept in step by hand. */
function ProjectForm({
  project,
  defaultPortfolioId,
  profiles,
  onCancel,
  onSaved,
}: {
  project: Project | null
  defaultPortfolioId: string | null
  profiles: Profile[]
  onCancel: () => void
  onSaved: () => void
}) {
  const isEdit = Boolean(project)
  // A project may sit outside every portfolio, so a failed load must not block
  // the form — it just leaves the selector empty.
  const { data: portfoliosData } = usePortfolios({ enabled: true })
  const portfolioOptions = [
    { value: "", label: "No portfolio" },
    ...(portfoliosData?.data ?? []).map((portfolio) => ({
      value: portfolio.id,
      label: portfolio.code ? `${portfolio.code} — ${portfolio.name}` : portfolio.name,
    })),
  ]
  const managerOptions = [
    { value: "", label: "Unassigned" },
    ...profiles.map((p) => ({ value: p.id, label: p.full_name || `${p.first_name} ${p.last_name}` })),
  ]

  const form = useForm<ProjectInput>({
    resolver: zodResolver(ProjectInputSchema),
    defaultValues: project
      ? {
          project_name: project.project_name,
          location: project.location,
          deployment_start_date: project.deployment_start_date,
          deployment_end_date: project.deployment_end_date,
          capacity_w: project.capacity_w ? String(project.capacity_w) : "",
          technology_type: project.technology_type || "",
          project_manager_id: project.project_manager_id || "",
          description: project.description || "",
          status: project.status,
          portfolio_id: project.portfolio_id || "",
          priority: normalizePriority(project.priority),
        }
      : {
          project_name: "",
          location: "",
          deployment_start_date: "",
          deployment_end_date: "",
          capacity_w: "",
          technology_type: "",
          project_manager_id: "",
          description: "",
          status: "planning",
          portfolio_id: defaultPortfolioId ?? "",
          priority: DEFAULT_PROJECT_PRIORITY,
        },
  })

  const save = useMutation({
    mutationFn: (values: ProjectInput) =>
      apiJson(isEdit ? `/api/projects/${project!.id}` : "/api/projects", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          capacity_w: values.capacity_w ? Number(values.capacity_w) : null,
          technology_type: values.technology_type || null,
          project_manager_id: values.project_manager_id || null,
          description: values.description || null,
          portfolio_id: values.portfolio_id || null,
        }),
      }),
    onSuccess: () => {
      toast.success(isEdit ? "Project updated successfully!" : "Project created successfully!")
      onSaved()
    },
    onError: (error) => {
      const message = applyServerErrors(error, form.setError, Object.keys(form.getValues()))
      if (message) toast.error(message)
    },
  })

  const required = <span className="text-red-500">*</span>

  const textField = (
    name: "project_name" | "location" | "technology_type" | "deployment_start_date" | "deployment_end_date",
    label: React.ReactNode,
    options: { type?: string; placeholder?: string } = {}
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-semibold">{label}</FormLabel>
          <FormControl>
            <Input type={options.type} placeholder={options.placeholder} {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const selectField = (
    name: "portfolio_id" | "project_manager_id" | "priority" | "status",
    label: string,
    selectOptions: Array<{ value: string; label: string }>,
    placeholder: string,
    searchPlaceholder: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-semibold">{label}</FormLabel>
          <SearchableSelect
            value={(field.value as string | null | undefined) ?? ""}
            onValueChange={(value) => field.onChange(name === "priority" ? normalizePriority(value) : value)}
            options={selectOptions}
            placeholder={placeholder}
            searchPlaceholder={searchPlaceholder}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="space-y-4 py-2">
        {textField("project_name", <>Project Title {required}</>, {
          placeholder: isEdit ? "Project name" : "e.g. 1155KWp INTERCONNECTED MINI-GRID",
        })}

        <div className="grid grid-cols-2 gap-4">
          {textField("location", <>Site Location {required}</>, { placeholder: isEdit ? "Location" : "City, State" })}
          {textField("technology_type", "Technology Type", {
            placeholder: isEdit ? "Tech" : "e.g. Interconnected Mini-Grid",
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="capacity_w"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Power Capacity (Watts)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={isEdit ? "Watts" : "e.g. 1155000"}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {selectField("portfolio_id", "Portfolio", portfolioOptions, "No portfolio", "Search portfolios...")}
          {selectField("project_manager_id", "Project Manager", managerOptions, "Unassigned", "Search staff...")}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {textField("deployment_start_date", <>Start Date {required}</>, { type: "date" })}
          {textField("deployment_end_date", <>Target End Date {required}</>, { type: "date" })}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {selectField("priority", "Priority", PRIORITY_OPTIONS, "Select priority", "Search priority...")}
          {selectField("status", "Stage", STATUS_OPTIONS, "Select stage", "Search stage...")}
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold">Project Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={isEdit ? "Description" : "Details of project scope, timelines, etc."}
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {isEdit ? "Save Changes" : "Create Project"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
