import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, AlertTriangle, Edit2, Layers, MapPin, RefreshCw, ArrowUp, ArrowDown, History } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  currentStock: number;
  minStockAlert: number;
  location: string;
  isLowStock: boolean;
}

interface StockLog {
  id: string;
  productId: string;
  product: {
    name: string;
    sku: string;
  };
  quantity: number;
  movementType: 'IN' | 'OUT';
  reason: string;
  createdBy: string;
  timestamp: string;
}

export const Products: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'logs'>('catalog');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productModalMode, setProductModalMode] = useState<'create' | 'edit'>('create');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentProductId, setAdjustmentProductId] = useState<string | null>(null);
  const [adjustmentProduct, setAdjustmentProduct] = useState<Product | null>(null);

  // Form states - Product
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formAlert, setFormAlert] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [productFormError, setProductFormError] = useState('');

  // Form states - Adjustment
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustReason, setAdjustReason] = useState('Purchase');
  const [adjustFormError, setAdjustFormError] = useState('');

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/products');
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStockLogs = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/products/movements');
      setStockLogs(data);
    } catch (err) {
      console.error('Error loading stock logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'catalog') {
      loadProducts();
    } else {
      loadStockLogs();
    }
  }, [activeTab]);

  const openCreateProductModal = () => {
    setProductModalMode('create');
    setSelectedProductId(null);
    setFormName('');
    setFormSku('');
    setFormCategory('');
    setFormPrice('');
    setFormStock('0');
    setFormAlert('5');
    setFormLocation('');
    setProductFormError('');
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (p: Product) => {
    setProductModalMode('edit');
    setSelectedProductId(p.id);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormCategory(p.category);
    setFormPrice(String(p.unitPrice));
    setFormStock(String(p.currentStock));
    setFormAlert(String(p.minStockAlert));
    setFormLocation(p.location);
    setProductFormError('');
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductFormError('');

    if (!formName || !formSku || !formCategory || !formPrice || !formAlert || !formLocation) {
      setProductFormError('Please fill out all required fields.');
      return;
    }

    const payload: any = {
      name: formName,
      sku: formSku,
      category: formCategory,
      unitPrice: parseFloat(formPrice),
      minStockAlert: parseInt(formAlert),
      location: formLocation,
    };

    if (productModalMode === 'create') {
      payload.currentStock = parseInt(formStock) || 0;
    }

    try {
      if (productModalMode === 'create') {
        await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/products/${selectedProductId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      setIsProductModalOpen(false);
      loadProducts();
    } catch (err: any) {
      setProductFormError(err.message || 'Error occurred during product submission.');
    }
  };

  const openAdjustmentModal = (p: Product) => {
    setAdjustmentProductId(p.id);
    setAdjustmentProduct(p);
    setAdjustQty('');
    setAdjustType('IN');
    setAdjustReason('Purchase');
    setAdjustFormError('');
    setIsAdjustmentModalOpen(true);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustFormError('');

    const qty = parseInt(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      setAdjustFormError('Quantity must be a positive integer.');
      return;
    }

    if (adjustType === 'OUT' && adjustmentProduct && adjustmentProduct.currentStock - qty < 0) {
      setAdjustFormError(`Adjustment exceeds available inventory limit (${adjustmentProduct.currentStock}).`);
      return;
    }

    try {
      await apiFetch(`/products/${adjustmentProductId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          quantity: qty,
          movementType: adjustType,
          reason: adjustReason,
        }),
      });
      setIsAdjustmentModalOpen(false);
      loadProducts();
    } catch (err: any) {
      setAdjustFormError(err.message || 'Error completing stock adjustment.');
    }
  };

  const hasWriteAccess = user?.role === 'Admin' || user?.role === 'Warehouse';
  const hasLogAccess = user?.role === 'Admin' || user?.role === 'Warehouse';

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const lowStockCount = products.filter((p) => p.currentStock <= p.minStockAlert).length;

  return (
    <div className="products-module animate-fadeIn">
      {/* Header Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '24px', gap: '20px' }}>
        <button
          className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
          style={{ background: 'none', borderBottom: '2px solid transparent', borderRadius: 0, padding: '12px 6px' }}
          onClick={() => setActiveTab('catalog')}
        >
          <Layers size={16} /> Catalog & Inventory
        </button>
        {hasLogAccess && (
          <button
            className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
            style={{ background: 'none', borderBottom: '2px solid transparent', borderRadius: 0, padding: '12px 6px' }}
            onClick={() => setActiveTab('logs')}
          >
            <History size={16} /> Stock Movement Audit Logs
          </button>
        )}
      </div>

      {activeTab === 'catalog' ? (
        /* TAB 1: Catalog & Stock Status */
        <div>
          {/* Low Stock Warning Header */}
          {lowStockCount > 0 && (
            <div className="alert-banner">
              <div className="alert-message">
                <AlertTriangle size={18} />
                <span>Attention! There are {lowStockCount} product(s) currently below the safety replenishment stock limit.</span>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="actions-bar">
            <div className="filters-wrapper">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search catalog, SKU, category..."
                  className="form-control search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {hasWriteAccess && (
              <button className="btn btn-primary" onClick={openCreateProductModal}>
                <Plus size={16} /> Add Product SKU
              </button>
            )}
          </div>

          {/* Loading States */}
          {loading ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading catalog inventory levels...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              No inventory matches. Register SKU codes using "Add Product" configuration options.
            </div>
          ) : (
            /* Product Cards List Grid */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
              {filteredProducts.map((p) => {
                const lowStock = p.currentStock <= p.minStockAlert;
                return (
                  <div key={p.id} className="metric-card" style={{ padding: '20px', border: lowStock ? '1px solid rgba(244, 63, 94, 0.25)' : '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="badge badge-retail" style={{ fontSize: '10px' }}>{p.category}</span>
                      {lowStock && (
                        <span className="badge badge-inactive" style={{ textTransform: 'none', display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <AlertTriangle size={10} /> Low Stock
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '4px 0' }}>{p.name}</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>SKU Code: <strong>{p.sku}</strong></p>

                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: '13px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Stock Count</div>
                        <div style={{ fontWeight: 700, color: lowStock ? 'var(--danger)' : 'var(--text-primary)' }}>{p.currentStock} Units</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Unit Price</div>
                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>₹{p.unitPrice.toFixed(2)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                      <span>Warehouse Location: <strong>{p.location}</strong></span>
                    </div>

                    {hasWriteAccess && (
                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => openEditProductModal(p)}
                        >
                          <Edit2 size={12} /> Edit Catalog
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => openAdjustmentModal(p)}
                        >
                          <RefreshCw size={12} /> Adjust Stock
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: Stock Audit Log Grid Table */
        <div>
          {loading ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading inventory audit trail...</div>
          ) : stockLogs.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              No logs recorded. Once stock movements are completed, they will appear here.
            </div>
          ) : (
            <div className="glass-card">
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Time Logged</th>
                      <th>Product / SKU</th>
                      <th>Adjust Type</th>
                      <th>Quantity</th>
                      <th>Adjustment Reason</th>
                      <th>Registered By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{log.product.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.product.sku}</div>
                        </td>
                        <td>
                          {log.movementType === 'IN' ? (
                            <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                              <ArrowUp size={12} /> Stock IN
                            </span>
                          ) : (
                            <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                              <ArrowDown size={12} /> Stock OUT
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{log.quantity} Units</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{log.reason}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{log.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProductModalOpen(false)}>
          <div className="modal-content animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px' }}>{productModalMode === 'create' ? 'Add New Product SKU' : 'Edit Product Details'}</h2>
              <button className="close-btn" onClick={() => setIsProductModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleProductSubmit}>
              <div className="modal-body">
                {productFormError && (
                  <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(244,63,94,0.08)', padding: '10px 14px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.15)', marginBottom: '16px' }}>
                    {productFormError}
                  </div>
                )}
                
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Widget A"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unique SKU Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      placeholder="e.g. WDGT-A"
                      disabled={productModalMode === 'edit'}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="e.g. Widgets"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit Price (INR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Safety Alert Limit *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formAlert}
                      onChange={(e) => setFormAlert(e.target.value)}
                      placeholder="5"
                      required
                    />
                  </div>
                </div>

                {productModalMode === 'create' && (
                  <div className="form-group">
                    <label className="form-label">Initial Stock Quantity</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Warehouse Shelf / Location Location *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Aisle 1-A"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {productModalMode === 'create' ? 'Save Product' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjustmentModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAdjustmentModalOpen(false)}>
          <div className="modal-content animate-scaleIn" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px' }}>Log Manual Stock Adjustment</h2>
              <button className="close-btn" onClick={() => setIsAdjustmentModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleAdjustmentSubmit}>
              <div className="modal-body">
                {adjustFormError && (
                  <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(244,63,94,0.08)', padding: '10px 14px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.15)', marginBottom: '16px' }}>
                    {adjustFormError}
                  </div>
                )}

                {adjustmentProduct && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid var(--border-glass)', borderRadius: '6px', marginBottom: '20px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>Product: <strong>{adjustmentProduct.name}</strong></div>
                    <div style={{ color: 'var(--text-muted)' }}>Current Stock Level: {adjustmentProduct.currentStock} Units</div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Adjustment Type</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                      <input
                        type="radio"
                        name="adjustType"
                        checked={adjustType === 'IN'}
                        onChange={() => setAdjustType('IN')}
                      />
                      Add Stock (IN)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                      <input
                        type="radio"
                        name="adjustType"
                        checked={adjustType === 'OUT'}
                        onChange={() => setAdjustType('OUT')}
                      />
                      Reduce Stock (OUT)
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder="Enter item quantity count..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <select
                    className="form-control"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    required
                  >
                    <option value="Purchase">Purchase Addition</option>
                    <option value="Stock Audit Correction">Stock Audit Correction</option>
                    <option value="Damaged Goods Inventory">Damaged Goods Inventory</option>
                    <option value="Sample Giveaway">Sample Giveaway / Marketing</option>
                    <option value="Manual Adjustment">Manual Override</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAdjustmentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Products;
