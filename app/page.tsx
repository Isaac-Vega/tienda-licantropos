'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Product } from '@/types/product'

type Sale = {
  id: string
  total: number
  payment_method: string | null
  created_at: string
}

type Movement = {
  id: string
  movement_type: string
  quantity: number
  created_at: string
  products?: {
    name: string
  } | null
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [message, setMessage] = useState('')

  async function loadDashboardData() {
    setMessage('')

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (productsError) {
      setMessage(`Error al cargar productos: ${productsError.message}`)
      return
    }

    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (salesError) {
      setMessage(`Error al cargar ventas: ${salesError.message}`)
      return
    }

    const { data: movementsData, error: movementsError } = await supabase
      .from('inventory_movements')
      .select(`
        id,
        movement_type,
        quantity,
        created_at,
        products (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(8)

    if (movementsError) {
      setMessage(`Error al cargar movimientos: ${movementsError.message}`)
      return
    }

    setProducts(productsData ?? [])
    setSales(salesData ?? [])
    setMovements(((movementsData ?? []) as unknown) as Movement[])
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const todaySales = useMemo(() => {
    const today = new Date().toLocaleDateString('es-MX')

    return sales.filter((sale) => {
      const saleDate = new Date(sale.created_at).toLocaleDateString('es-MX')
      return saleDate === today
    })
  }, [sales])

  const todayTotal = todaySales.reduce((sum, sale) => {
    return sum + Number(sale.total)
  }, 0)

  const lowStockProducts = products.filter((product) => {
    return product.stock > 0 && product.stock <= product.min_stock
  })

  const outOfStockProducts = products.filter((product) => product.stock === 0)

  const inventoryValue = products.reduce((sum, product) => {
    return sum + Number(product.sale_price) * Number(product.stock)
  }, 0)

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <p style={eyebrowStyle}>Sistema de tienda local</p>
          <h1 style={titleStyle}>Inventario</h1>
          <p style={subtitleStyle}>
            Controla productos, stock, ventas y reportes desde un solo lugar.
          </p>
        </div>

        <a href="/ventas" style={primaryActionStyle}>
          Ir a ventas
        </a>
      </section>

      {message && <p style={messageStyle}>{message}</p>}

      <section style={moduleGridStyle}>
        <a href="/productos" style={moduleCardStyle}>
          <span style={moduleIconStyle}>📦</span>
          <strong style={moduleTitleStyle}>Productos</strong>
          <span style={moduleTextStyle}>
            Registra productos, precios, códigos y stock inicial.
          </span>
        </a>

        <a href="/inventario" style={moduleCardStyle}>
          <span style={moduleIconStyle}>📋</span>
          <strong style={moduleTitleStyle}>Inventario</strong>
          <span style={moduleTextStyle}>
            Registra entradas, ajustes, mermas y movimientos.
          </span>
        </a>

        <a href="/ventas" style={moduleCardStyle}>
          <span style={moduleIconStyle}>🧾</span>
          <strong style={moduleTitleStyle}>Ventas</strong>
          <span style={moduleTextStyle}>
            Escanea códigos de barras y descuenta stock automáticamente.
          </span>
        </a>

        <a href="/reportes" style={moduleCardStyle}>
          <span style={moduleIconStyle}>📊</span>
          <strong style={moduleTitleStyle}>Reportes</strong>
          <span style={moduleTextStyle}>
            Consulta ventas, productos bajos y valor del inventario.
          </span>
        </a>
      </section>

      <section style={summaryGridStyle}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Productos registrados</span>
          <strong style={summaryNumberStyle}>{products.length}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Ventas de hoy</span>
          <strong style={summaryNumberStyle}>{todaySales.length}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Total vendido hoy</span>
          <strong style={summaryNumberStyle}>${todayTotal.toFixed(2)}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Valor del inventario</span>
          <strong style={summaryNumberStyle}>${inventoryValue.toFixed(2)}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Stock bajo</span>
          <strong style={summaryNumberStyle}>{lowStockProducts.length}</strong>
        </div>

        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Agotados</span>
          <strong style={summaryNumberStyle}>{outOfStockProducts.length}</strong>
        </div>
      </section>

      <section style={contentGridStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Productos recientes</h2>

          {products.length === 0 ? (
            <p style={emptyTextStyle}>Todavía no hay productos registrados.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {products.slice(0, 6).map((product) => (
                  <tr key={product.id}>
                    <td style={tdStyle}>{product.name}</td>
                    <td style={tdStyle}>{product.stock}</td>
                    <td style={tdStyle}>
                      {product.stock === 0
                        ? 'Agotado'
                        : product.stock <= product.min_stock
                          ? 'Stock bajo'
                          : 'Disponible'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Últimos movimientos</h2>

          {movements.length === 0 ? (
            <p style={emptyTextStyle}>Todavía no hay movimientos registrados.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Producto</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Cantidad</th>
                </tr>
              </thead>

              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td style={tdStyle}>
                      {movement.products?.name ?? 'Producto no encontrado'}
                    </td>
                    <td style={tdStyle}>{getMovementLabel(movement.movement_type)}</td>
                    <td style={tdStyle}>{movement.quantity}</td>
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

function getMovementLabel(type: string) {
  const labels: Record<string, string> = {
    entry: 'Entrada',
    sale: 'Venta',
    adjustment_plus: 'Ajuste positivo',
    adjustment_minus: 'Ajuste negativo',
    waste: 'Merma',
    return: 'Devolución',
  }

  return labels[type] ?? type
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#0f172a',
  color: '#e5e7eb',
  padding: 24,
  fontFamily: 'Arial, sans-serif',
}

const heroStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #111827, #1e293b)',
  border: '1px solid #334155',
  borderRadius: 18,
  padding: 28,
  marginBottom: 24,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 20,
}

const eyebrowStyle: CSSProperties = {
  color: '#38bdf8',
  margin: 0,
  fontWeight: 700,
}

const titleStyle: CSSProperties = {
  fontSize: 42,
  margin: '8px 0',
}

const subtitleStyle: CSSProperties = {
  color: '#94a3b8',
  margin: 0,
  maxWidth: 620,
}

const primaryActionStyle: CSSProperties = {
  background: '#2563eb',
  color: 'white',
  padding: '14px 18px',
  borderRadius: 10,
  textDecoration: 'none',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const moduleGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  marginBottom: 24,
}

const moduleCardStyle: CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 14,
  padding: 20,
  textDecoration: 'none',
  color: '#e5e7eb',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const moduleIconStyle: CSSProperties = {
  fontSize: 28,
}

const moduleTitleStyle: CSSProperties = {
  fontSize: 20,
}

const moduleTextStyle: CSSProperties = {
  color: '#94a3b8',
  lineHeight: 1.4,
}

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 16,
  marginBottom: 24,
}

const summaryCardStyle: CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 12,
  padding: 18,
}

const summaryLabelStyle: CSSProperties = {
  color: '#94a3b8',
  display: 'block',
  marginBottom: 8,
  fontSize: 14,
}

const summaryNumberStyle: CSSProperties = {
  fontSize: 26,
  color: '#f8fafc',
}

const contentGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
  gap: 24,
}

const cardStyle: CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 12,
  padding: 20,
  overflowX: 'auto',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  marginTop: 0,
  marginBottom: 16,
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const thStyle: CSSProperties = {
  border: '1px solid #334155',
  padding: 10,
  background: '#1e293b',
  textAlign: 'left',
}

const tdStyle: CSSProperties = {
  border: '1px solid #334155',
  padding: 10,
}

const emptyTextStyle: CSSProperties = {
  color: '#94a3b8',
}

const messageStyle: CSSProperties = {
  color: '#facc15',
  marginBottom: 16,
}