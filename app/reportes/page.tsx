'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Product } from '@/types/product'

type Sale = {
  id: string
  total: number
  payment_method: string | null
  created_at: string
}

type SaleItem = {
  id: string
  product_id: string
  quantity: number
  subtotal: number
  products?: {
    name: string
  } | null
}

type TopProduct = {
  name: string
  quantity: number
  total: number
}

export default function ReportsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [message, setMessage] = useState('')

  async function loadData() {
    setMessage('')

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true })

    if (productsError) {
      setMessage(`Error al cargar productos: ${productsError.message}`)
      return
    }

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (salesError) {
      setMessage(`Error al cargar ventas: ${salesError.message}`)
      return
    }

    const { data: saleItemsData, error: saleItemsError } = await supabase
      .from('sale_items')
      .select(`
        id,
        product_id,
        quantity,
        subtotal,
        products (
          name
        )
      `)

    if (saleItemsError) {
      setMessage(`Error al cargar detalle de ventas: ${saleItemsError.message}`)
      return
    }

    setProducts(productsData ?? [])
    setSales(salesData ?? [])
    setSaleItems(((saleItemsData ?? []) as unknown) as SaleItem[])
  }

  useEffect(() => {
    loadData()
  }, [])

  const todaySales = useMemo(() => {
    const today = new Date().toLocaleDateString('es-MX')

    return sales.filter((sale) => {
      const saleDate = new Date(sale.created_at).toLocaleDateString('es-MX')
      return saleDate === today
    })
  }, [sales])

  const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.total), 0)

  const totalInventoryValue = products.reduce((sum, product) => {
    return sum + Number(product.sale_price) * Number(product.stock)
  }, 0)

  const lowStockProducts = products.filter((product) => {
    return product.stock > 0 && product.stock <= product.min_stock
  })

  const outOfStockProducts = products.filter((product) => product.stock === 0)

  const topProducts = useMemo(() => {
    const map = new Map<string, TopProduct>()

    saleItems.forEach((item) => {
      const name = item.products?.name ?? 'Producto no encontrado'
      const current = map.get(item.product_id)

      if (current) {
        current.quantity += item.quantity
        current.total += Number(item.subtotal)
        map.set(item.product_id, current)
        return
      }

      map.set(item.product_id, {
        name,
        quantity: item.quantity,
        total: Number(item.subtotal),
      })
    })

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }, [saleItems])

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Reportes</h1>
          <p style={subtitleStyle}>
            Resumen rápido de ventas, inventario y productos críticos.
          </p>
        </div>

        <div style={navStyle}>
          <a href="/" style={linkStyle}>Inicio</a>
          <a href="/productos" style={linkStyle}>Productos</a>
          <a href="/inventario" style={linkStyle}>Inventario</a>
          <a href="/ventas" style={linkStyle}>Ventas</a>
        </div>
      </section>

      {message && <p style={messageStyle}>{message}</p>}

      <section style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Ventas de hoy</span>
          <strong style={summaryNumberStyle}>{todaySales.length}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Total vendido hoy</span>
          <strong style={summaryNumberStyle}>${todayTotal.toFixed(2)}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Productos registrados</span>
          <strong style={summaryNumberStyle}>{products.length}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Valor del inventario</span>
          <strong style={summaryNumberStyle}>
            ${totalInventoryValue.toFixed(2)}
          </strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Productos con stock bajo</span>
          <strong style={summaryNumberStyle}>{lowStockProducts.length}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Productos agotados</span>
          <strong style={summaryNumberStyle}>{outOfStockProducts.length}</strong>
        </div>
      </section>

      <section style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Productos con stock bajo</h2>

          {lowStockProducts.length === 0 ? (
            <p style={emptyTextStyle}>No hay productos con stock bajo.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Mínimo</th>
                </tr>
              </thead>

              <tbody>
                {lowStockProducts.map((product) => (
                  <tr key={product.id}>
                    <td style={tdStyle}>{product.name}</td>
                    <td style={tdStyle}>{product.stock}</td>
                    <td style={tdStyle}>{product.min_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Productos agotados</h2>

          {outOfStockProducts.length === 0 ? (
            <p style={emptyTextStyle}>No hay productos agotados.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Categoría</th>
                </tr>
              </thead>

              <tbody>
                {outOfStockProducts.map((product) => (
                  <tr key={product.id}>
                    <td style={tdStyle}>{product.name}</td>
                    <td style={tdStyle}>{product.category ?? 'Sin categoría'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Productos más vendidos</h2>

          {topProducts.length === 0 ? (
            <p style={emptyTextStyle}>Todavía no hay ventas suficientes.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Cantidad</th>
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>

              <tbody>
                {topProducts.map((product) => (
                  <tr key={product.name}>
                    <td style={tdStyle}>{product.name}</td>
                    <td style={tdStyle}>{product.quantity}</td>
                    <td style={tdStyle}>${product.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Últimas ventas</h2>

          {sales.length === 0 ? (
            <p style={emptyTextStyle}>Todavía no hay ventas registradas.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Pago</th>
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>

              <tbody>
                {sales.slice(0, 10).map((sale) => (
                  <tr key={sale.id}>
                    <td style={tdStyle}>
                      {new Date(sale.created_at).toLocaleString('es-MX')}
                    </td>
                    <td style={tdStyle}>{sale.payment_method ?? 'efectivo'}</td>
                    <td style={tdStyle}>${Number(sale.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  )
}

const pageStyle = {
  minHeight: '100vh',
  background: '#0f172a',
  color: '#e5e7eb',
  padding: 24,
  fontFamily: 'Arial, sans-serif',
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  marginBottom: 24,
}

const titleStyle = {
  fontSize: 32,
  margin: 0,
}

const subtitleStyle = {
  color: '#94a3b8',
  marginTop: 8,
}

const navStyle = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap' as const,
}

const linkStyle = {
  color: '#38bdf8',
  textDecoration: 'none',
}

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginBottom: 24,
}

const summaryCardStyle = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 12,
  padding: 20,
}

const summaryLabelStyle = {
  display: 'block',
  color: '#94a3b8',
  fontSize: 14,
  marginBottom: 10,
}

const summaryNumberStyle = {
  fontSize: 28,
  color: '#f8fafc',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
  gap: 24,
  marginBottom: 24,
}

const cardStyle = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 12,
  padding: 20,
  overflowX: 'auto' as const,
}

const sectionTitleStyle = {
  fontSize: 20,
  marginTop: 0,
  marginBottom: 16,
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}

const thStyle = {
  border: '1px solid #334155',
  padding: 10,
  background: '#1e293b',
  textAlign: 'left' as const,
}

const tdStyle = {
  border: '1px solid #334155',
  padding: 10,
}

const emptyTextStyle = {
  color: '#94a3b8',
}

const messageStyle = {
  color: '#facc15',
  marginBottom: 16,
}