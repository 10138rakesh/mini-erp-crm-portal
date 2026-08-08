import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './screens/Dashboard';
import { Customers } from './screens/Customers';
import { Products } from './screens/Products';
import { Challans } from './screens/Challans';
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  FileText, 
  LogOut, 
  Lock, 
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">ORION PORTAL</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Mini ERP + CRM Operations Center</p>
        </div>

        {error && (
          <div style={{ 
            color: 'var(--danger)', 
            fontSize: '13px', 
            background: 'rgba(244, 63, 94, 0.08)', 
            border: '1px solid rgba(244, 63, 94, 0.2)', 
            borderRadius: 'var(--radius-sm)', 
            padding: '10px 14px', 
            marginBottom: '20px' 
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="form-control" 
                style={{ paddingLeft: '40px' }}
                placeholder="Enter username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required 
              />
              <UserIcon size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                className="form-control" 
                style={{ paddingLeft: '40px' }}
                placeholder="Enter password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Credentials helper cheat-sheet */}
        <div style={{ 
          marginTop: '32px', 
          padding: '16px', 
          background: 'rgba(255,255,255,0.02)', 
          border: '1px solid var(--border-glass)', 
          borderRadius: 'var(--radius-md)' 
        }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={12} style={{ color: 'var(--primary-hover)' }} />
            Seeded Evaluation Credentials
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Admin:</strong> admin / admin123</span>
              <span style={{ color: 'var(--text-muted)' }}>(Full Access)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Sales:</strong> sales / sales123</span>
              <span style={{ color: 'var(--text-muted)' }}>(CRM & Challans)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Warehouse:</strong> warehouse / warehouse123</span>
              <span style={{ color: 'var(--text-muted)' }}>(Inventory Control)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>Accounts:</strong> accounts / accounts123</span>
              <span style={{ color: 'var(--text-muted)' }}>(Invoices / View Only)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'products' | 'challans'>('dashboard');

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'customers': return <Customers />;
      case 'products': return <Products />;
      case 'challans': return <Challans />;
      default: return <Dashboard />;
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Operations Overview';
      case 'customers': return 'CRM Customers Management';
      case 'products': return 'Inventory & Catalog Control';
      case 'challans': return 'Sales Challans & Invoicing';
      default: return 'Portal';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">
            <Layers size={20} color="#fff" />
          </div>
          <span className="logo-text">ORION ERP</span>
        </div>

        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <Users size={18} />
            <span>CRM Customers</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <Layers size={18} />
            <span>Inventory Stock</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'challans' ? 'active' : ''}`}
            onClick={() => setActiveTab('challans')}
          >
            <FileText size={18} />
            <span>Sales Challans</span>
          </div>
        </nav>

        {/* Sidebar Footer User Details */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.name.charAt(0)}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Screen Viewport */}
      <main className="main-content">
        <header className="top-bar">
          <h1 className="view-title">{getTabTitle()}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Logged in: <strong>{user?.username}</strong>
            </span>
          </div>
        </header>

        <section className="viewport-body">
          {renderActiveScreen()}
        </section>
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: '100vw', 
        height: '100vh', 
        background: 'var(--bg-main)', 
        color: 'var(--text-secondary)' 
      }}>
        Initializing Orion ERP Connection...
      </div>
    );
  }

  return user ? <DashboardLayout /> : <LoginScreen />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
