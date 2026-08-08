import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DollarSign, Users, AlertTriangle, FileText, Activity, Layers } from 'lucide-react';

interface DashboardStats {
  totalRevenue: number;
  activeCustomers: number;
  lowStockCount: number;
  totalChallans: number;
}

interface ActivityLog {
  id: string;
  type: 'stock' | 'crm' | 'challan';
  message: string;
  user: string;
  timestamp: string;
}

export const Dashboard: React.FC = () => {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    activeCustomers: 0,
    lowStockCount: 0,
    totalChallans: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch products to count low stock
        const products = await apiFetch('/products');
        const lowStock = products.filter((p: any) => p.currentStock <= p.minStockAlert);
        setLowStockProducts(lowStock);

        // Fetch customers to count active
        const customersRes = await apiFetch('/customers?limit=100');
        const activeCount = customersRes.customers.filter((c: any) => c.status === 'Active').length;

        // Fetch challans to count and compute revenue
        const challans = await apiFetch('/challans');
        const totalRev = challans
          .filter((c: any) => c.status === 'Confirmed')
          .reduce((sum: number, c: any) => sum + c.totalAmount, 0);

        setStats({
          totalRevenue: totalRev,
          activeCustomers: activeCount,
          lowStockCount: lowStock.length,
          totalChallans: challans.length,
        });

        // Generate activities based on latest stock movements & customer follow-ups
        const tempActivities: ActivityLog[] = [];

        // Try fetching stock movements if Warehouse/Admin
        try {
          const movements = await apiFetch('/products/movements');
          movements.slice(0, 5).forEach((m: any) => {
            tempActivities.push({
              id: m.id,
              type: 'stock',
              message: `${m.movementType} movement for ${m.product.name} (Qty: ${m.quantity}, Reason: ${m.reason})`,
              user: m.createdBy,
              timestamp: m.timestamp,
            });
          });
        } catch (e) {
          // Silent catch for roles that can't fetch movements
        }

        // Add mock challan activities
        challans.slice(0, 5).forEach((c: any) => {
          tempActivities.push({
            id: c.id,
            type: 'challan',
            message: `Challan ${c.challanNumber} (${c.status}) created for ${c.customer.name}`,
            user: c.createdBy,
            timestamp: c.createdAt,
          });
        });

        // Sort combined activities by timestamp
        tempActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivities(tempActivities.slice(0, 6));

      } catch (error) {
        console.error('Error fetching dashboard statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading dashboard statistics...</div>;
  }

  // Monthly sales mockup chart points for SVG render (premium visualization)
  const salesChartData = [3500, 4800, 6200, 5900, 7800, stats.totalRevenue || 9200];
  const chartLabels = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  const maxVal = Math.max(...salesChartData) * 1.1;

  // Compute coordinates for SVG path
  const svgWidth = 500;
  const svgHeight = 160;
  const paddingX = 40;
  const paddingY = 20;

  const points = salesChartData.map((val, idx) => {
    const x = paddingX + (idx / (salesChartData.length - 1)) * (svgWidth - paddingX * 2);
    const y = svgHeight - paddingY - (val / maxVal) * (svgHeight - paddingY * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`;

  return (
    <div className="dashboard-view animate-fadeIn">
      {/* Upper Metrics Grid */}
      <div className="grid-4">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Confirmed Revenue</span>
            <div className="metric-icon-box" style={{ color: 'var(--success)' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: 'var(--success)' }}>
            ₹{stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="metric-subtitle">Sum of all Confirmed Challans</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Customers</span>
            <div className="metric-icon-box" style={{ color: 'var(--info)' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="metric-value">{stats.activeCustomers}</div>
          <div className="metric-subtitle">Excludes Leads and Inactive accounts</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Low Stock Warnings</span>
            <div className="metric-icon-box" style={{ color: stats.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: stats.lowStockCount > 0 ? 'var(--danger)' : 'inherit' }}>
            {stats.lowStockCount}
          </div>
          <div className="metric-subtitle">Products below safety stock alert</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Sales Challans</span>
            <div className="metric-icon-box" style={{ color: 'var(--primary-hover)' }}>
              <FileText size={20} />
            </div>
          </div>
          <div className="metric-value">{stats.totalChallans}</div>
          <div className="metric-subtitle">Total drafts, confirmed, & cancelled</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
        {/* Left Column: Line Chart */}
        <div className="glass-card">
          <div className="card-title">
            <Layers size={18} />
            <span>Revenue Trajectory (INR)</span>
          </div>
          <div className="chart-container">
            <svg className="chart-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
              <defs>
                <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = paddingY + ratio * (svgHeight - paddingY * 2);
                return (
                  <line key={i} x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} className="chart-grid-line" />
                );
              })}

              {/* Axis Line */}
              <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} className="chart-axis-line" />

              {/* Area Under Curve */}
              <path d={areaPath} className="chart-area" />

              {/* Line Curve */}
              <path d={linePath} className="chart-line" />

              {/* Points */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r={5} fill="#0d1426" stroke="var(--primary)" strokeWidth={3} />
                  <text x={p.x} y={p.y - 10} textAnchor="middle" className="chart-axis-text" fill="var(--text-primary)" style={{ fontSize: '9px', fontWeight: 'bold' }}>
                    ₹{salesChartData[idx]}
                  </text>
                </g>
              ))}

              {/* Labels */}
              {points.map((p, idx) => (
                <text key={idx} x={p.x} y={svgHeight - 4} textAnchor="middle" className="chart-axis-text">
                  {chartLabels[idx]}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Right Column: Alerts Panel */}
        <div className="glass-card">
          <div className="card-title">
            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            <span>Low Stock Alerts</span>
          </div>
          {lowStockProducts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>All products are sufficiently stocked. Excellent!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto' }}>
              {lowStockProducts.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.name} ({p.sku})</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Location: {p.location}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--danger)' }}>{p.currentStock} Units Left</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Safety Limit: {p.minStockAlert}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Log Audit Panel */}
      <div className="glass-card">
        <div className="card-title">
          <Activity size={18} />
          <span>Real-time Operation Activity Logs</span>
        </div>
        {activities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No operations recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activities.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {a.type === 'stock' ? (
                    <span style={{ color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.08)', padding: '6px', borderRadius: '4px', display: 'flex' }}><Layers size={14} /></span>
                  ) : (
                    <span style={{ color: 'var(--info)', background: 'rgba(14, 165, 233, 0.08)', padding: '6px', borderRadius: '4px', display: 'flex' }}><FileText size={14} /></span>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-primary)' }}>{a.message}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontSize: '11px' }}>By: {a.user}</span>
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default Dashboard;
