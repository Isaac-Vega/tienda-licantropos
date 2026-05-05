'use client'

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Product } from '@/types/product'

type CartItem = {
  product: Product
  quantity: number
}

type ReceiptItem = {
  name: string
  barcode: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

type Receipt = {
  id: string
  total: number
  paymentMethod: string
  cashReceived: number
  change: number
  createdAt: string
  items: ReceiptItem[]
}

export default function SalesPage() {
  const [barcode, setBarcode] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [cashReceived, setCashReceived] = useState('')
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)

  const barcodeInputRef = useRef<HTMLInputElement | null>(null)

  const total = cart.reduce((sum, item) => {
    return sum + Number(item.product.sale_price) * item.quantity
  }, 0)

  const receivedAmount = Number(cashReceived || 0)
  const change = paymentMethod === 'efectivo' ? receivedAmount - total : 0

  useEffect(() => {
    barcodeInputRef.current?.focus()
  }, [])

  async function searchProductByBarcode(code: string) {
    const cleanCode = code.trim()

    if (!cleanCode) {
      setMessage('Escribe o escanea un código de barras.')
      return
    }

    setMessage('')

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', cleanCode)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      setMessage(`Error al buscar producto: ${error.message}`)
      return
    }

    if (!data) {
      setMessage('Producto no registrado o desactivado.')
      setBarcode('')
      barcodeInputRef.current?.focus()
      return
    }

    const product = data as Product

    if (product.stock <= 0) {
      setMessage('Producto agotado. No se puede vender.')
      setBarcode('')
      barcodeInputRef.current?.focus()
      return
    }

    addToCart(product)
    setBarcode('')
    barcodeInputRef.current?.focus()
  }

  async function searchProductsByName() {
  const cleanSearch = productSearch.trim()

  if (!cleanSearch) {
    setMessage('Escribe el nombre del producto que quieres buscar.')
    return
  }

  if (cleanSearch.length < 2) {
    setMessage('Escribe al menos 2 letras para buscar.')
    return
  }

  setSearching(true)
  setMessage('')

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .ilike('name', `%${cleanSearch}%`)
    .order('name', { ascending: true })
    .limit(10)

  setSearching(false)

  if (error) {
    setMessage(`Error al buscar productos: ${error.message}`)
    return
  }

  setSearchResults((data as Product[]) ?? [])

  if (!data || data.length === 0) {
    setMessage('No se encontraron productos con ese nombre.')
  }
}

function handleNameSearchSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  searchProductsByName()
}

function addSearchResultToCart(product: Product) {
  if (product.stock <= 0) {
    setMessage('Producto agotado. No se puede vender.')
    return
  }

  addToCart(product)
  setProductSearch('')
  setSearchResults([])
  barcodeInputRef.current?.focus()
}

  function addToCart(product: Product) {
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.product.id === product.id
      )

      if (existingItem) {
        if (existingItem.quantity + 1 > product.stock) {
          setMessage('No hay suficiente stock para agregar más unidades.')
          return currentCart
        }

        return currentCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...currentCart, { product, quantity: 1 }]
    })

    setMessage(`Producto agregado: ${product.name}`)
  }

  function increaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.product.id !== productId) return item

        if (item.quantity + 1 > item.product.stock) {
          setMessage('No hay suficiente stock.')
          return item
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        }
      })
    )
  }

  function decreaseQuantity(productId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.product.id !== productId) return item

          return {
            ...item,
            quantity: item.quantity - 1,
          }
        })
        .filter((item) => item.quantity > 0)
    )
  }

  function removeItem(productId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.product.id !== productId)
    )
  }

  function clearCart() {
    setCart([])
    setCashReceived('')
    setMessage('Carrito limpiado.')
    barcodeInputRef.current?.focus()
  }

  function handleScanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    searchProductByBarcode(barcode)
  }

  function handleBarcodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      searchProductByBarcode(barcode)
    }
  }

  async function handleCharge() {
    setMessage('')

    if (cart.length === 0) {
      setMessage('Agrega productos antes de cobrar.')
      return
    }

    if (paymentMethod === 'efectivo') {
      if (!cashReceived) {
        setMessage('Ingresa el monto recibido.')
        return
      }

      if (receivedAmount < total) {
        setMessage('El monto recibido no cubre el total de la venta.')
        return
      }
    }

    setLoading(true)

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        total,
        payment_method: paymentMethod,
      })
      .select('id')
      .single()

    if (saleError || !sale) {
      setLoading(false)
      setMessage(`Error al guardar venta: ${saleError?.message}`)
      return
    }

    const saleItems = cart.map((item) => ({
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: Number(item.product.sale_price),
      subtotal: Number(item.product.sale_price) * item.quantity,
    }))

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)

    if (itemsError) {
      setLoading(false)
      setMessage(`Error al guardar detalle de venta: ${itemsError.message}`)
      return
    }

    for (const item of cart) {
      const previousStock = item.product.stock
      const newStock = previousStock - item.quantity

      if (newStock < 0) {
        setLoading(false)
        setMessage(`Stock insuficiente para ${item.product.name}.`)
        return
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.product.id)

      if (updateError) {
        setLoading(false)
        setMessage(`Error al actualizar stock: ${updateError.message}`)
        return
      }

      const { error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          product_id: item.product.id,
          movement_type: 'sale',
          quantity: item.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: `Venta registrada. Folio: ${sale.id}`,
        })

      if (movementError) {
        setLoading(false)
        setMessage(`Error al registrar movimiento: ${movementError.message}`)
        return
      }
    }

    const receipt: Receipt = {
      id: sale.id,
      total,
      paymentMethod,
      cashReceived: paymentMethod === 'efectivo' ? receivedAmount : total,
      change: paymentMethod === 'efectivo' ? receivedAmount - total : 0,
      createdAt: new Date().toISOString(),
      items: cart.map((item) => ({
        name: item.product.name,
        barcode: item.product.barcode,
        quantity: item.quantity,
        unit_price: Number(item.product.sale_price),
        subtotal: Number(item.product.sale_price) * item.quantity,
      })),
    }

    setLastReceipt(receipt)
    setCart([])
    setCashReceived('')
    setLoading(false)
    setMessage('Venta registrada correctamente.')
    barcodeInputRef.current?.focus()
  }

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Ventas</h1>
          <p style={subtitleStyle}>
            Escanea productos, cobra y descuenta inventario automáticamente.
          </p>
        </div>

        <div style={navStyle}>
          <a href="/" style={linkStyle}>Inicio</a>
          <a href="/productos" style={linkStyle}>Productos</a>
          <a href="/inventario" style={linkStyle}>Inventario</a>
          <a href="/reportes" style={linkStyle}>Reportes</a>
        </div>
      </section>

      <section style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Escáner de código de barras</h2>

          <form onSubmit={handleScanSubmit} style={scannerFormStyle}>
            <label style={labelStyle}>
              Código de barras
              <input
                ref={barcodeInputRef}
                style={scannerInputStyle}
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Escanea o escribe el código"
              />
            </label>

            <button type="submit" style={buttonStyle}>
              Agregar
            </button>
          </form>

          <p style={helpTextStyle}>
            Escanea o escribe el código en este campo.
          </p>

          <div style={searchBoxStyle}>
            <h3 style={searchTitleStyle}>Buscar producto por nombre</h3>

            <form onSubmit={handleNameSearchSubmit} style={nameSearchFormStyle}>
              <input
                style={inputStyle}
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Ej. Coca-Cola, Sabritas, agua..."
              />

              <button type="submit" style={buttonStyle} disabled={searching}>
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div style={resultsStyle}>
                {searchResults.map((product) => (
                  <div key={product.id} style={resultItemStyle}>
                    <div>
                      <strong>{product.name}</strong>
                      <p style={resultTextStyle}>
                        Código: {product.barcode ?? 'Sin código'} | Stock: {product.stock} | Precio: ${Number(product.sale_price).toFixed(2)}
                      </p>
                    </div>

                    <button
                      type="button"
                      style={smallButtonStyle}
                      onClick={() => addSearchResultToCart(product)}
                    >
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message && <p style={messageStyle}>{message}</p>}
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Resumen de cobro</h2>

          <label style={labelStyle}>
            Método de pago
            <select
              style={inputStyle}
              value={paymentMethod}
              onChange={(event) => {
                setPaymentMethod(event.target.value)
                setCashReceived('')
              }}
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </label>

          {paymentMethod === 'efectivo' && (
            <label style={{ ...labelStyle, marginTop: 14 }}>
              Monto recibido
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                placeholder="Ej. 100.00"
              />
            </label>
          )}

          <div style={totalBoxStyle}>
            <span>Total</span>
            <strong>${total.toFixed(2)}</strong>
          </div>

          {paymentMethod === 'efectivo' && (
            <div style={changeBoxStyle}>
              <span>Cambio</span>
              <strong
                style={{
                  color: change < 0 ? '#f87171' : '#86efac',
                }}
              >
                ${change > 0 ? change.toFixed(2) : '0.00'}
              </strong>
            </div>
          )}

          <button
            type="button"
            style={chargeButtonStyle}
            onClick={handleCharge}
            disabled={loading}
          >
            {loading ? 'Cobrando...' : 'Cobrar'}
          </button>

          {cart.length > 0 && (
            <button
              type="button"
              style={clearButtonStyle}
              onClick={clearCart}
              disabled={loading}
            >
              Limpiar carrito
            </button>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Carrito de venta</h2>

        {cart.length === 0 ? (
          <p style={emptyTextStyle}>Todavía no hay productos agregados.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Producto</th>
                <th style={thStyle}>Código</th>
                <th style={thStyle}>Precio</th>
                <th style={thStyle}>Cantidad</th>
                <th style={thStyle}>Subtotal</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {cart.map((item) => (
                <tr key={item.product.id}>
                  <td style={tdStyle}>{item.product.name}</td>
                  <td style={tdStyle}>{item.product.barcode ?? 'Sin código'}</td>
                  <td style={tdStyle}>${Number(item.product.sale_price).toFixed(2)}</td>
                  <td style={tdStyle}>{item.quantity}</td>
                  <td style={tdStyle}>
                    ${(Number(item.product.sale_price) * item.quantity).toFixed(2)}
                  </td>
                  <td style={tdStyle}>
                    <div style={actionsStyle}>
                      <button
                        type="button"
                        style={smallButtonStyle}
                        onClick={() => decreaseQuantity(item.product.id)}
                      >
                        -
                      </button>

                      <button
                        type="button"
                        style={smallButtonStyle}
                        onClick={() => increaseQuantity(item.product.id)}
                      >
                        +
                      </button>

                      <button
                        type="button"
                        style={dangerButtonStyle}
                        onClick={() => removeItem(item.product.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {lastReceipt && (
        <section style={receiptCardStyle}>
          <div style={receiptHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Ticket de venta</h2>
              <p style={helpTextStyle}>
                Venta registrada correctamente. Puedes usar este resumen como ticket simple.
              </p>
            </div>

            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => setLastReceipt(null)}
            >
              Cerrar ticket
            </button>
          </div>

          <div style={receiptBoxStyle}>
            <h3 style={receiptStoreTitleStyle}>Tienda local</h3>
            <p style={receiptTextStyle}>
              Fecha: {new Date(lastReceipt.createdAt).toLocaleString('es-MX')}
            </p>
            <p style={receiptTextStyle}>Folio: {lastReceipt.id}</p>
            <p style={receiptTextStyle}>Pago: {getPaymentLabel(lastReceipt.paymentMethod)}</p>

            <div style={receiptDividerStyle} />

            {lastReceipt.items.map((item, index) => (
              <div key={`${item.name}-${index}`} style={receiptItemStyle}>
                <div>
                  <strong>{item.name}</strong>
                  <p style={receiptTextStyle}>
                    {item.quantity} x ${item.unit_price.toFixed(2)}
                  </p>
                </div>

                <strong>${item.subtotal.toFixed(2)}</strong>
              </div>
            ))}

            <div style={receiptDividerStyle} />

            <div style={receiptTotalRowStyle}>
              <span>Total</span>
              <strong>${lastReceipt.total.toFixed(2)}</strong>
            </div>

            <div style={receiptTotalRowStyle}>
              <span>Recibido</span>
              <strong>${lastReceipt.cashReceived.toFixed(2)}</strong>
            </div>

            <div style={receiptTotalRowStyle}>
              <span>Cambio</span>
              <strong>${lastReceipt.change.toFixed(2)}</strong>
            </div>

            <p style={receiptThanksStyle}>Gracias por su compra</p>
          </div>
        </section>
      )}
    </main>
  )
}

function getPaymentLabel(paymentMethod: string) {
  const labels: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
  }

  return labels[paymentMethod] ?? paymentMethod
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: '#0f172a',
  color: '#e5e7eb',
  padding: 24,
  fontFamily: 'Arial, sans-serif',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  marginBottom: 24,
  flexWrap: 'wrap',
}

const titleStyle: CSSProperties = {
  fontSize: 32,
  margin: 0,
}

const subtitleStyle: CSSProperties = {
  color: '#94a3b8',
  marginTop: 8,
}

const navStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const linkStyle: CSSProperties = {
  color: '#38bdf8',
  textDecoration: 'none',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
  gap: 24,
  marginBottom: 24,
}

const cardStyle: CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
  overflowX: 'auto',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  marginTop: 0,
  marginBottom: 16,
}

const scannerFormStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 16,
  alignItems: 'end',
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 14,
  color: '#cbd5e1',
}

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#020617',
  color: '#f8fafc',
}

const scannerInputStyle: CSSProperties = {
  ...inputStyle,
  fontSize: 24,
  letterSpacing: 1,
}

const buttonStyle: CSSProperties = {
  padding: '12px 18px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
}

const chargeButtonStyle: CSSProperties = {
  ...buttonStyle,
  width: '100%',
  marginTop: 16,
  background: '#16a34a',
}

const clearButtonStyle: CSSProperties = {
  ...buttonStyle,
  width: '100%',
  marginTop: 10,
  background: '#475569',
}

const secondaryButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#020617',
  color: '#e5e7eb',
  cursor: 'pointer',
}

const smallButtonStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  cursor: 'pointer',
}

const dangerButtonStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#dc2626',
  color: 'white',
  cursor: 'pointer',
}

const helpTextStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 14,
  marginTop: 12,
}

const messageStyle: CSSProperties = {
  marginTop: 16,
  color: '#facc15',
}

const emptyTextStyle: CSSProperties = {
  color: '#94a3b8',
}

const totalBoxStyle: CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 10,
  background: '#020617',
  border: '1px solid #334155',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 24,
}

const changeBoxStyle: CSSProperties = {
  marginTop: 10,
  padding: 14,
  borderRadius: 10,
  background: '#020617',
  border: '1px solid #334155',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 20,
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

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const receiptCardStyle: CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
}

const receiptHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const receiptBoxStyle: CSSProperties = {
  background: '#f8fafc',
  color: '#020617',
  borderRadius: 10,
  padding: 20,
  maxWidth: 420,
  marginTop: 16,
}

const receiptStoreTitleStyle: CSSProperties = {
  textAlign: 'center',
  margin: '0 0 12px',
  fontSize: 22,
}

const receiptTextStyle: CSSProperties = {
  margin: '4px 0',
  color: '#334155',
  fontSize: 14,
}

const receiptDividerStyle: CSSProperties = {
  height: 1,
  background: '#cbd5e1',
  margin: '14px 0',
}

const receiptItemStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 10,
}

const receiptTotalRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 16,
  marginBottom: 8,
}

const receiptThanksStyle: CSSProperties = {
  textAlign: 'center',
  marginTop: 18,
  fontWeight: 700,
}

const searchBoxStyle: CSSProperties = {
  marginTop: 20,
  paddingTop: 18,
  borderTop: '1px solid #334155',
}

const searchTitleStyle: CSSProperties = {
  fontSize: 16,
  margin: '0 0 12px',
}

const nameSearchFormStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  gap: 12,
  alignItems: 'center',
}

const resultsStyle: CSSProperties = {
  marginTop: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const resultItemStyle: CSSProperties = {
  background: '#020617',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}

const resultTextStyle: CSSProperties = {
  margin: '4px 0 0',
  color: '#94a3b8',
  fontSize: 13,
}