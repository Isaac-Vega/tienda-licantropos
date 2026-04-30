'use client'

import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Product } from '@/types/product'

type MovementType = 'entry' | 'adjustment_plus' | 'adjustment_minus' | 'waste'

type Movement = {
  id: string
  product_id: string
  movement_type: string
  quantity: number
  previous_stock: number
  new_stock: number
  reason: string | null
  created_at: string
  products?: {
    name: string
    barcode: string | null
  } | null
}

const movementLabels: Record<MovementType | string, string> = {
  entry: 'Entrada',
  adjustment_plus: 'Ajuste positivo',
  adjustment_minus: 'Ajuste negativo',
  waste: 'Merma',
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [productId, setProductId] = useState('')
  const [movementType, setMovementType] = useState<MovementType>('entry')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      setMessage(`Error al cargar productos: ${error.message}`)
      return
    }

    setProducts(data ?? [])
  }

  async function loadMovements() {
    const { data, error } = await supabase
      .from('inventory_movements')
      .select(`
        id,
        product_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        created_at,
        products (
          name,
          barcode
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      setMessage(`Error al cargar movimientos: ${error.message}`)
      return
    }

    setMovements(((data ?? []) as unknown) as Movement[])
  }

  useEffect(() => {
    loadProducts()
    loadMovements()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    const selectedProduct = products.find((product) => product.id === productId)
    const amount = Number(quantity)

    if (!selectedProduct) {
      setMessage('Selecciona un producto.')
      return
    }

    if (!amount || amount <= 0) {
      setMessage('La cantidad debe ser mayor a 0.')
      return
    }

    const previousStock = selectedProduct.stock

    let newStock = previousStock

    if (movementType === 'entry' || movementType === 'adjustment_plus') {
      newStock = previousStock + amount
    }

    if (movementType === 'adjustment_minus' || movementType === 'waste') {
      newStock = previousStock - amount
    }

    if (newStock < 0) {
      setMessage('No puedes dejar el stock en negativo.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase
      .from('products')
      .update({
        stock: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedProduct.id)

    if (updateError) {
      setLoading(false)
      setMessage(`Error al actualizar stock: ${updateError.message}`)
      return
    }

    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: selectedProduct.id,
        movement_type: movementType,
        quantity: amount,
        previous_stock: previousStock,
        new_stock: newStock,
        reason: reason.trim() || null,
      })

    setLoading(false)

    if (movementError) {
      setMessage(`Error al guardar movimiento: ${movementError.message}`)
      return
    }

    setProductId('')
    setMovementType('entry')
    setQuantity('')
    setReason('')
    setMessage('Movimiento registrado correctamente.')

    loadProducts()
    loadMovements()
  }

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Inventario</h1>
          <p style={subtitleStyle}>
            Registra entradas, ajustes y mermas para controlar el stock.
          </p>
        </div>

        <div style={navStyle}>
          <a href="/" style={linkStyle}>Inicio</a>
          <a href="/productos" style={linkStyle}>Productos</a>
          <a href="/ventas" style={linkStyle}>Ventas</a>
          <a href="/reportes" style={linkStyle}>Reportes</a>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Nuevo movimiento</h2>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            Producto
            <select
              style={inputStyle}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Selecciona un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} | Stock: {product.stock}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            Tipo de movimiento
            <select
              style={inputStyle}
              value={movementType}
              onChange={(event) =>
                setMovementType(event.target.value as MovementType)
              }
            >
              <option value="entry">Entrada de mercancía</option>
              <option value="adjustment_plus">Ajuste positivo</option>
              <option value="adjustment_minus">Ajuste negativo</option>
              <option value="waste">Merma</option>
            </select>
          </label>

          <label style={labelStyle}>
            Cantidad
            <input
              style={inputStyle}
              type="number"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="Ej. 10"
            />
          </label>

          <label style={labelStyle}>
            Motivo
            <input
              style={inputStyle}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej. Llegó mercancía, producto dañado, conteo físico"
            />
          </label>

          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? 'Guardando...' : 'Registrar movimiento'}
          </button>
        </form>

        {message && <p style={messageStyle}>{message}</p>}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Stock actual</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Producto</th>
              <th style={thStyle}>Código</th>
              <th style={thStyle}>Categoría</th>
              <th style={thStyle}>Stock</th>
              <th style={thStyle}>Stock mínimo</th>
              <th style={thStyle}>Estado</th>
            </tr>
          </thead>

          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td style={tdStyle}>{product.name}</td>
                <td style={tdStyle}>{product.barcode ?? 'Sin código'}</td>
                <td style={tdStyle}>{product.category ?? 'Sin categoría'}</td>
                <td style={tdStyle}>{product.stock}</td>
                <td style={tdStyle}>{product.min_stock}</td>
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
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Últimos movimientos</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Fecha</th>
              <th style={thStyle}>Producto</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Cantidad</th>
              <th style={thStyle}>Stock anterior</th>
              <th style={thStyle}>Stock nuevo</th>
              <th style={thStyle}>Motivo</th>
            </tr>
          </thead>

          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id}>
                <td style={tdStyle}>
                  {new Date(movement.created_at).toLocaleString('es-MX')}
                </td>
                <td style={tdStyle}>
                  {movement.products?.name ?? 'Producto no encontrado'}
                </td>
                <td style={tdStyle}>
                  {movementLabels[movement.movement_type] ?? movement.movement_type}
                </td>
                <td style={tdStyle}>{movement.quantity}</td>
                <td style={tdStyle}>{movement.previous_stock}</td>
                <td style={tdStyle}>{movement.new_stock}</td>
                <td style={tdStyle}>{movement.reason ?? 'Sin motivo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

const cardStyle = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
}

const sectionTitleStyle = {
  fontSize: 20,
  marginTop: 0,
  marginBottom: 16,
}

const formStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
  fontSize: 14,
  color: '#cbd5e1',
}

const inputStyle = {
  padding: 10,
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#020617',
  color: '#f8fafc',
}

const buttonStyle = {
  padding: 12,
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
  alignSelf: 'end',
}

const messageStyle = {
  marginTop: 16,
  color: '#facc15',
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