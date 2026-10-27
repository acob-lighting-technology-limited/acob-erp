"use client"

import { Input } from "@/components/ui/input"
import { BirthdayInput } from "@/components/ui/birthday-input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { AdminRoutesPicker } from "@/components/ui/admin-routes-picker"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { UserCircle, User, Briefcase, Mail, Calendar, AlertCircle, AlertTriangle } from "lucide-react"
import type { UserRole, EmploymentStatus } from "@/types/database"
import { getRoleDisplayName } from "@/lib/permissions"
import { useDepartments } from "@/hooks/use-departments"
import { useOfficeLocations } from "@/hooks/use-office-locations"
import type { EmployeeProfile } from "./types"
import { EmployeeMailboxSection } from "./EmployeeMailboxSection"
import type { EmployeeMailboxActions } from "@/lib/employees/mailbox-state"

export interface EditForm {
  role: UserRole
  admin_routes: string[]
  is_department_lead: boolean
  department: string
  office_location: string
  designation: string
  lead_departments: string[]
  employee_number: string
  device_key?: string | null
  first_name: string
  last_name: string
  other_names: string
  company_email: string
  additional_email: string
  personal_email: string
  phone_number: string
  additional_phone: string
  residential_address: string
  birthday: string
  birth_year: string
  employment_date: string
  confirmation_date: string
  job_description: string
  attendance_exempt: boolean
  employment_status: EmploymentStatus
  status_reason_code?: string
  suspension_end_date?: string
  separation_date?: string
  employment_type: "full_time" | "part_time" | "contract"
  contract_category_code?: string
  nysc_cds_day?: string
  /** Mailbox steps to apply with a status change (set by EmployeeMailboxSection). */
  mailbox_actions?: EmployeeMailboxActions
  /** True while the mailbox forward address is invalid — saving is refused. */
  mailbox_actions_invalid?: boolean
}

const STATUS_OPTIONS: { value: "active" | "suspended" | "exited"; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "exited", label: "Exited" },
]

export const EXIT_REASONS = [
  { value: "resignation", label: "Resignation" },
  { value: "mutual_separation", label: "Mutual Separation" },
  { value: "contract_completed", label: "Contract Completed" },
  { value: "retirement", label: "Retirement" },
  { value: "workforce_reduction", label: "Workforce Reduction" },
  { value: "disciplinary_dismissal", label: "Disciplinary Dismissal" },
]

export const SUSPENSION_REASONS = [
  { value: "policy_review", label: "Policy Review" },
  { value: "security_investigation", label: "Security Investigation" },
  { value: "administrative_hold", label: "Administrative Hold" },
  { value: "compliance_breach", label: "Compliance Breach" },
  { value: "temporary_access_hold", label: "Temporary Access Hold" },
]

interface EmployeeEditFormProps {
  viewEmployeeProfile: EmployeeProfile
  editForm: EditForm
  setEditForm: (form: EditForm | ((prev: EditForm) => EditForm)) => void
  DEPARTMENTS: ReturnType<typeof useDepartments>["departments"]
  officeLocations: ReturnType<typeof useOfficeLocations>["officeLocations"]
  contractCategories: Array<{ id: string; name: string; code: string }>
  getAvailableRoles: () => UserRole[]
  handleMailboxActionsChange: (actions: EmployeeMailboxActions | undefined, invalid: boolean) => void
  isTypeOrCategoryChanged: boolean
  expectedIdPreview: string
  canManageUsers: boolean
}

export function EmployeeEditForm({
  viewEmployeeProfile,
  editForm,
  setEditForm,
  DEPARTMENTS,
  officeLocations,
  contractCategories,
  getAvailableRoles,
  handleMailboxActionsChange,
  isTypeOrCategoryChanged,
  expectedIdPreview,
  canManageUsers,
}: EmployeeEditFormProps) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-5 sm:p-6">
        {/* 1. Basic Identity */}
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase">
            <User className="text-primary h-3.5 w-3.5" /> Personal Identity
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="edit_first_name" className="text-xs">
                First Name *
              </Label>
              <Input
                id="edit_first_name"
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit_last_name" className="text-xs">
                Last Name *
              </Label>
              <Input
                id="edit_last_name"
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit_other_names" className="text-xs">
                Other Names
              </Label>
              <Input
                id="edit_other_names"
                value={editForm.other_names}
                onChange={(e) => setEditForm({ ...editForm, other_names: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Date of Birth</Label>
              <div className="mt-1">
                <BirthdayInput
                  birthday={editForm.birthday}
                  birthYear={editForm.birth_year}
                  onChange={({ birthday, birthYear }) => setEditForm({ ...editForm, birthday, birth_year: birthYear })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_address" className="text-xs">
                Residential Address
              </Label>
              <Input
                id="edit_address"
                value={editForm.residential_address}
                onChange={(e) => setEditForm({ ...editForm, residential_address: e.target.value })}
                placeholder="City, State, Country"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* 2. Work & Organization */}
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase">
            <Briefcase className="text-primary h-3.5 w-3.5" /> Work & Organization
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit_department" className="text-xs">
                Department *
              </Label>
              <Select
                value={editForm.department}
                onValueChange={(value) =>
                  setEditForm({
                    ...editForm,
                    department: value,
                    lead_departments: editForm.is_department_lead
                      ? Array.from(new Set([...editForm.lead_departments, value]))
                      : editForm.lead_departments,
                  })
                }
              >
                <SelectTrigger id="edit_department" className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept} className="text-xs">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_office" className="text-xs">
                Office / Room
              </Label>
              <div className="mt-1">
                <SearchableSelect
                  value={editForm.office_location}
                  onValueChange={(value) => setEditForm({ ...editForm, office_location: value })}
                  options={officeLocations.map((loc) => ({ value: loc, label: loc }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_designation" className="text-xs">
                Designation / Title
              </Label>
              <Input
                id="edit_designation"
                value={editForm.designation}
                onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                placeholder="e.g., Senior Systems Engineer"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="edit_role" className="text-xs">
                System Role *
              </Label>
              <Select
                value={editForm.role}
                onValueChange={(value: UserRole) => {
                  setEditForm((prev) => ({
                    ...prev,
                    role: value,
                    admin_routes: value === "admin" ? prev.admin_routes : [],
                  }))
                }}
              >
                <SelectTrigger id="edit_role" className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((role) => (
                    <SelectItem key={role} value={role} className="text-xs">
                      {getRoleDisplayName(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="is_department_lead_checkbox"
              type="checkbox"
              checked={editForm.is_department_lead}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  is_department_lead: e.target.checked,
                  lead_departments: e.target.checked && prev.department ? [prev.department] : [],
                }))
              }
              className="text-primary focus:ring-primary h-3.5 w-3.5 rounded border-gray-300"
            />
            <Label htmlFor="is_department_lead_checkbox" className="cursor-pointer text-xs">
              Designate as Department Lead
            </Label>
          </div>

          {editForm.is_department_lead && (
            <div className="bg-muted/20 mt-2 space-y-1.5 rounded-lg border p-3">
              <Label className="text-xs font-semibold">Departments Led *</Label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {DEPARTMENTS.map((dept) => {
                  const checked = editForm.lead_departments.includes(dept)
                  const isLastSelected = checked && editForm.lead_departments.length === 1
                  return (
                    <div key={dept} className="flex items-center gap-2">
                      <input
                        id={`lead_dept_${dept}`}
                        type="checkbox"
                        checked={checked}
                        disabled={isLastSelected}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            lead_departments: e.target.checked
                              ? Array.from(new Set([...prev.lead_departments, dept]))
                              : prev.lead_departments.filter((name) => name !== dept),
                          }))
                        }
                        className="text-primary focus:ring-primary h-3.5 w-3.5 rounded border-gray-300 disabled:opacity-50"
                      />
                      <Label
                        htmlFor={`lead_dept_${dept}`}
                        className={`text-xs ${isLastSelected ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        {dept}
                      </Label>
                    </div>
                  )
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                A lead must hold at least one department. Taking a department from another lead leaves the rest of their
                departments intact.
              </p>
            </div>
          )}

          {editForm.role === "admin" && (
            <div className="bg-muted/20 mt-2 space-y-1.5 rounded-lg border p-3">
              <Label className="text-xs font-semibold">Admin Permitted Routes *</Label>
              <AdminRoutesPicker
                values={editForm.admin_routes}
                onChange={(values) => setEditForm((prev) => ({ ...prev, admin_routes: values }))}
              />
              <p className="text-muted-foreground text-xs">Admin role must have at least one authorized route.</p>
            </div>
          )}
        </div>

        {/* 3. Status & Staff Classification (UNIFIED IN EDIT FORM) */}
        <div className="bg-card space-y-3.5 rounded-lg border p-4 shadow-xs">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase">
              <UserCircle className="text-primary h-3.5 w-3.5" /> Employment Status & Classification
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit_status" className="text-xs">
                Employment Status (Lifecycle) *
              </Label>
              <Select
                value={editForm.employment_status}
                onValueChange={(val: EmploymentStatus) => setEditForm((prev) => ({ ...prev, employment_status: val }))}
              >
                <SelectTrigger id="edit_status" className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_staff_type" className="text-xs">
                Staff Classification (Type) *
              </Label>
              <Select
                value={editForm.employment_type}
                onValueChange={(val: "full_time" | "part_time" | "contract") => {
                  setEditForm((prev) => ({
                    ...prev,
                    employment_type: val,
                    contract_category_code:
                      val === "contract" ? prev.contract_category_code || (contractCategories[0]?.code ?? "") : "",
                  }))
                }}
              >
                <SelectTrigger id="edit_staff_type" className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time" className="text-xs">
                    Full Time
                  </SelectItem>
                  <SelectItem value="part_time" className="text-xs">
                    Part Time
                  </SelectItem>
                  <SelectItem value="contract" className="text-xs">
                    Contract Staff
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.employment_type === "contract" && (
              <div className="sm:col-span-2">
                <Label htmlFor="edit_contract_cat" className="text-xs">
                  Contract Category *
                </Label>
                <Select
                  value={editForm.contract_category_code}
                  onValueChange={(val) =>
                    setEditForm((prev) => ({
                      ...prev,
                      contract_category_code: val,
                      nysc_cds_day: val?.toUpperCase().includes("NYSC") ? prev.nysc_cds_day || "thursday" : "",
                    }))
                  }
                >
                  <SelectTrigger id="edit_contract_cat" className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="Select category (e.g. SIWES, NYSC)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.code} className="text-xs">
                        {cat.name} ({cat.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editForm.employment_type === "contract" &&
              (editForm.contract_category_code || "").toUpperCase().includes("NYSC") && (
                <div className="sm:col-span-2">
                  <Label htmlFor="edit_nysc_cds_day" className="text-xs">
                    NYSC CDS Day *
                  </Label>
                  <Select
                    value={editForm.nysc_cds_day || ""}
                    onValueChange={(val) => setEditForm((prev) => ({ ...prev, nysc_cds_day: val }))}
                  >
                    <SelectTrigger id="edit_nysc_cds_day" className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Select CDS Day (e.g. Thursday)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday" className="text-xs">
                        Monday
                      </SelectItem>
                      <SelectItem value="tuesday" className="text-xs">
                        Tuesday
                      </SelectItem>
                      <SelectItem value="wednesday" className="text-xs">
                        Wednesday
                      </SelectItem>
                      <SelectItem value="thursday" className="text-xs">
                        Thursday
                      </SelectItem>
                      <SelectItem value="friday" className="text-xs">
                        Friday
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

            {editForm.employment_status === "suspended" && (
              <>
                <div className="text-warning border-warning/30 bg-warning/10 flex items-start gap-2 rounded border p-2.5 text-xs sm:col-span-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>Disciplinary Action / Access Hold:</strong> Suspending this employee immediately deactivates
                    their system login and redirects them to the suspension notice page upon sign-in attempts.
                  </span>
                </div>
                <div>
                  <Label htmlFor="edit_suspension_reason" className="text-xs">
                    Suspension Reason *
                  </Label>
                  <Select
                    value={editForm.status_reason_code}
                    onValueChange={(val) => setEditForm((prev) => ({ ...prev, status_reason_code: val }))}
                  >
                    <SelectTrigger id="edit_suspension_reason" className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUSPENSION_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-xs">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_suspension_end" className="text-xs">
                    Expected End Date
                  </Label>
                  <Input
                    id="edit_suspension_end"
                    type="date"
                    value={editForm.suspension_end_date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, suspension_end_date: e.target.value }))}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </>
            )}

            {editForm.employment_status === "exited" && (
              <>
                <div>
                  <Label htmlFor="edit_exit_reason" className="text-xs">
                    Separation Reason *
                  </Label>
                  <Select
                    value={editForm.status_reason_code}
                    onValueChange={(val) => setEditForm((prev) => ({ ...prev, status_reason_code: val }))}
                  >
                    <SelectTrigger id="edit_exit_reason" className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Select exit reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXIT_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value} className="text-xs">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_separation_date" className="text-xs">
                    Separation Date *
                  </Label>
                  <Input
                    id="edit_separation_date"
                    type="date"
                    value={editForm.separation_date}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, separation_date: e.target.value }))}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </>
            )}

            {viewEmployeeProfile && (
              <EmployeeMailboxSection
                employeeId={viewEmployeeProfile.id}
                fromStatus={String(viewEmployeeProfile.employment_status || "active")}
                toStatus={editForm.employment_status}
                onActionsChange={handleMailboxActionsChange}
              />
            )}
          </div>

          <div className="bg-muted/30 rounded border p-2.5 text-xs">
            {isTypeOrCategoryChanged ? (
              <div className="text-warning space-y-1">
                <span className="flex items-center gap-1 text-xs font-semibold uppercase">
                  <AlertTriangle className="h-3 w-3 text-amber-600" /> Staff ID Conversion Notice
                </span>
                <p className="text-xs leading-relaxed">
                  Saving changes will convert staff type and generate a new ID series:{" "}
                  <strong className="text-primary font-mono font-bold">{expectedIdPreview}</strong>. Current ID (
                  <strong className="font-mono">{editForm.employee_number || "None"}</strong>) will be archived to
                  history.
                </p>
              </div>
            ) : (
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>
                  Current Staff ID:{" "}
                  <strong className="text-foreground font-mono font-semibold">
                    {editForm.employee_number || "None"}
                  </strong>
                </span>
                <span className="font-mono text-xs">ID series active</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Contact Details */}
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase">
            <Mail className="text-primary h-3.5 w-3.5" /> Contact Details
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit_company_email" className="text-xs">
                  Company Email *
                </Label>
                <span className="text-muted-foreground text-xs font-medium">Primary Login ID</span>
              </div>
              <Input
                id="edit_company_email"
                type="email"
                value={editForm.company_email}
                onChange={(e) => setEditForm({ ...editForm, company_email: e.target.value })}
                disabled={!canManageUsers}
                placeholder="user@acoblighting.com"
                className="mt-1 h-8 font-mono text-xs"
              />
              <p className="text-warning mt-1 flex items-center gap-1 text-xs">
                <AlertCircle className="inline h-3 w-3 shrink-0" />
                Changing this email updates the employee&apos;s login credentials.
              </p>
            </div>

            <div>
              <Label htmlFor="edit_additional_email" className="text-xs">
                Additional Email
              </Label>
              <Input
                id="edit_additional_email"
                type="email"
                value={editForm.additional_email}
                onChange={(e) => setEditForm({ ...editForm, additional_email: e.target.value })}
                placeholder="secondary@acoblighting.com"
                className="mt-1 h-8 font-mono text-xs"
              />
              <p className="text-muted-foreground mt-1 text-xs">Secondary work/contact email.</p>
            </div>

            <div>
              <Label htmlFor="edit_personal_email" className="text-xs">
                Personal Email
              </Label>
              <Input
                id="edit_personal_email"
                type="email"
                value={editForm.personal_email}
                onChange={(e) => setEditForm({ ...editForm, personal_email: e.target.value })}
                placeholder="personal@gmail.com"
                className="mt-1 h-8 font-mono text-xs"
              />
            </div>

            <div>
              <Label htmlFor="edit_phone" className="text-xs">
                Primary Phone
              </Label>
              <Input
                id="edit_phone"
                type="tel"
                value={editForm.phone_number}
                onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                placeholder="+234 800 000 0000"
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="edit_alt_phone" className="text-xs">
                Alternative Phone
              </Label>
              <Input
                id="edit_alt_phone"
                type="tel"
                value={editForm.additional_phone}
                onChange={(e) => setEditForm({ ...editForm, additional_phone: e.target.value })}
                placeholder="Alternative contact"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* 5. Employment & Job Details */}
        <div className="bg-card space-y-3 rounded-lg border p-4">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase">
            <Calendar className="text-primary h-3.5 w-3.5" /> Employment Dates & Info
          </span>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="edit_hire_date" className="text-xs">
                Employment Date
              </Label>
              <Input
                id="edit_hire_date"
                type="date"
                value={editForm.employment_date}
                onChange={(e) => setEditForm({ ...editForm, employment_date: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="edit_confirmation_date" className="text-xs">
                Confirmation Date
              </Label>
              <Input
                id="edit_confirmation_date"
                type="date"
                value={editForm.confirmation_date}
                onChange={(e) => setEditForm({ ...editForm, confirmation_date: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit_device_key" className="text-xs">
                  Biometric / Device Key
                </Label>
                <span className="text-muted-foreground font-mono text-xs">Auto-generated</span>
              </div>
              <Input
                id="edit_device_key"
                value={editForm.device_key || "Auto-derived"}
                disabled
                readOnly
                className="bg-muted/40 mt-1 h-8 cursor-not-allowed font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit_job_desc" className="text-xs">
              Job Description & Responsibilities
            </Label>
            <Textarea
              id="edit_job_desc"
              value={editForm.job_description}
              onChange={(e) => setEditForm({ ...editForm, job_description: e.target.value })}
              placeholder="Summary of core duties..."
              rows={3}
              className="mt-1 resize-none text-xs"
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
