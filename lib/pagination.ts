import { z } from "zod"

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
})

export type PaginationParams = z.infer<typeof PaginationSchema>

export function getPaginationRange(params: PaginationParams): { from: number; to: number } {
  const from = (params.page - 1) * params.per_page
  const to = from + params.per_page - 1
  return { from, to }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export function paginatedResponse<T>(data: T[], total: number, params: PaginationParams): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: params.page,
      per_page: params.per_page,
      total,
      total_pages: Math.ceil(total / params.per_page),
    },
  }
}
