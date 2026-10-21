import { z } from "zod"
import { ASSIGNABLE_ROLES } from "@/lib/role-management"

/** Body of POST /api/admin/users/invite — shared by the route and the invite dialog. */
export const InviteUserSchema = z.object({
  email: z.string().trim().min(1, "Email is required"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  department: z.string().optional(),
})

export type InviteUserInput = z.infer<typeof InviteUserSchema>
