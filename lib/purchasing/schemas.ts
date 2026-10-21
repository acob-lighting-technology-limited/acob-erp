import { z } from "zod"

/** Body of POST /api/admin/purchasing/suppliers and PATCH …/suppliers/[id]; also the supplier form. */
export const SupplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim().min(1, "Code is required"),
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  contact_person: z.string().trim().optional().nullable(),
  is_active: z.boolean(),
})

export type SupplierInput = z.infer<typeof SupplierSchema>
