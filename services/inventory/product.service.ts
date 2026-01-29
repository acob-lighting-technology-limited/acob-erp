import { BaseService } from "../base.service"

export interface ProductCategoryFields {
  id?: string
  name: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface ProductFields {
  id?: string
  sku: string
  name: string
  description?: string
  category_id?: string
  unit_cost: number
  selling_price: number
  quantity_on_hand: number
  reorder_level: number
  status: "active" | "inactive" | "discontinued"
  created_by?: string
  created_at?: string
  updated_at?: string
}

/**
 * Service for managing products in the inventory module.
 */
export class ProductService extends BaseService {
  constructor() {
    super("products")
  }

  /**
   * Get all products with category names
   */
  async getAllWithCategories() {
    const supabase = await this.getClient()

    const { data, error } = await supabase
      .from(this.tableName)
      .select("*, category:product_categories(name)")
      .order("name")

    if (error) {
      if (error.code === "42P01") {
        // Table doesn't exist yet
        return []
      }
      throw error
    }

    return (data || []).map((p: any) => ({
      ...p,
      category_name: p.category?.name,
    }))
  }

  /**
   * Get products with low stock (at or below reorder level)
   */
  async getLowStockProducts() {
    const supabase = await this.getClient()

    const { data, error } = await supabase.from(this.tableName).select("*").lte("quantity_on_hand", "reorder_level")

    if (error) throw error
    return data || []
  }

  /**
   * Get product statistics
   */
  async getStats() {
    const supabase = await this.getClient()

    const [{ count: total }, { count: active }, { data: products }] = await Promise.all([
      supabase.from(this.tableName).select("*", { count: "exact", head: true }),
      supabase.from(this.tableName).select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from(this.tableName).select("unit_cost, quantity_on_hand, reorder_level"),
    ])

    const lowStock = products?.filter((p: any) => p.quantity_on_hand <= p.reorder_level).length || 0
    const totalValue = products?.reduce((sum: number, p: any) => sum + p.unit_cost * p.quantity_on_hand, 0) || 0

    return {
      total: total || 0,
      active: active || 0,
      lowStock,
      totalValue,
    }
  }

  /**
   * Update product stock quantity
   */
  async updateStock(id: string, quantity: number) {
    return this.update(id, { quantity_on_hand: quantity })
  }
}

export const productService = new ProductService()
