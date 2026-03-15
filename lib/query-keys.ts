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
} as const
