/**
 * Centralised query key factory.
 * Using constants prevents typos and makes cache invalidation reliable.
 */
export const QUERY_KEYS = {
  // HR
  grantableLeaveTypes: (userId: string) => ["grantable-leave-types", userId],
  adminLeaveEmployees: () => ["admin-leave-employees"],
  myLunchReview: (menuId: string) => ["my-lunch-review", menuId],
  leaveRequests: (filters?: Record<string, unknown>) => (filters ? ["leave-requests", filters] : ["leave-requests"]),
  leaveBalance: (userId?: string) => ["leave-balance", userId],
  leaveTypes: () => ["leave-types"],
  leaveHolidays: () => ["leave-holidays"],
  leavePolicies: () => ["leave-policies"],
  contractCategories: () => ["contract-categories"],

  // Attendance
  attendanceDeviceStatus: () => ["attendance-device-status"],
  attendanceLeaderboard: (filters: Record<string, unknown>) => ["attendance-leaderboard", filters],
  attendanceRecords: (filters: Record<string, unknown>) => ["attendance-records", filters],
  employeeAttendanceDays: (userId: string, yearMonth: string, exempt: boolean) => [
    "employee-attendance-days",
    userId,
    yearMonth,
    exempt,
  ],
  attendanceExceptions: (filters: Record<string, unknown>) => ["attendance-exceptions", filters],
  attendanceChangeLog: (from: string, to: string) => ["attendance-change-log", from, to],
  myAttendanceDays: (yearMonth: string) => ["my-attendance-days", yearMonth],
  attendanceAppeals: (filters: Record<string, unknown>) => ["attendance-appeals", filters],
  attendanceReportConfig: () => ["attendance-report-config"],
  employeeCycleAttendance: (userId: string, start: string, end: string) => [
    "employee-cycle-attendance",
    userId,
    start,
    end,
  ],
  myProfile: () => ["my-profile"],
  attendance: (userId?: string) => ["attendance", userId],

  // Performance
  competencies: () => ["competencies"],
  myPeerFeedback: () => ["my-peer-feedback"],
  adminPeerFeedback: () => ["admin-peer-feedback"],
  myDevelopmentPlans: () => ["my-development-plans"],
  performanceCycles: () => ["performance-cycles"],
  pmsAnalytics: () => ["pms-analytics"],
  cbtAttemptDetail: (profileId: string, cycleId: string) => ["cbt-attempt-detail", profileId, cycleId],
  cbtAttempts: () => ["cbt-attempts"],
  cbtBonusScores: () => ["cbt-bonus-scores"],
  strategicGoals: (scope: string, department?: string | null, year?: number | null) => [
    "strategic-goals",
    scope,
    department ?? null,
    year ?? null,
  ],
  goals: (userId?: string) => ["goals", userId],
  reviews: (userId?: string) => ["reviews", userId],

  // Fleet
  fleetResources: () => ["fleet-resources"],
  fleetBookings: (filters?: Record<string, unknown>) => (filters ? ["fleet-bookings", filters] : ["fleet-bookings"]),

  // Help desk
  ticketAttachments: (ticketId: string) => ["ticket-attachments", ticketId],
  tickets: (filters?: Record<string, unknown>) => (filters ? ["tickets", filters] : ["tickets"]),
  ticket: (id: string) => ["ticket", id],

  // Admin
  hrProfilesAll: () => ["hr-profiles-all"],
  departments: () => ["departments"],
  departmentRows: () => ["departments", "rows"],
  officeLocations: () => ["office-locations"],
  staffAvatars: () => ["staff-avatars"],
  staffCard: (id: string) => ["staff-card", id],
  profiles: (filters?: Record<string, unknown>) => (filters ? ["profiles", filters] : ["profiles"]),
  profile: (id: string) => ["profile", id],
  assets: (filters?: Record<string, unknown>) => (filters ? ["assets", filters] : ["assets"]),
  payments: (filters?: Record<string, unknown>) => (filters ? ["payments", filters] : ["payments"]),
  notifications: () => ["notifications"],
  search: (q: string) => ["search", q],

  // Weekly reports
  meetingAttendanceSession: (week: number, year: number) => ["meeting-attendance-session", week, year],
  weeklyReportSeed: (department: string, week: number, year: number) => ["weekly-report-seed", department, week, year],
  weeklyReportLockState: (week: number, year: number) => ["weekly-report-lock", week, year],
  weeklyReports: (filters?: Record<string, unknown>) => (filters ? ["weekly-reports", filters] : ["weekly-reports"]),
  adminWeeklyReports: (filters?: Record<string, unknown>) =>
    filters ? ["admin-weekly-reports", filters] : ["admin-weekly-reports"],
  adminWeeklyReportLockState: (week: number, year: number) => ["admin-weekly-report-lock", week, year],

  // Action tracker
  actionTrackerMetadata: () => ["action-tracker-metadata"],
  actionTrackerTasks: (filters?: Record<string, unknown>) =>
    filters ? ["action-tracker-tasks", filters] : ["action-tracker-tasks"],
  adminActionTrackerTasks: (filters?: Record<string, unknown>) =>
    filters ? ["admin-action-tracker-tasks", filters] : ["admin-action-tracker-tasks"],

  // Suspension
  suspension: (userId: string) => ["suspension", userId],

  // Job description / profile data
  jobDescription: (userId: string) => ["job-description", userId],
  profileEdit: (userId: string) => ["profile-edit", userId],

  // Admin assets
  adminAssetTypes: () => ["admin-asset-types"],

  // Admin fleet
  adminFleetResources: () => ["admin-fleet-resources"],
  adminFleetBookings: (status?: string) => (status ? ["admin-fleet-bookings", status] : ["admin-fleet-bookings"]),

  // Dev login logs
  devLoginLogs: () => ["dev-login-logs"],

  // Admin onboarding (account sign-in status)
  adminOnboarding: () => ["admin-onboarding"],

  // Dev AcoBot logs
  acobotLogs: () => ["acobot-logs"],

  // Company directory
  directory: () => ["directory"],

  // Pending applications
  pendingApplications: () => ["pending-applications"],

  // Performance
  performanceCreateData: () => ["performance-create-data"],

  // Leave queue and relievers
  leaveQueue: () => ["leave-queue"],
  leaveRelievers: () => ["leave-relievers"],

  // Admin employees
  adminEmployees: (filters?: Record<string, unknown>) => (filters ? ["admin-employees", filters] : ["admin-employees"]),

  // Admin HR pages
  adminDepartmentsPage: () => ["admin-departments-page"],
  adminHrDashboard: () => ["admin-hr-dashboard"],
  adminAttendanceReports: (filters?: Record<string, unknown>) =>
    filters ? ["admin-attendance-reports", filters] : ["admin-attendance-reports"],
  adminLeaveSettings: () => ["admin-leave-settings"],
  adminOfficeLocations: () => ["admin-office-locations"],
  adminEmployeeDetail: (userId: string) => ["admin-employee-detail", userId],
  adminJobDescriptions: (filters?: Record<string, unknown>) =>
    filters ? ["admin-job-descriptions", filters] : ["admin-job-descriptions"],
  adminAuditLogs: (filters?: Record<string, unknown>) =>
    filters ? ["admin-audit-logs", filters] : ["admin-audit-logs"],

  // Finance pages
  adminBills: () => ["admin-bills"],
  adminInvoices: () => ["admin-invoices"],
  adminFinanceReports: () => ["admin-finance-reports"],

  // Settings pages
  adminUsersSettings: () => ["admin-users-settings"],
  adminRolesSettings: () => ["admin-roles-settings"],

  // Inventory pages
  adminInventoryDashboard: () => ["admin-inventory-dashboard"],
  adminProducts: (filters?: Record<string, unknown>) => (filters ? ["admin-products", filters] : ["admin-products"]),
  adminCategories: () => ["admin-categories"],
  adminWarehouses: () => ["admin-warehouses"],
  adminInventoryMovements: (filters?: Record<string, unknown>) =>
    filters ? ["admin-inventory-movements", filters] : ["admin-inventory-movements"],

  // Purchasing pages
  adminPurchasingDashboard: () => ["admin-purchasing-dashboard"],
  adminPurchaseOrders: (filters?: Record<string, unknown>) =>
    filters ? ["admin-purchase-orders", filters] : ["admin-purchase-orders"],
  adminSuppliers: () => ["admin-suppliers"],

  // App pages
  appDocumentation: () => ["app-documentation"],
  appAssets: () => ["app-assets"],
  appProjects: () => ["app-projects"],
  appProjectDetail: (id: string) => ["app-project-detail", id],
  appTasks: () => ["app-tasks"],
  appPaymentDetail: (id: string) => ["app-payment-detail", id],
  appJobDescription: () => ["app-job-description"],
  appNotifications: () => ["app-notifications"],

  // Admin purchasing detail pages
  adminSupplierDetail: (id: string) => ["admin-supplier-detail", id],
  adminPurchaseOrderDetail: (id: string) => ["admin-purchase-order-detail", id],
  adminReceiptsList: () => ["admin-receipts-list"],
  adminNewPurchaseOrderForm: () => ["admin-new-purchase-order-form"],

  // Admin inventory detail pages
  adminProductDetail: (id: string) => ["admin-product-detail", id],
  adminProductEditForm: (id: string) => ["admin-product-edit-form", id],
  adminProductCategories: () => ["admin-product-categories"],

  // Admin finance detail pages
  adminBillDetail: (id: string) => ["admin-bill-detail", id],
  adminInvoiceDetail: (id: string) => ["admin-invoice-detail", id],
  adminPaymentDetail: (id: string) => ["admin-payment-detail", id],

  // Admin assets pages
  adminAssetIssues: () => ["admin-asset-issues"],

  // Admin projects
  adminProjectDetail: (id: string) => ["admin-project-detail", id],

  // Settings
  adminCurrentUserRole: () => ["admin-current-user-role"],

  // Employee onboarding form
  employeeOnboardingDepartments: () => ["employee-onboarding-departments"],
  employeeOnboardingOfficeLocations: () => ["employee-onboarding-office-locations"],

  // HR change-status dialog
  hrEmployeeStatusBlockers: (employeeId: string) => ["hr-employee-status-blockers", employeeId],
  hrLeaveTypesActive: () => ["hr-leave-types-active"],

  // Components
  myFeedbackLeads: () => ["my-feedback-leads"],
  feedbackViewer: () => ["feedback-viewer-filter"],
  paymentsTable: (filters?: Record<string, unknown>) => (filters ? ["payments-table", filters] : ["payments-table"]),
  notificationBell: () => ["notification-bell"],
  weeklyReportDialog: (week: number, year: number) => ["weekly-report-dialog", week, year],
  adminWeeklySummaryMail: (filters?: Record<string, unknown>) =>
    filters ? ["admin-weekly-summary-mail", filters] : ["admin-weekly-summary-mail"],

  // Communications
  adminReminderSchedules: (mode: string) => ["admin-reminder-schedules", mode],
  adminKssRotation: () => ["admin-kss-rotation"],

  // Events calendar
  events: (range?: Record<string, unknown>) => (range ? ["events", range] : ["events"]),
  eventOptions: () => ["event-options"],
  pendingRsvpCount: () => ["pending-rsvp-count"],
  calendarBadgeData: () => ["calendar-badge-data"],
  mdDeskOverview: () => ["md-desk-overview"],
  mdDeskDelegates: () => ["md-desk-delegates"],
  mdDeskTaskReviews: () => ["md-desk-task-reviews"],

  // Security
  adminSecurityEmployees: () => ["admin-security-employees"],
  adminSecurityNetworkActivity: (filters?: Record<string, unknown>) =>
    filters ? ["admin-security-network-activity", filters] : ["admin-security-network-activity"],

  // Dev / maintenance
  leaveFlowTestFormData: () => ["leave-flow-test-form-data"],
  devTestsFormData: () => ["dev-tests-form-data"],
  maintenanceState: () => ["maintenance-state"],

  // Requisitions
  requisition: (id: string) => ["requisition", id],

  // Payroll
  payrollPeriods: () => ["payroll-periods"],

  // Documents
  generalDocumentation: () => ["general-documentation"],
  onedrivePreview: (path: string, accessMode: string, department?: string) => [
    "onedrive-preview",
    path,
    accessMode,
    department ?? null,
  ],

  // Correspondence
  correspondenceRequesters: (department: string) => ["correspondence-requesters", department],
  correspondenceCategories: () => ["correspondence-categories"],

  // Projects
  portfolios: () => ["portfolios"],
} as const
