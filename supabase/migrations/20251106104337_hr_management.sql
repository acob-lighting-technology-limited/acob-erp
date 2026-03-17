-- ============================================
-- HR Management Module
-- ============================================
-- This migration creates tables for:
-- - Time & Attendance
-- - Leave Management
-- - Payroll
-- - Performance Management
-- - Recruitment

-- ============================================
-- TIME & ATTENDANCE
-- ============================================

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIME,
  clock_out TIME,
  break_duration INTEGER DEFAULT 0, -- in minutes
  total_hours DECIMAL(5,2),
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  shift_id UUID REFERENCES shifts(id),
  status VARCHAR(20) DEFAULT 'present', -- present, absent, late, half_day
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Timesheets
CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours DECIMAL(6,2) DEFAULT 0,
  overtime_hours DECIMAL(6,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft', -- draft, submitted, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Overtime requests
CREATE TABLE IF NOT EXISTS overtime_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours DECIMAL(4,2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LEAVE MANAGEMENT
-- ============================================

-- Leave types
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE, -- ANNUAL, SICK, CASUAL, etc.
  max_days INTEGER NOT NULL,
  is_paid BOOLEAN DEFAULT true,
  carry_forward BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leave balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  allocated_days INTEGER NOT NULL DEFAULT 0,
  used_days INTEGER NOT NULL DEFAULT 0,
  carry_forward_days INTEGER DEFAULT 0,
  balance_days INTEGER GENERATED ALWAYS AS (allocated_days + carry_forward_days - used_days) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, leave_type_id, year)
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, cancelled
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leave approvals (for multi-level approval)
CREATE TABLE IF NOT EXISTS leave_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approval_level INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  comments TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(leave_request_id, approver_id, approval_level)
);

-- ============================================
-- PAYROLL MANAGEMENT
-- ============================================

-- Payroll periods
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pay_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- draft, processing, completed, locked
  total_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(start_date, end_date)
);

-- Salary components
CREATE TABLE IF NOT EXISTS salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE, -- BASIC, HRA, ALLOWANCE, etc.
  type VARCHAR(20) NOT NULL, -- earning, deduction
  is_taxable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee salaries
CREATE TABLE IF NOT EXISTS employee_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  basic_salary DECIMAL(10,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  bank_account_number VARCHAR(50),
  bank_name VARCHAR(100),
  bank_sort_code VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Salary structure (components breakdown)
CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_salary_id UUID NOT NULL REFERENCES employee_salaries(id) ON DELETE CASCADE,
  salary_component_id UUID NOT NULL REFERENCES salary_components(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2), -- if amount is percentage-based
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_salary_id, salary_component_id)
);

-- Payroll entries
CREATE TABLE IF NOT EXISTS payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  basic_salary DECIMAL(10,2) NOT NULL,
  gross_salary DECIMAL(10,2) NOT NULL,
  total_deductions DECIMAL(10,2) DEFAULT 0,
  net_salary DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  bonus DECIMAL(10,2) DEFAULT 0,
  overtime_pay DECIMAL(10,2) DEFAULT 0,
  leave_deduction DECIMAL(10,2) DEFAULT 0,
  other_deductions DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, failed
  payslip_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(payroll_period_id, user_id)
);

-- Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_entry_id UUID NOT NULL REFERENCES payroll_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  payslip_number VARCHAR(50) UNIQUE NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PERFORMANCE MANAGEMENT
-- ============================================

-- Review cycles
CREATE TABLE IF NOT EXISTS review_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  review_type VARCHAR(50) NOT NULL, -- annual, quarterly, monthly
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance reviews
CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_cycle_id UUID NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  overall_rating DECIMAL(3,1), -- 1.0 to 5.0
  status VARCHAR(20) DEFAULT 'draft', -- draft, in_progress, completed, approved
  self_review_completed BOOLEAN DEFAULT false,
  manager_review_completed BOOLEAN DEFAULT false,
  employee_comments TEXT,
  manager_comments TEXT,
  goals_achieved INTEGER DEFAULT 0,
  goals_total INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, review_cycle_id, reviewer_id)
);

-- Goals/Objectives (OKRs)
CREATE TABLE IF NOT EXISTS goals_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_cycle_id UUID REFERENCES review_cycles(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target_value DECIMAL(10,2),
  achieved_value DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, achieved, failed
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance ratings
CREATE TABLE IF NOT EXISTS performance_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_review_id UUID NOT NULL REFERENCES performance_reviews(id) ON DELETE CASCADE,
  criterion VARCHAR(200) NOT NULL,
  rating DECIMAL(3,1) NOT NULL, -- 1.0 to 5.0
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RECRUITMENT
-- ============================================

-- Job postings
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  department VARCHAR(100),
  job_type VARCHAR(50), -- full_time, part_time, contract, internship
  location VARCHAR(100),
  description TEXT NOT NULL,
  requirements TEXT,
  salary_range_min DECIMAL(10,2),
  salary_range_max DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, closed, filled
  posted_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMP WITH TIME ZONE,
  closing_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Applications
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  applicant_name VARCHAR(200) NOT NULL,
  applicant_email VARCHAR(255) NOT NULL,
  applicant_phone VARCHAR(50),
  resume_url TEXT,
  cover_letter TEXT,
  status VARCHAR(20) DEFAULT 'applied', -- applied, shortlisted, interview, rejected, hired
  source VARCHAR(50), -- website, referral, job_board, etc.
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interviews
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  interview_type VARCHAR(50), -- phone, video, in_person
  scheduled_date TIMESTAMP WITH TIME ZONE,
  interviewer_id UUID REFERENCES auth.users(id),
  location TEXT,
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, completed, cancelled, rescheduled
  feedback TEXT,
  rating DECIMAL(3,1), -- 1.0 to 5.0
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  offer_salary DECIMAL(10,2) NOT NULL,
  offer_date DATE NOT NULL,
  start_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, withdrawn
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_attendance_user_date ON attendance_records(user_id, date);
CREATE INDEX idx_timesheets_user_week ON timesheets(user_id, week_start_date);
CREATE INDEX idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_payroll_entries_user ON payroll_entries(user_id);
CREATE INDEX idx_payroll_entries_period ON payroll_entries(payroll_period_id);
CREATE INDEX idx_performance_reviews_user ON performance_reviews(user_id);
CREATE INDEX idx_applications_job ON applications(job_posting_id);
CREATE INDEX idx_applications_status ON applications(status);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Basic policies: Users can view their own data, admins can view all
-- Attendance
CREATE POLICY "Users can view own attendance" ON attendance_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attendance" ON attendance_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);

-- Leave
CREATE POLICY "Users can view own leave" ON leave_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all leave" ON leave_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);

-- Payroll
CREATE POLICY "Users can view own payroll" ON payroll_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all payroll" ON payroll_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);

-- Performance
CREATE POLICY "Users can view own reviews" ON performance_reviews FOR SELECT USING (auth.uid() = user_id OR auth.uid() = reviewer_id);
CREATE POLICY "Admins can view all reviews" ON performance_reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);

-- Recruitment
CREATE POLICY "Admins can manage recruitment" ON job_postings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
);

-- ============================================
-- AUDIT LOGGING
-- ============================================

-- Add audit logging triggers for all HR tables
-- (These will use the existing audit_logging function)

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';;
