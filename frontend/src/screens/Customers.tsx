import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Calendar, Edit2, Phone, Mail, MapPin, Building, ChevronLeft, Send } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  businessName: string;
  gstNumber?: string | null;
  customerType: string; // Retail, Wholesale, Distributor
  address: string;
  status: string; // Lead, Active, Inactive
  followUpDate?: string | null;
  notes?: string | null;
}

interface FollowUp {
  id: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export const Customers: React.FC = () => {
  const { apiFetch, user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter states
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Details panel state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<(Customer & { followUps: FollowUp[]; challans: any[] }) | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [newFollowUpNote, setNewFollowUpNote] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBusiness, setFormBusiness] = useState('');
  const [formGst, setFormGst] = useState('');
  const [formType, setFormType] = useState('Retail');
  const [formAddress, setFormAddress] = useState('');
  const [formStatus, setFormStatus] = useState('Lead');
  const [formFollowUpDate, setFormFollowUpDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const [formError, setFormError] = useState('');

  const loadCustomers = async () => {
    try {
      setLoading(true);
      let endpoint = `/customers?page=${page}&limit=8`;
      if (search) endpoint += `&search=${encodeURIComponent(search)}`;
      if (typeFilter) endpoint += `&customerType=${typeFilter}`;
      if (statusFilter) endpoint += `&status=${statusFilter}`;

      const res = await apiFetch(endpoint);
      setCustomers(res.customers);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [page, typeFilter, statusFilter]);

  // Handle manual search trigger
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCustomers();
  };

  const handleSelectCustomer = async (id: string) => {
    try {
      setDetailsLoading(true);
      setSelectedCustomerId(id);
      const data = await apiFetch(`/customers/${id}`);
      setSelectedCustomer(data);
    } catch (err) {
      console.error('Error loading customer details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setSelectedCustomerId(null);
    setSelectedCustomer(null);
    loadCustomers();
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !newFollowUpNote.trim()) return;

    try {
      const addedNote = await apiFetch(`/customers/${selectedCustomerId}/followups`, {
        method: 'POST',
        body: JSON.stringify({ note: newFollowUpNote }),
      });

      setSelectedCustomer((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          followUps: [addedNote, ...prev.followUps],
        };
      });
      setNewFollowUpNote('');
    } catch (err: any) {
      console.error('Failed to add follow up:', err);
      alert(err.message || 'Failed to add follow up note');
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditId(null);
    setFormName('');
    setFormMobile('');
    setFormEmail('');
    setFormBusiness('');
    setFormGst('');
    setFormType('Retail');
    setFormAddress('');
    setFormStatus('Lead');
    setFormFollowUpDate('');
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode('edit');
    setEditId(c.id);
    setFormName(c.name);
    setFormMobile(c.mobile);
    setFormEmail(c.email);
    setFormBusiness(c.businessName);
    setFormGst(c.gstNumber || '');
    setFormType(c.customerType);
    setFormAddress(c.address);
    setFormStatus(c.status);
    setFormFollowUpDate(c.followUpDate ? c.followUpDate.split('T')[0] : '');
    setFormNotes(c.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName || !formMobile || !formEmail || !formBusiness || !formAddress || !formStatus) {
      setFormError('Please fill out all required fields.');
      return;
    }

    const payload = {
      name: formName,
      mobile: formMobile,
      email: formEmail,
      businessName: formBusiness,
      gstNumber: formGst || null,
      customerType: formType,
      address: formAddress,
      status: formStatus,
      followUpDate: formFollowUpDate || null,
      notes: formNotes || null,
    };

    try {
      if (modalMode === 'create') {
        await apiFetch('/customers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/customers/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      setIsModalOpen(false);
      loadCustomers();
      if (selectedCustomerId && selectedCustomerId === editId) {
        handleSelectCustomer(editId); // Refresh details if editing selected
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred during submission.');
    }
  };

  const getBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'lead': return 'badge-lead';
      case 'active': return 'badge-active';
      case 'inactive': return 'badge-inactive';
      default: return '';
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type.toLowerCase()) {
      case 'retail': return 'badge-retail';
      case 'wholesale': return 'badge-wholesale';
      case 'distributor': return 'badge-distributor';
      default: return '';
    }
  };

  const hasWriteAccess = user?.role === 'Admin' || user?.role === 'Sales';

  return (
    <div className="crm-module animate-fadeIn">
      {/* Detail view overlay panel if selected */}
      {selectedCustomerId ? (
        <div className="crm-detail-view">
          <button className="btn btn-secondary btn-sm" onClick={handleCloseDetails} style={{ marginBottom: '20px' }}>
            <ChevronLeft size={16} /> Back to Customers List
          </button>
          
          {detailsLoading || !selectedCustomer ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading customer files...</div>
          ) : (
            <div className="crm-workspace animate-fadeIn">
              {/* Left Column: Follow up notes feed */}
              <div>
                <div className="glass-card">
                  <div className="card-title">Timeline & Follow-ups</div>
                  
                  {hasWriteAccess && (
                    <form onSubmit={handleAddFollowUp} style={{ marginBottom: '32px' }}>
                      <div className="form-group">
                        <label className="form-label">Log New Interaction / Note</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <input
                            type="text"
                            placeholder="Add follow-up notes, discussion summary, or next actions..."
                            className="form-control"
                            value={newFollowUpNote}
                            onChange={(e) => setNewFollowUpNote(e.target.value)}
                            required
                          />
                          <button type="submit" className="btn btn-primary">
                            <Send size={16} /> Log Note
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  <div className="timeline">
                    {selectedCustomer.followUps.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No interactions recorded yet.</p>
                    ) : (
                      selectedCustomer.followUps.map((note) => (
                        <div key={note.id} className="timeline-item">
                          <div className="timeline-dot"></div>
                          <div className="timeline-card">
                            <div className="timeline-meta">
                              <span className="timeline-author">{note.createdBy}</span>
                              <span>{new Date(note.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="timeline-text">{note.note}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Profile details */}
              <div>
                <div className="glass-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{selectedCustomer.name}</h2>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedCustomer.businessName}</p>
                    </div>
                    {hasWriteAccess && (
                      <button className="btn btn-secondary btn-sm" onClick={(e) => openEditModal(selectedCustomer, e)} style={{ padding: '6px' }}>
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <span className={`badge ${getBadgeClass(selectedCustomer.status)}`}>{selectedCustomer.status}</span>
                    <span className={`badge ${getTypeBadgeClass(selectedCustomer.customerType)}`}>{selectedCustomer.customerType}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{selectedCustomer.mobile}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{selectedCustomer.email}</span>
                    </div>
                    {selectedCustomer.gstNumber && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <Building size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>GSTIN: <strong>{selectedCustomer.gstNumber}</strong></span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <MapPin size={14} style={{ color: 'var(--text-muted)', marginTop: '3px' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{selectedCustomer.address}</span>
                    </div>
                    {selectedCustomer.followUpDate && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(79,70,229,0.08)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(79,70,229,0.15)' }}>
                        <Calendar size={14} style={{ color: 'var(--primary-hover)' }} />
                        <span style={{ fontSize: '12px' }}>Next Follow-up: <strong>{new Date(selectedCustomer.followUpDate).toLocaleDateString()}</strong></span>
                      </div>
                    )}
                  </div>

                  {selectedCustomer.notes && (
                    <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', fontSize: '12px' }}>
                      <strong style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '4px' }}>Overview Notes</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>{selectedCustomer.notes}</span>
                    </div>
                  )}
                </div>

                {/* Orders History Card */}
                <div className="glass-card" style={{ padding: '20px' }}>
                  <div className="card-title" style={{ fontSize: '14px', marginBottom: '12px' }}>Challan Order History</div>
                  {selectedCustomer.challans.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No orders placed yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedCustomer.challans.map((challan) => (
                        <div key={challan.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '4px', fontSize: '12px' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{challan.challanNumber}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{new Date(challan.createdAt).toLocaleDateString()}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600 }}>₹{challan.totalAmount.toLocaleString('en-IN')}</div>
                            <span style={{ fontSize: '9px', textTransform: 'uppercase', color: challan.status === 'Confirmed' ? 'var(--success)' : challan.status === 'Draft' ? 'var(--text-secondary)' : 'var(--danger)' }}>
                              {challan.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Customers List Mode */
        <div>
          {/* Header Action Bar */}
          <div className="actions-bar">
            <form onSubmit={handleSearchSubmit} className="filters-wrapper">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search name, mobile, business..."
                  className="form-control search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-control select-filter"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Types</option>
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
                <option value="Distributor">Distributor</option>
              </select>
              <select
                className="form-control select-filter"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                <option value="Lead">Lead</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <button type="submit" className="btn btn-secondary">Search</button>
            </form>

            {hasWriteAccess && (
              <button className="btn btn-primary" onClick={openCreateModal}>
                <Plus size={16} /> Add Customer
              </button>
            )}
          </div>

          {/* Grid display */}
          {loading ? (
            <div style={{ color: 'var(--text-secondary)' }}>Retrieving CRM customer records...</div>
          ) : customers.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              No customers found. Click "Add Customer" to register your first lead!
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {customers.map((c) => (
                  <div
                    key={c.id}
                    className="metric-card"
                    style={{ cursor: 'pointer', padding: '20px' }}
                    onClick={() => handleSelectCustomer(c.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span className={`badge ${getTypeBadgeClass(c.customerType)}`}>{c.customerType}</span>
                      <span className={`badge ${getBadgeClass(c.status)}`}>{c.status}</span>
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '6px 0 2px 0' }}>{c.name}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{c.businessName}</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '10px', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Phone size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>{c.mobile}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>{c.email}</span>
                      </div>
                    </div>

                    {hasWriteAccess && (
                      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => openEditModal(c, e)}
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                        >
                          <Edit2 size={10} style={{ marginRight: '4px' }} /> Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  >
                    Previous
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)', padding: '0 8px' }}>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content animate-scaleIn" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px' }}>{modalMode === 'create' ? 'Register New Customer' : 'Edit Customer Record'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ color: 'var(--danger)', fontSize: '13px', background: 'rgba(244,63,94,0.08)', padding: '10px 14px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.15)', marginBottom: '16px' }}>
                    {formError}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business / Shop Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formBusiness}
                      onChange={(e) => setFormBusiness(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Mobile Number *</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formMobile}
                      onChange={(e) => setFormMobile(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">GST Number (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formGst}
                      onChange={(e) => setFormGst(e.target.value)}
                      placeholder="e.g. 29AAAAA1111A1Z1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Customer Type *</label>
                    <select
                      className="form-control"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      required
                    >
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                      <option value="Distributor">Distributor</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Status *</label>
                    <select
                      className="form-control"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      required
                    >
                      <option value="Lead">Lead</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Follow-up Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formFollowUpDate}
                      onChange={(e) => setFormFollowUpDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Address *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Shop No, Building, Street, City, State - PIN"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes & Summary</label>
                  <textarea
                    className="form-control"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Enter customer relationship details, preferences or summary..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {modalMode === 'create' ? 'Save Customer' : 'Update Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Customers;
