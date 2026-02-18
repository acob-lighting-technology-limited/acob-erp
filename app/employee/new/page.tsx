"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { createClient } from "@/lib/supabase/client"
import { Loader2, CheckCircle2, User, Building2, MapPin, Mail, Phone, Briefcase } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

// Validation Schema
const formSchema = z
  .object({
    first_name: z.string().min(2, "First name must be at least 2 characters"),
    last_name: z.string().min(2, "Last name must be at least 2 characters"),
    other_names: z.string().optional(),
    department: z.string().min(1, "Please select a department"),
    other_department: z.string().optional(),
    company_role: z.string().min(2, "Company role is required"),
    personal_email: z.string().email("Invalid email address"),
    phone_number: z.string().regex(/^0[789][01]\d{8}$/, "Must be a valid Nigerian phone number (e.g., 08012345678)"),
    additional_phone_number: z.string().optional(),
    residential_address: z.string().min(5, "Address is required"),
    current_work_location: z.enum(["Office", "Site"]),
    office_location: z.string().optional(),
    honeypot: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.current_work_location === "Site" && (!data.office_location || data.office_location.trim() === "")) {
        return false
      }
      return true
    },
    {
      message: "Site location is required for Site Based employees",
      path: ["office_location"],
    }
  )

type FormValues = z.infer<typeof formSchema>

export default function EmployeeOnboardingForm() {
  const [departments, setDepartments] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDepartments() {
      const { data, error } = await supabase.from("departments").select("name").order("name")
      if (error) {
        console.error("Failed to load departments:", error)
        toast.error("Could not load departments. Please refresh the page.")
        return
      }
      if (data) {
        setDepartments(data.map((d) => d.name))
      }
    }
    fetchDepartments()
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      current_work_location: "Office",
      other_names: "",
      additional_phone_number: "",
      other_department: "",
      office_location: "",
      honeypot: "",
    },
  })

  const firstName = watch("first_name")
  const lastName = watch("last_name")
  const selectedDepartment = watch("department")
  const workLocation = watch("current_work_location")

  const sanitize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "")
  const companyEmail =
    firstName && lastName
      ? `${sanitize(lastName).charAt(0)}.${sanitize(firstName)}@org.acoblighting.com`
      : "Wait for name input..."

  async function onSubmit(data: FormValues) {
    if (data.honeypot) return

    setIsSubmitting(true)

    try {
      const actualDepartment = data.department === "Other" ? data.other_department : data.department
      if (!actualDepartment) throw new Error("Please specify your department")

      const record = {
        first_name: data.first_name,
        last_name: data.last_name,
        other_names: data.other_names || null,
        department: actualDepartment,
        company_role: data.company_role,
        company_email: companyEmail,
        personal_email: data.personal_email,
        email: data.personal_email, // MANDATORY: Map to the 'email' column which has a Not-Null constraint
        phone_number: data.phone_number,
        additional_phone_number: data.additional_phone_number || null,
        residential_address: data.residential_address,
        current_work_location: data.current_work_location,
        office_location: data.current_work_location === "Site" ? data.office_location : "Office",
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from("pending_users").insert([record])

      if (error) {
        console.error("Supabase Insert Error:", error)
        throw error
      }

      setIsSuccess(true)
      toast.success("Application Submitted", {
        description: "Your details have been sent to HR for review.",
      })
    } catch (error: any) {
      console.error("Submission Error:", error)
      toast.error("Submission Failed", {
        description: error.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-4">
        <Card className="border-border bg-card w-full max-w-md py-12 text-center shadow-xl">
          <CardContent>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 p-4 dark:bg-green-900/30">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-500" />
            </div>
            <h2 className="text-foreground mb-3 text-3xl font-bold">Application Received!</h2>
            <p className="text-muted-foreground mx-auto mb-8 max-w-sm leading-relaxed">
              Thank you, {firstName}. Your employee profile has been submitted to HR. You will receive a welcome email
              with your official login credentials once approved.
            </p>
            <Button asChild className="h-12 w-full text-base font-semibold">
              <Link href="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen px-4 py-16 font-sans transition-colors duration-300 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 space-y-4 text-center">
          <div className="mb-6 flex justify-center">
            <img
              src="/images/logo-dark-2.png"
              alt="ACOB Lighting"
              className="block h-14 dark:hidden"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <img
              src="/images/logo-dark-2.png"
              alt="ACOB Lighting"
              className="hidden h-14 brightness-0 invert dark:block"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
          <h1 className="text-foreground text-4xl font-extrabold tracking-tight">Employee Onboarding</h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Welcome to the team. Please complete your profile details below to initiate your account setup.
          </p>
        </div>

        <Card className="border-border bg-card overflow-hidden rounded-2xl shadow-2xl">
          <div className="h-2 w-full bg-gradient-to-r from-green-500 to-emerald-600"></div>
          <CardHeader className="bg-card border-border border-b px-8 pt-8 pb-4">
            <CardTitle className="text-card-foreground flex items-center gap-2 text-2xl">
              <User className="text-primary h-6 w-6" />
              Personal & Employment Information
            </CardTitle>
            <CardDescription className="mt-2 text-base">
              Ensure all information matches your official documents. Fields marked with{" "}
              <span className="text-destructive">*</span> are required.
            </CardDescription>
          </CardHeader>
          <CardContent className="bg-card text-card-foreground p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <input type="text" {...register("honeypot")} className="hidden" tabIndex={-1} autoComplete="off" />

              <div className="space-y-6">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                  <User className="text-muted-foreground h-5 w-5" /> Personal Details
                </h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      First Name <span className="text-destructive">*</span>
                    </label>
                    <Input className="h-11" placeholder="e.g. Adewale" {...register("first_name")} />
                    {errors.first_name && <p className="text-destructive mt-1 text-sm">{errors.first_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      Last Name <span className="text-destructive">*</span>
                    </label>
                    <Input className="h-11" placeholder="e.g. Okafor" {...register("last_name")} />
                    {errors.last_name && <p className="text-destructive mt-1 text-sm">{errors.last_name.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-foreground text-sm font-medium">Other Names (Optional)</label>
                  <Input className="h-11" placeholder="Middle name" {...register("other_names")} />
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                  <Phone className="text-muted-foreground h-5 w-5" /> Contact Information
                </h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      Personal Email <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="text-muted-foreground absolute top-3 left-3 h-5 w-5" />
                      <Input
                        className="h-11 pl-10"
                        type="email"
                        placeholder="john.doe@gmail.com"
                        {...register("personal_email")}
                      />
                    </div>
                    {errors.personal_email && (
                      <p className="text-destructive mt-1 text-sm">{errors.personal_email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      Phone Number <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="text-muted-foreground absolute top-3 left-3 h-5 w-5" />
                      <Input className="h-11 pl-10" placeholder="080..." {...register("phone_number")} />
                    </div>
                    {errors.phone_number && (
                      <p className="text-destructive mt-1 text-sm">{errors.phone_number.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">Additional Phone (Optional)</label>
                    <Input className="h-11" placeholder="080..." {...register("additional_phone_number")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      Residential Address <span className="text-destructive">*</span>
                    </label>
                    <Input className="h-11" placeholder="Full home address" {...register("residential_address")} />
                    {errors.residential_address && (
                      <p className="text-destructive mt-1 text-sm">{errors.residential_address.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-4">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                  <Briefcase className="text-muted-foreground h-5 w-5" /> Role & Department
                </h3>
                <div className="bg-muted/50 border-border flex flex-col justify-between gap-4 rounded-xl border p-5 md:flex-row md:items-center">
                  <div>
                    <label className="text-primary text-xs font-bold tracking-wider uppercase">
                      Expected Company ID
                    </label>
                    <div className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
                      {companyEmail}
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">This will be your official system username.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      Job Title / Role <span className="text-destructive">*</span>
                    </label>
                    <Input className="h-11" placeholder="e.g. Electrical Engineer" {...register("company_role")} />
                    {errors.company_role && (
                      <p className="text-destructive mt-1 text-sm">{errors.company_role.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      Department <span className="text-destructive">*</span>
                    </label>
                    <Select onValueChange={(val) => setValue("department", val)} defaultValue={selectedDepartment}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                        <SelectItem value="Other">Other (Specify)</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.department && <p className="text-destructive mt-1 text-sm">{errors.department.message}</p>}
                  </div>
                </div>
                {selectedDepartment === "Other" && (
                  <div className="animate-in fade-in slide-in-from-top-2 space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      Specify Department <span className="text-destructive">*</span>
                    </label>
                    <Input
                      className="h-11"
                      placeholder="Enter your department name"
                      {...register("other_department")}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-6 pt-4">
                <h3 className="text-foreground border-border flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                  <MapPin className="text-muted-foreground h-5 w-5" /> Work Location
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-foreground text-sm font-medium">
                      Current Work Base <span className="text-destructive">*</span>
                    </label>
                    <Select
                      onValueChange={(val) => setValue("current_work_location", val as "Office" | "Site")}
                      defaultValue={workLocation}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Location Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Office">Office Based</SelectItem>
                        <SelectItem value="Site">Site Based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {workLocation === "Site" ? (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-2">
                      <label className="text-foreground text-sm font-medium">
                        Site Location / Name <span className="text-destructive">*</span>
                      </label>
                      <Input
                        className="h-11"
                        placeholder="e.g. Dangote Refinery Site"
                        {...register("office_location")}
                      />
                      {errors.office_location && (
                        <p className="text-destructive mt-1 text-sm">{errors.office_location.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/50 border-border text-muted-foreground flex items-center gap-2 rounded-lg border p-4 text-sm">
                      <Building2 className="h-4 w-4" /> Default Allocation: <strong>Office</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-8">
                <Button type="submit" className="h-12 w-full text-base font-bold shadow-lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing Application...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
