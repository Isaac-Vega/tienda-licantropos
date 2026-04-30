'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Product } from '@/types/product'

type ProductForm = {
  name: string
  barcode: string
  category: string
  brand: string
  purchase_price: string
  sale_price: string
  stock: string
  min_stock: string
  expiration_date: string
}

const initialForm: ProductForm = {
  name: '',
  barcode: '',
  category: '',
  brand: '',
  purchase_price: '',
  sale_price: '',
  stock: '',
  min_stock: '',
  expiration_date: '',
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState<ProductForm>(initialForm)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isEditing = Boolean(editingProductId)

  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Error al cargar productos: ${error.message}`)
      return
    }

    setProducts(data ?? [])
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase()

    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(cleanSearch) ||
        product.barcode?.toLowerCase().includes(cleanSearch) ||
        product.category?.toLowerCase().includes(cleanSearch) ||
        product.brand?.toLowerCase().includes(cleanSearch)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active)

      return matchesSearch && matchesStatus
    })
  }, [products, search, statusFilter])

  function handleChange(field: keyof ProductForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function resetForm() {
    setForm(initialForm)
    setEditingProductId(null)
    setMessage('')
  }

  function startEdit(product: Product) {
    setEditingProductId(product.id)

    setForm({
      name: product.name,
      barcode: product.barcode ?? '',
      category: product.category ?? '',
      brand: product.brand ?? '',
      purchase_price: String(product.purchase_price ?? ''),
      sale_price: String(product.sale_price ?? ''),
      stock: String(product.stock ?? ''),
      min_stock: String(product.min_stock ?? ''),
      expiration_date: product.expiration_date ?? '',
    })

    setMessage(`Editando producto: ${product.name}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

    if (!form.name.trim()) {
      setMessage('El nombre del producto es obligatorio.')
      return
    }

    if (!form.sale_price || Number(form.sale_price) < 0) {
      setMessage('El precio de venta debe ser válido.')
      return
    }

    if (!isEditing && (!form.stock || Number(form.stock) < 0)) {
      setMessage('El stock inicial debe ser válido.')
      return
    }

    if (Number(form.purchase_price || 0) < 0) {
      setMessage('El precio de compra no puede ser negativo.')
      return
    }

    if (Number(form.min_stock || 0) < 0) {
      setMessage('El stock mínimo no puede ser negativo.')
      return
    }

    setLoading(true)

    if (isEditing && editingProductId) {
      const { error } = await supabase
        .from('products')
        .update({
          name: form.name.trim(),
          barcode: form.barcode.trim() || null,
          category: form.category.trim() || null,
          brand: form.brand.trim() || null,
          purchase_price: Number(form.purchase_price || 0),
          sale_price: Number(form.sale_price || 0),
          min_stock: Number(form.min_stock || 0),
          expiration_date: form.expiration_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProductId)

      setLoading(false)

      if (error) {
        setMessage(`Error al actualizar producto: ${error.message}`)
        return
      }

      setMessage('Producto actualizado correctamente.')
      resetForm()
      loadProducts()
      return
    }

    const { error } = await supabase.from('products').insert({
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      category: form.category.trim() || null,
      brand: form.brand.trim() || null,
      purchase_price: Number(form.purchase_price || 0),
      sale_price: Number(form.sale_price || 0),
      stock: Number(form.stock || 0),
      min_stock: Number(form.min_stock || 0),
      expiration_date: form.expiration_date || null,
      is_active: true,
    })

    setLoading(false)

    if (error) {
      setMessage(`Error al guardar producto: ${error.message}`)
      return
    }

    setForm(initialForm)
    setMessage('Producto guardado correctamente.')
    loadProducts()
  }

  async function toggleProductStatus(product: Product) {
    const newStatus = !product.is_active

    const { error } = await supabase
      .from('products')
      .update({
        is_active: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id)

    if (error) {
      setMessage(`Error al cambiar estado: ${error.message}`)
      return
    }

    setMessage(
      newStatus
        ? `Producto activado: ${product.name}`
        : `Producto desactivado: ${product.name}`
    )

    loadProducts()
  }

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Productos</h1>
          <p style={subtitleStyle}>
            Registra, edita, activa o desactiva productos de la tienda.
          </p>
        </div>

        <div style={navStyle}>
          <a href="/" style={linkStyle}>Inicio</a>
          <a href="/inventario" style={linkStyle}>Inventario</a>
          <a href="/ventas" style={linkStyle}>Ventas</a>
          <a href="/reportes" style={linkStyle}>Reportes</a>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={formHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {isEditing ? 'Editar producto' : 'Nuevo producto'}
            </h2>

            <p style={helperTextStyle}>
              {isEditing
                ? 'Al editar no se cambia el stock actual. El stock se modifica desde Inventario.'
                : 'Registra productos con código de barras, precios y stock inicial.'}
            </p>
          </div>

          {isEditing && (
            <button type="button" style={secondaryButtonStyle} onClick={resetForm}>
              Cancelar edición
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            Nombre
            <input
              style={inputStyle}
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="Ej. Coca-Cola 600 ml"
            />
          </label>

          <label style={labelStyle}>
            Código de barras
            <input
              style={inputStyle}
              value={form.barcode}
              onChange={(event) => handleChange('barcode', event.target.value)}
              placeholder="Escanea o escribe el código"
            />
          </label>

          <label style={labelStyle}>
            Categoría
            <input
              style={inputStyle}
              value={form.category}
              onChange={(event) => handleChange('category', event.target.value)}
              placeholder="Ej. Bebidas"
            />
          </label>

          <label style={labelStyle}>
            Marca
            <input
              style={inputStyle}
              value={form.brand}
              onChange={(event) => handleChange('brand', event.target.value)}
              placeholder="Ej. Coca-Cola"
            />
          </label>

          <label style={labelStyle}>
            Precio compra
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              value={form.purchase_price}
              onChange={(event) =>
                handleChange('purchase_price', event.target.value)
              }
              placeholder="0.00"
            />
          </label>

          <label style={labelStyle}>
            Precio venta
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              value={form.sale_price}
              onChange={(event) => handleChange('sale_price', event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label style={labelStyle}>
            {isEditing ? 'Stock actual' : 'Stock inicial'}
            <input
              style={{
                ...inputStyle,
                opacity: isEditing ? 0.6 : 1,
                cursor: isEditing ? 'not-allowed' : 'text',
              }}
              type="number"
              min="0"
              value={form.stock}
              disabled={isEditing}
              onChange={(event) => handleChange('stock', event.target.value)}
              placeholder="0"
            />
          </label>

          <label style={labelStyle}>
            Stock mínimo
            <input
              style={inputStyle}
              type="number"
              min="0"
              value={form.min_stock}
              onChange={(event) => handleChange('min_stock', event.target.value)}
              placeholder="0"
            />
          </label>

          <label style={labelStyle}>
            Caducidad
            <input
              style={inputStyle}
              type="date"
              value={form.expiration_date}
              onChange={(event) =>
                handleChange('expiration_date', event.target.value)
              }
            />
          </label>

          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading
              ? 'Guardando...'
              : isEditing
                ? 'Guardar cambios'
                : 'Guardar producto'}
          </button>
        </form>

        {message && <p style={messageStyle}>{message}</p>}
      </section>

      <section style={cardStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Productos registrados</h2>
            <p style={helperTextStyle}>
              Total encontrados: {filteredProducts.length}
            </p>
          </div>

          <div style={filtersStyle}>
            <input
              style={inputStyle}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, código, marca..."
            />

            <select
              style={inputStyle}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')
              }
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Producto</th>
                <th style={thStyle}>Código</th>
                <th style={thStyle}>Categoría</th>
                <th style={thStyle}>Marca</th>
                <th style={thStyle}>Compra</th>
                <th style={thStyle}>Venta</th>
                <th style={thStyle}>Stock</th>
                <th style={thStyle}>Estado stock</th>
                <th style={thStyle}>Estatus</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td style={tdStyle} colSpan={10}>
                    No hay productos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td style={tdStyle}>{product.name}</td>
                    <td style={tdStyle}>{product.barcode ?? 'Sin código'}</td>
                    <td style={tdStyle}>{product.category ?? 'Sin categoría'}</td>
                    <td style={tdStyle}>{product.brand ?? 'Sin marca'}</td>
                    <td style={tdStyle}>${Number(product.purchase_price).toFixed(2)}</td>
                    <td style={tdStyle}>${Number(product.sale_price).toFixed(2)}</td>
                    <td style={tdStyle}>{product.stock}</td>
                    <td style={tdStyle}>{getStockStatus(product)}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          ...badgeStyle,
                          background: product.is_active ? '#14532d' : '#3f3f46',
                          color: product.is_active ? '#bbf7d0' : '#d4d4d8',
                        }}
                      >
                        {product.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={actionsStyle}>
                        <button
                          type="button"
                          style={smallButtonStyle}
                          onClick={() => startEdit(product)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          style={
                            product.is_active
                              ? dangerButtonStyle
                              : successButtonStyle
                          }
                          onClick={() => toggleProductStatus(product)}
                        >
                          {product.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function getStockStatus(product: Product) {
  if (product.stock === 0) return 'Agotado'
  if (product.stock <= product.min_stock) return 'Stock bajo'
  return 'Disponible'
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

const cardStyle: CSSProperties = {
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 12,
  padding: 20,
  marginBottom: 24,
}

const formHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  marginBottom: 16,
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  marginTop: 0,
  marginBottom: 6,
}

const helperTextStyle: CSSProperties = {
  color: '#94a3b8',
  margin: 0,
  fontSize: 14,
}

const formStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
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

const buttonStyle: CSSProperties = {
  padding: 12,
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
  alignSelf: 'end',
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
  padding: '7px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  cursor: 'pointer',
}

const dangerButtonStyle: CSSProperties = {
  padding: '7px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#dc2626',
  color: 'white',
  cursor: 'pointer',
}

const successButtonStyle: CSSProperties = {
  padding: '7px 10px',
  borderRadius: 6,
  border: 'none',
  background: '#16a34a',
  color: 'white',
  cursor: 'pointer',
}

const messageStyle: CSSProperties = {
  marginTop: 16,
  color: '#facc15',
}

const tableHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  marginBottom: 16,
  flexWrap: 'wrap',
}

const filtersStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const tableWrapperStyle: CSSProperties = {
  overflowX: 'auto',
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
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  border: '1px solid #334155',
  padding: 10,
  verticalAlign: 'middle',
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '4px 8px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
}