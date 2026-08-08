import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, FileText, CheckCircle, XCircle, Printer, Eye, Trash2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  businessName: string;
  mobile: string;
  email: string;
  address: string;
  gstNumber?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  currentStock: number;
}

interface ChallanProduct {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

interface Challan {
  id: string;
  challanNumber: string;
  customerId: string;
  customer: {
    name: string;
    businessName: string;
    mobile: string;
    email: string;
    address: string;
    gstNumber?: string | null;
  };
  products: ChallanProduct[];
  totalQuantity: number;
  totalAmount: number;
  status: 'Draft' | 'Confirmed' | 'Cancelled';
  createdBy: string;
  createdAt: string;
}

export const Challans: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Challan for Details Drawer
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Creation Wizard states
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardCustomerId, setWizardCustomerId] = useState('');
  const [wizardItems, setWizardItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: '', quantity: 1 },
  ]);
  const [wizardStatus, setWizardStatus] = useState<'Draft' | 'Confirmed'>('Confirmed');
  const [wizardError, setWizardError] = useState('');
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const loadChallans = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/challans');
      setChallans(data);
    } catch (err) {
      console.error('Error fetching challans:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDataForWizard = async () => {
    try {
      const customersRes = await apiFetch('/customers?limit=100');
      setCustomers(customersRes.customers);
      const productsRes = await apiFetch('/products');
      setProducts(productsRes);
    } catch (err) {
      console.error('Error fetching wizard metadata:', err);
    }
  };

  useEffect(() => {
    loadChallans();
  }, []);

  const openWizard = () => {
    loadDataForWizard();
    setWizardCustomerId('');
    setWizardItems([{ productId: '', quantity: 1 }]);
    setWizardStatus('Confirmed');
    setWizardError('');
    setWizardSubmitting(false);
    setIsWizardOpen(true);
  };

  const handleAddWizardItem = () => {
    setWizardItems([...wizardItems, { productId: '', quantity: 1 }]);
  };

  const handleRemoveWizardItem = (index: number) => {
    const newItems = [...wizardItems];
    newItems.splice(index, 1);
    setWizardItems(newItems);
  };

  const handleWizardItemChange = (index: number, field: 'productId' | 'quantity', value: string) => {
    const newItems = [...wizardItems];
    if (field === 'productId') {
      newItems[index].productId = value;
    } else {
      newItems[index].quantity = Math.max(parseInt(value) || 1, 1);
    }
    setWizardItems(newItems);
  };

  const handleCreateChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    setWizardError('');

    if (!wizardCustomerId) {
      setWizardError('Please select a customer.');
      return;
    }

    const filteredItems = wizardItems.filter((i) => i.productId !== '');
    if (filteredItems.length === 0) {
      setWizardError('Please select at least one product.');
      return;
    }

    // Verify quantities do not exceed stock if Confirmed
    if (wizardStatus === 'Confirmed') {
      for (const item of filteredItems) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod && prod.currentStock < item.quantity) {
          setWizardError(`Insufficient stock for ${prod.name}. Stock: ${prod.currentStock}, Requested: ${item.quantity}`);
          return;
        }
      }
    }

    try {
      setWizardSubmitting(true);
      const res = await apiFetch('/challans', {
        method: 'POST',
        body: JSON.stringify({
          customerId: wizardCustomerId,
          productsInput: filteredItems,
          status: wizardStatus,
        }),
      });

      setIsWizardOpen(false);
      loadChallans();
      // Auto open details of the new challan
      handleViewChallan(res.id);
    } catch (err: any) {
      setWizardError(err.message || 'Error occurred during challan creation.');
    } finally {
      setWizardSubmitting(false);
    }
  };

  const handleViewChallan = async (id: string) => {
    try {
      const data = await apiFetch(`/challans/${id}`);
      setSelectedChallan(data);
      setDrawerOpen(true);
    } catch (err) {
      console.error('Error fetching challan details:', err);
    }
  };

  const handleConfirmDraftChallan = async (id: string) => {
    try {
      if (!confirm('Confirm this sales challan? This will deduct stocks from your warehouse inventory.')) return;
      
      await apiFetch(`/challans/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Confirmed' }),
      });

      // Update in details drawer & logs list
      setSelectedChallan((prev: any) => (prev ? { ...prev, status: 'Confirmed' } : null));
      loadChallans();
    } catch (err: any) {
      alert(err.message || 'Error confirming challan.');
    }
  };

  const handleCancelChallan = async (id: string) => {
    try {
      if (!confirm('Cancel this confirmed challan? This will restore stocks to your warehouse inventory. This action is terminal.')) return;
      
      await apiFetch(`/challans/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Cancelled' }),
      });

      // Update in details drawer & logs list
      setSelectedChallan((prev: any) => (prev ? { ...prev, status: 'Cancelled' } : null));
      loadChallans();
    } catch (err: any) {
      alert(err.message || 'Error cancelling challan.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Draft': return 'badge-draft';
      case 'Confirmed': return 'badge-confirmed';
      case 'Cancelled': return 'badge-cancelled';
      default: return '';
    }
  };

  // Compute live calculations in Wizard UI
  const calculateWizardTotal = () => {
    let total = 0;
    wizardItems.forEach((item) => {
      if (item.productId) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          total += prod.unitPrice * item.quantity;
        }
      }
    });
    return total;
  };

  const hasSalesAccess = user?.role === 'Admin' || user?.role === 'Sales';
  const hasCancelAccess = user?.role === 'Admin'; // restrict cancellation to Admin

  const filteredChallans = challans.filter((c) => {
    const matchesStatus = statusFilter === '' || c.status === statusFilter;
    const matchesSearch = searchQuery === '' || 
      c.challanNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.customer.businessName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="challans-module animate-fadeIn">
      {/* Filters Bar */}
      <div className="actions-bar">
        <div className="filters-wrapper">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search challan #, customer..."
              className="form-control search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="form-control select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {hasSalesAccess && (
          <button className="btn btn-primary" onClick={openWizard}>
            <Plus size={16} /> Create Challan
          </button>
        )}
      </div>

      {/* Main Table view of Challans */}
      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading sales challan ledger...</div>
      ) : filteredChallans.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          No challan transactions found. Click "Create Challan" to log your first order!
        </div>
      ) : (
        <div className="glass-card">
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Challan Number</th>
                  <th>Customer Info</th>
                  <th>Order Date</th>
                  <th>Items Count</th>
                  <th>Total Amount</th>
                  <th>Challan Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredChallans.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} style={{ color: 'var(--primary-hover)' }} />
                        <span style={{ fontWeight: 700 }}>{c.challanNumber}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.customer.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.customer.businessName}</div>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ fontSize: '13px' }}>{c.totalQuantity} items</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                      ₹{c.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(c.status)}`}>{c.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 10px', fontSize: '11px' }}
                        onClick={() => handleViewChallan(c.id)}
                      >
                        <Eye size={12} style={{ marginRight: '4px' }} /> View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Slide-out Drawer */}
      {drawerOpen && selectedChallan && (
        <div className="modal-overlay" onClick={() => setDrawerOpen(false)} style={{ justifyContent: 'flex-end', alignItems: 'stretch' }}>
          <div className="challan-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="challan-drawer-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: 'var(--primary-hover)' }} />
                  {selectedChallan.challanNumber}
                </h2>
                <span className={`badge ${getStatusBadgeClass(selectedChallan.status)}`} style={{ marginTop: '4px' }}>
                  {selectedChallan.status}
                </span>
              </div>
              <button className="close-btn" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>

            {/* Invoice Print Layout Body (White bg, customized print layout) */}
            <div className="invoice-preview-container">
              <div className="invoice-container">
                <div className="invoice-header">
                  <div className="invoice-brand">
                    <h1>ORION ENTERPRISES</h1>
                    <p>Logistics Park, Phase-1, Industrial Area</p>
                    <p>Bangalore, KA - 560064 | Email: info@orionerp.com</p>
                  </div>
                  <div className="invoice-meta">
                    <h2>SALES CHALLAN</h2>
                    <p>Challan No: <strong>{selectedChallan.challanNumber}</strong></p>
                    <p>Date: {new Date(selectedChallan.createdAt).toLocaleDateString()}</p>
                    <p>Status: <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{selectedChallan.status}</span></p>
                  </div>
                </div>

                <div className="invoice-details-grid">
                  <div className="invoice-details-col">
                    <h3>BILLED TO</h3>
                    <p><strong>{selectedChallan.customer.name}</strong></p>
                    <p>{selectedChallan.customer.businessName}</p>
                    <p>{selectedChallan.customer.address}</p>
                    <p>Mob: {selectedChallan.customer.mobile}</p>
                    {selectedChallan.customer.gstNumber && <p>GSTIN: {selectedChallan.customer.gstNumber}</p>}
                  </div>
                  <div className="invoice-details-col">
                    <h3>DISPATCHED FROM</h3>
                    <p><strong>Orion Central Warehouse</strong></p>
                    <p>Storage Rack System</p>
                    <p>Bengaluru Warehouse Terminal</p>
                    <p>Created By: {selectedChallan.createdBy}</p>
                  </div>
                </div>

                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Product Description / SKU</th>
                      <th style={{ textAlign: 'right', width: '100px' }}>Unit Price (₹)</th>
                      <th style={{ textAlign: 'right', width: '80px' }}>Qty</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>Total Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedChallan.products.map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>SKU: {item.sku}</div>
                        </td>
                        <td>{item.price.toFixed(2)}</td>
                        <td>{item.quantity}</td>
                        <td style={{ fontWeight: 600 }}>{(item.price * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="invoice-summary">
                  <table className="invoice-summary-table">
                    <tbody>
                      <tr>
                        <td>Total Quantity:</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{selectedChallan.totalQuantity} Units</td>
                      </tr>
                      <tr className="total-row">
                        <td>Grand Total:</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{selectedChallan.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="invoice-footer">
                  <p>Thank you for your business. This is a computer-generated document and requires no physical signature.</p>
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="challan-drawer-footer" style={{ padding: '20px 24px', borderTop: '1px solid var(--border-glass)', background: 'var(--bg-sidebar)', display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handlePrint}>
                <Printer size={16} /> Print / PDF
              </button>

              {selectedChallan.status === 'Draft' && hasSalesAccess && (
                <button className="btn btn-success" style={{ flex: 1 }} onClick={() => handleConfirmDraftChallan(selectedChallan.id)}>
                  <CheckCircle size={16} /> Confirm Challan
                </button>
              )}

              {selectedChallan.status === 'Confirmed' && hasCancelAccess && (
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleCancelChallan(selectedChallan.id)}>
                  <XCircle size={16} /> Cancel Challan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Challan Wizard Modal */}
      {isWizardOpen && (
        <div className="modal-overlay" onClick={() => setIsWizardOpen(false)}>
          <div className="modal-content animate-scaleIn" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px' }}>Build Sales Challan Invoice</h2>
              <button className="close-btn" onClick={() => setIsWizardOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateChallan}>
              <div className="modal-body">
                {wizardError && (
                  <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(244,63,94,0.08)', padding: '10px 14px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.15)', marginBottom: '16px' }}>
                    {wizardError}
                  </div>
                )}

                {/* Customer Picker */}
                <div className="form-group">
                  <label className="form-label">Billing Customer *</label>
                  <select
                    className="form-control"
                    value={wizardCustomerId}
                    onChange={(e) => setWizardCustomerId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose CRM Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.businessName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Items Row list */}
                <div style={{ borderTop: '1px solid var(--border-glass)', marginTop: '20px', paddingTop: '20px' }}>
                  <label className="form-label">Challan Line Items</label>
                  
                  {wizardItems.map((item, index) => {
                    const selectedProd = products.find((p) => p.id === item.productId);
                    const stockAvailable = selectedProd ? selectedProd.currentStock : 0;
                    const itemPrice = selectedProd ? selectedProd.unitPrice : 0;
                    
                    return (
                      <div key={index} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {/* Product Dropdown */}
                        <div style={{ flex: 2, minWidth: '200px' }}>
                          <select
                            className="form-control"
                            value={item.productId}
                            onChange={(e) => handleWizardItemChange(index, 'productId', e.target.value)}
                            required
                          >
                            <option value="">-- Choose Product SKU --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) - Price: ₹{p.unitPrice} | Stock: {p.currentStock}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity input */}
                        <div style={{ width: '90px' }}>
                          <input
                            type="number"
                            min="1"
                            className="form-control"
                            value={item.quantity}
                            onChange={(e) => handleWizardItemChange(index, 'quantity', e.target.value)}
                            placeholder="Qty"
                            required
                          />
                        </div>

                        {/* Calculated pricing and stock validations */}
                        <div style={{ flex: 1, minWidth: '110px', fontSize: '13px', paddingTop: '10px', color: 'var(--text-secondary)' }}>
                          {selectedProd ? (
                            <div>
                              <div>Total: <strong>₹{(itemPrice * item.quantity).toFixed(2)}</strong></div>
                              {stockAvailable < item.quantity && wizardStatus === 'Confirmed' && (
                                <div style={{ color: 'var(--danger)', fontSize: '10px', fontWeight: 600 }}>Insufficient Stock!</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </div>

                        {/* Remove item button */}
                        {wizardItems.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ padding: '8px', marginTop: '4px' }}
                            onClick={() => handleRemoveWizardItem(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddWizardItem}
                    style={{ marginTop: '8px' }}
                  >
                    + Add Product Line
                  </button>
                </div>

                {/* Total amount and Status Picker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', marginTop: '24px', paddingTop: '24px' }}>
                  <div>
                    <span className="form-label" style={{ marginBottom: '2px' }}>Estimated Total:</span>
                    <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--success)' }}>
                      ₹{calculateWizardTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0, width: '220px' }}>
                    <label className="form-label">Select Creation Mode</label>
                    <select
                      className="form-control"
                      value={wizardStatus}
                      onChange={(e) => setWizardStatus(e.target.value as any)}
                    >
                      <option value="Confirmed">Create & Confirm (Deducts Stock)</option>
                      <option value="Draft">Save as Draft (No stock reserves)</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsWizardOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={wizardSubmitting}>
                  {wizardSubmitting ? 'Creating Challan...' : 'Generate Sales Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Challans;
