/**
 * Centralised query key factory.
 * Using constants prevents typos and makes cache invalidation reliable.
 */
export const QUERY_KEYS = {
  // HR
  leaveRequests: (filters?: Record<string, unknown>) => (filters ? ["leave-requests", filters] : ["leave-requests"]),
  leaveBalance: (userId?: string) => ["leave-balance", userId],
  leaveTypes: () => ["leave-types"],
  leaveHolidays: () => ["leave-holidays"],
  leavePolicies: () => ["leave-policies"],

  // Attendance
  attendance: (userId?: string) => ["attendance", userId],

  // Performance
  goals: (userId?: string) => ["goals", userId],
  reviews: (userId?: string) => ["reviews", userId],

  // Fleet
  fleetResources: () => ["fleet-resources"],
  fleetBookings: (filters?: Record<string, unknown>) => (filters ? ["fleet-bookings", filters] : ["fleet-bookings"]),

  // Help desk
  tickets: (filters?: Record<string, unknown>) => (filters ? ["tickets", filters] : ["tickets"]),
  ticket: (id: string) => ["ticket", id],

  // Admin
  departments: () => ["departments"],
  profiles: (filters?: Record<string, unknown>) => (filters ? ["profiles", filters] : ["profiles"]),
  profile: (id: string) => ["profile", id],
  assets: (filters?: Record<string, unknown>) => (filters ? ["assets", filters] : ["assets"]),
  payments: (filters?: Record<string, unknown>) => (filters ? ["payments", filters] : ["payments"]),
  notifications: () => ["notifications"],
  search: (q: string) => ["search", q],

  // Weekly reports
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

  // Pending applications
  pendingApplications: () => ["pending-applications"],

  // Performance
  performanceCreateData: () => ["performance-create-data"],

  // Leave queue and relievers
  leaveQueue: () => ["leave-queue"],
  leaveRelievers: () => ["leave-relievers"],

  // Admin employees
  adminEmployees: (filters?: Record<string, unknown>) => (filters ? ["admin-employees", filters] : ["admin-employees"]),
} as const
