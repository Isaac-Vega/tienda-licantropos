export type Product = {
  id: string
  name: string
  barcode: string | null
  category: string | null
  brand: string | null
  purchase_price: number
  sale_price: number
  stock: number
  min_stock: number
  expiration_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}