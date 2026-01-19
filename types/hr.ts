/**
 * HR Module Types
 * Types specific to Human Resources functionality
 */

import type { UserRole } from "./database"

// ============================================
// Employee Types
// ============================================

export interface Employee {
    id: string
    company_email: string
    first_name: string
    last_name: string
    full_name?: string | null
    other_names?: string
    department?: string
    department_id?: string | null
    company_role?: string
    phone_number?: string
    additional_phone?: string
    residential_address?: string
    current_work_location?: string
    office_location?: string
    is_admin: boolean
    role: UserRole
    is_department_lead: boolean
    lead_departments: string[]
    job_description?: string
    job_description_updated_at?: string
    created_at: string
    updated_at: string
}

export interface EmployeeFormData {
    first_name: string
    last_name: string
    other_names?: string
    department?: string
    department_id?: string
    company_role?: string
    phone_number?: string
    additional_phone?: string
    residential_address?: string
    current_work_location?: string
    office_location?: string
    role?: UserRole
}

// ============================================
// Department Types
// ============================================

export interface Department {
    id: string
    name: string
    description?: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface DepartmentWithStats extends Department {
    employee_count?: number
    lead?: Employee
}

// ============================================
// Attendance Types
// ============================================

export type AttendanceStatus = "present" | "absent" | "late" | "half_day" | "on_leave"

export interface AttendanceRecord {
    id: string
    employee_id: string
    date: string
    clock_in?: string
    clock_out?: string
    status: AttendanceStatus
    notes?: string
    created_at: string
    updated_at: string
}

export interface AttendanceSummary {
    present: number
    absent: number
    late: number
    half_day: number
    on_leave: number
    total: number
}

// ============================================
// Leave Types
// ============================================

export type LeaveType = "annual" | "sick" | "maternity" | "paternity" | "unpaid" | "compassionate" | "study"
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled"

export interface LeaveRequest {
    id: string
    employee_id: string
    leave_type: LeaveType
    start_date: string
    end_date: string
    days_requested: number
    reason?: string
    status: LeaveStatus
    approved_by?: string
    approved_at?: string
    rejection_reason?: string
    created_at: string
    updated_at: string
}

export interface LeaveBalance {
    id: string
    employee_id: string
    leave_type: LeaveType
    year: number
    total_days: number
    used_days: number
    remaining_days: number
}

// ============================================
// Performance Types
// ============================================

export type PerformanceRating = 1 | 2 | 3 | 4 | 5
export type ReviewStatus = "draft" | "submitted" | "acknowledged"

export interface PerformanceGoal {
    id: string
    employee_id: string
    title: string
    description?: string
    target_date?: string
    progress: number
    status: "not_started" | "in_progress" | "completed" | "cancelled"
    created_at: string
    updated_at: string
}

export interface PerformanceReview {
    id: string
    employee_id: string
    reviewer_id: string
    review_period_start: string
    review_period_end: string
    overall_rating?: PerformanceRating
    strengths?: string
    areas_for_improvement?: string
    goals_for_next_period?: string
    employee_comments?: string
    status: ReviewStatus
    submitted_at?: string
    acknowledged_at?: string
    created_at: string
    updated_at: string
}

// ============================================
// Recruitment Types (Future)
// ============================================

export type JobStatus = "draft" | "open" | "closed" | "on_hold"
export type ApplicantStatus = "new" | "screening" | "interview" | "offer" | "hired" | "rejected"

export interface JobPosting {
    id: string
    title: string
    department_id: string
    description: string
    requirements: string[]
    location?: string
    employment_type: "full_time" | "part_time" | "contract"
    salary_range?: {
        min: number
        max: number
        currency: string
    }
    status: JobStatus
    posted_at?: string
    closes_at?: string
    created_by: string
    created_at: string
    updated_at: string
}

export interface Applicant {
    id: string
    job_id: string
    first_name: string
    last_name: string
    email: string
    phone?: string
    resume_url?: string
    cover_letter?: string
    status: ApplicantStatus
    notes?: string
    created_at: string
    updated_at: string
}

// ============================================
// Training Types (Future)
// ============================================

export interface TrainingProgram {
    id: string
    title: string
    description?: string
    duration_hours: number
    is_mandatory: boolean
    department_id?: string
    created_at: string
    updated_at: string
}

export interface TrainingEnrollment {
    id: string
    program_id: string
    employee_id: string
    status: "enrolled" | "in_progress" | "completed" | "cancelled"
    enrolled_at: string
    completed_at?: string
    score?: number
}
