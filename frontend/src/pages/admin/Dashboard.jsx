import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Car, Clock, PenTool, FileText, AlertTriangle, 
  DollarSign, ArrowRight, Loader2, MessageSquare, 
  Calendar, Bell, CheckCircle, RefreshCw, AlertCircle, Wrench, PlayCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import {
  LineChart, Line, BarChart as RechartsBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '🔒';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
};

// --- SKELETON COMPONENTS ---
const SkeletonCard = () => (
  <div className="bg-white border border-gray-100 rounded-xl p-5 h-full animate-pulse flex flex-col justify-between">
    <div>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100"></div>
        <div className="w-20 h-8 bg-gray-100 rounded-md"></div>
      </div>
      <div className="w-24 h-4 bg-gray-100 rounded mt-2"></div>
      <div className="w-16 h-3 bg-gray-50 rounded mt-2"></div>
    </div>
  </div>
);

const DashboardSkeleton = () => (
  <div className="max-w-[1400px] mx-auto pb-12">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-gray-100 pb-6 animate-pulse">
      <div>
        <div className="w-48 h-8 bg-gray-200 rounded mb-2"></div>
        <div className="w-64 h-4 bg-gray-100 rounded"></div>
      </div>
      <div className="w-full md:w-96 h-10 bg-gray-100 rounded-xl"></div>
    </div>
    
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 h-48 animate-pulse"></div>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 h-96 animate-pulse"></div>
      </div>
      <div className="space-y-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 h-64 animate-pulse"></div>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 h-48 animate-pulse"></div>
        <div className="bg-white border border-gray-100 rounded-2xl p-6 h-96 animate-pulse"></div>
      </div>
    </div>
  </div>
);

// --- SIMPLE CHART ---
const BarChart = ({ data, label, valueKey, isCurrency = false }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex flex-col items-center justify-center text-sm text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
        <span className="mb-1">No {label.toLowerCase()} recorded.</span>
      </div>
    );
  }
  const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div className="mt-4">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">{label} Trend</h4>
      <div className="flex items-end h-40 gap-2 overflow-x-auto pb-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex flex-col justify-end items-center flex-1 min-w-[30px] group">
            <div 
              className="w-full bg-red-100 hover:bg-red-500 rounded-t-sm transition-colors relative cursor-pointer"
              style={{ height: `${(item[valueKey] / maxVal) * 100}%`, minHeight: '4px' }}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-dark text-white text-[10px] py-1.5 px-3 rounded shadow-lg pointer-events-none whitespace-nowrap z-10 transition-opacity">
                <span className="block font-bold">{item._id}</span>
                <span>{isCurrency ? formatCurrency(item[valueKey]) : item[valueKey]}</span>
              </div>
            </div>
            <span className="text-[9px] text-gray-400 mt-2 truncate w-full text-center">
              {item._id.substring(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- METRIC CARD ---
const MetricCard = ({ title, value, icon: Icon, link, color, bg, subtitle }) => {
  const isMasked = value === '🔒';
  
  const content = (
    <div className={`bg-white border border-gray-100 rounded-xl p-5 h-full flex flex-col justify-between transition-all ${link ? 'hover:border-gray-200 hover:shadow-md cursor-pointer group' : ''}`}>
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg || 'bg-red-50'}`}>
            <Icon size={20} className={color || 'text-red-500'} />
          </div>
          <h3 className={`text-2xl font-bold font-heading leading-none ${isMasked ? 'text-gray-300' : 'text-dark'}`}>
            {value}
          </h3>
        </div>
        <p className="text-gray-600 text-sm font-bold tracking-wide">{title}</p>
        {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
      </div>
      {link && (
        <div className={`text-[11px] font-bold uppercase mt-5 flex items-center gap-1 ${color || 'text-red-500'} opacity-80 group-hover:opacity-100 transition-opacity w-fit`}>
          View Details <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
        </div>
      )}
    </div>
  );

  return link ? <Link to={link} className="block h-full">{content}</Link> : content;
};

// --- FINANCIAL OVERVIEW COMPONENT ---
const FinancialOverview = ({ financials }) => {
  if (!financials) return null;

  const { totals, sources, trend } = financials;
  
  const formatChartDate = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.substring(5);
  };

  return (
    <div className="mt-8 pt-8 border-t border-gray-100">
      <div className="mb-6">
        <h2 className="text-lg font-heading">Financial Overview</h2>
        <p className="text-sm text-gray-500">Track revenue, expenses and dealer vehicle performance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Money In vs Money Out</h3>
          {trend && trend.length > 0 ? (
            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" tickFormatter={formatChartDate} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} dy={10} />
                  <YAxis tickFormatter={(val) => `$${val > 1000 ? (val/1000).toFixed(0) + 'k' : val}`} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} dx={-10} />
                  <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(label) => `Date: ${label}`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                  <Line type="monotone" name="Money In" dataKey="moneyIn" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Money Out" dataKey="moneyOut" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 font-medium">No financial activity for this period.</p>
            </div>
          )}
        </div>
        
      </div>

      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Dealer Car Performance</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-3 bg-blue-50/50 p-3 px-4 rounded-xl border border-blue-100">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
              <DollarSign size={18} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Dealer Car Profit</p>
              <p className="text-2xl font-bold font-heading text-blue-700">{formatCurrency(totals?.dealerCarProfit || 0)}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500 max-w-sm">
            Profit is calculated as <span className="font-medium text-gray-700">Sale Price - Purchase Price</span> for dealer vehicles sold within the selected period.
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD ---
const Dashboard = () => {
  const { token, user } = useAuth();
  const { startTour } = useTour();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const abortControllerRef = useRef(null);

  const fetchDashboardStats = async () => {
    setLoading(true);
    setError('');
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      if (!token) return;
      let url = `${import.meta.env.VITE_API_URL}/dashboard?period=${period}`;
      if (period === 'custom' && customRange.start && customRange.end) {
        url += `&customStart=${customRange.start}&customEnd=${customRange.end}`;
      }
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }, signal });
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Dashboard fetch error:", err);
      setError("Network error fetching dashboard data. Please try again.");
    } finally {
      if (!abortControllerRef.current?.signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [token, period, customRange.start, customRange.end]);

  if (loading && !data) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto text-dark">
        <div className="bg-red-50 text-red-600 border border-red-200 p-6 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" />
            <div>
              <p className="font-bold">Error loading dashboard</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
          <button onClick={fetchDashboardStats} className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-bold transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-[1400px] mx-auto text-dark pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-gray-100 pb-6">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-4 mb-1">
            <h1 data-tour="dashboard-header" className="font-heading text-3xl flex items-center gap-3">
              Operational Dashboard
              {loading && <Loader2 size={18} className="text-red-500 animate-spin" />}
            </h1>
            
            {user && (user.role === 'admin' || user.role === 'super_admin') && (
              <button 
                data-tour="dashboard-tour-button"
                onClick={() => startTour('admin-overview')}
                className="flex items-center gap-1.5 text-xs font-bold bg-dark hover:bg-black text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
              >
                <PlayCircle size={14} />
                Take a Tour
              </button>
            )}
          </div>
          <p className="text-gray-500 text-sm">Real-time overview of GSK Automotive performance</p>
        </div>

        {/* DATE FILTER */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ].map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p.id ? 'bg-dark text-white shadow-md' : 'text-gray-500 hover:text-dark hover:bg-gray-50'}`}>
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1 shadow-sm">
              <input type="date" value={customRange.start} onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))} className="text-xs p-1 outline-none font-medium text-gray-700" />
              <span className="text-gray-300">-</span>
              <input type="date" value={customRange.end} onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))} className="text-xs p-1 outline-none font-medium text-gray-700" />
            </div>
          )}
          <button onClick={fetchDashboardStats} className="p-2.5 border border-gray-200 text-gray-500 hover:text-dark rounded-xl hover:bg-white shadow-sm ml-2 bg-gray-50 transition-colors" title="Refresh">
             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ROW 1: ACTIONABLE COMMUNICATIONS */}
      <div data-tour="dashboard-quick-actions" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard 
          title="Unread Messages" value={data.communications.unreadMessages} icon={MessageSquare} 
          bg="bg-purple-50" color="text-purple-600" link="/admin/communications?tab=messages"
        />
        <MetricCard 
          title="Pending Quotes" value={data.communications.pendingQuotes} icon={FileText} 
          bg="bg-blue-50" color="text-blue-600" link="/admin/communications?tab=quotes"
        />
        <MetricCard 
          title="New Requests" value={data.communications.newServiceRequests} icon={Calendar} 
          bg="bg-emerald-50" color="text-emerald-600" link="/admin/communications?tab=bookings"
        />
        <MetricCard 
          title="Notifications" value={data.communications.unreadNotifications} icon={Bell} 
          bg="bg-orange-50" color="text-orange-600" link="/admin/communications?tab=notifications"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* LEFT COLUMN: ACTIVITY & TRENDS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ROW 2: FINANCIAL & SERVICE PERIOD */}
          <div data-tour="dashboard-stats" className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-heading mb-5 flex items-center justify-between">
              <span>Period Activity <span className="text-xs text-gray-400 font-sans ml-2 font-normal">(Selected Date Range)</span></span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <MetricCard 
                title="Sales Revenue" 
                value={data.sales.periodAmount === null ? '🔒' : formatCurrency(data.sales.periodAmount)} 
                subtitle={`${data.sales.periodCount || 0} transactions`}
                icon={DollarSign} 
                bg="bg-emerald-50" color="text-emerald-600" link="/admin/daily-sales"
              />
              <MetricCard 
                title="Invoiced Amount" 
                value={data.invoices.period?.amount === null ? '🔒' : formatCurrency(data.invoices.period?.amount)}
                subtitle={`${data.invoices.period?.count || 0} invoices`} 
                icon={FileText} 
                bg="bg-blue-50" color="text-blue-600" link="/admin/invoices"
              />
              <MetricCard 
                title="Total Outstanding" 
                value={data.invoices.total?.outstandingAmount === null ? '🔒' : formatCurrency(data.invoices.total?.outstandingAmount)}
                subtitle="All unpaid invoices"
                icon={AlertCircle} 
                bg="bg-red-50" color="text-red-600" link="/admin/invoices?status=Unpaid"
              />
              <MetricCard 
                title="Completed Jobs" 
                value={data.jobCards['Completed'] || 0} 
                subtitle="Service finalized"
                icon={CheckCircle} 
                bg="bg-gray-100" color="text-gray-800" link="/admin/job-cards?status=Completed"
              />
            </div>
          </div>

          {/* ROW 3: JOB CARD OVERVIEW & TRENDS */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-heading mb-5">Job Card Overview <span className="text-xs text-gray-400 font-sans ml-2 font-normal">(Live)</span></h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Link to="/admin/job-cards?status=Open" className="block p-4 rounded-xl border border-red-100 bg-red-50/30 hover:bg-red-50 hover:border-red-200 transition-colors group">
                <p className="text-red-600 text-xs font-bold uppercase tracking-wider mb-2">Open</p>
                <p className="text-2xl font-bold font-heading text-red-700">{data.jobCards['Open'] || 0}</p>
              </Link>
              <Link to="/admin/job-cards?status=In Progress" className="block p-4 rounded-xl border border-blue-100 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-2">In Progress</p>
                <p className="text-2xl font-bold font-heading text-blue-700">{data.jobCards['In Progress'] || 0}</p>
              </Link>
              <Link to="/admin/job-cards?status=Waiting For Parts" className="block p-4 rounded-xl border border-orange-100 bg-orange-50/30 hover:bg-orange-50 hover:border-orange-200 transition-colors group">
                <p className="text-orange-600 text-xs font-bold uppercase tracking-wider mb-2">Wait Parts</p>
                <p className="text-2xl font-bold font-heading text-orange-700">{data.jobCards['Waiting For Parts'] || 0}</p>
              </Link>
              <Link to="/admin/job-cards?status=Stuck" className="block p-4 rounded-xl border border-yellow-100 bg-yellow-50/30 hover:bg-yellow-50 hover:border-yellow-200 transition-colors group">
                <p className="text-yellow-600 text-xs font-bold uppercase tracking-wider mb-2">Stuck</p>
                <p className="text-2xl font-bold font-heading text-yellow-700">{data.jobCards['Stuck'] || 0}</p>
              </Link>
            </div>
            
            {/* INJECT FINANCIAL OVERVIEW HERE */}
            {data.financials && <FinancialOverview financials={data.financials} />}
          </div>
        </div>

        {/* RIGHT COLUMN: ALERTS, ASSETS, ACTIVITY */}
        <div className="space-y-6">
          
          {/* INVENTORY ALERTS */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading flex items-center gap-2">
                <AlertTriangle size={18} className="text-orange-500" /> Inventory Alerts
              </h2>
              <Link to="/admin/inventory" className="text-xs font-bold text-red-500 hover:text-red-600 uppercase">View All</Link>
            </div>
            
            {data.inventory.lowStockPreview && data.inventory.lowStockPreview.length > 0 ? (
              <div className="space-y-3">
                {data.inventory.lowStockPreview.map((item, idx) => {
                  const isOutOfStock = item.quantity <= 0;
                  return (
                    <Link key={idx} to="/admin/inventory" className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex-1 pr-3 truncate">
                        <p className="text-sm font-bold text-dark truncate">{item.itemName}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Min level: {item.minStockLevel}</p>
                      </div>
                      <div className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {item.quantity} Left
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                <p className="text-sm text-emerald-700 font-medium">All inventory levels are currently healthy.</p>
              </div>
            )}
          </div>

          {/* CURRENT ASSETS */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-heading mb-4">Current Assets</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3"><Users size={18} className="text-blue-500"/><span className="text-sm font-bold text-gray-700">Total Customers</span></div>
                <span className="font-bold text-dark text-lg">{data.customers.Total || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3"><Car size={18} className="text-purple-500"/><span className="text-sm font-bold text-gray-700">Active Vehicles</span></div>
                <span className="font-bold text-dark text-lg">{data.vehicles.total || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3"><Wrench size={18} className="text-gray-500"/><span className="text-sm font-bold text-gray-700">Vehicles In Service</span></div>
                <span className="font-bold text-dark text-lg">{data.vehicles.inService || 0}</span>
              </div>
            </div>
          </div>

          {/* RECENT ACTIVITY */}
          <div data-tour="dashboard-recent-activity" className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 sm:p-6 flex flex-col max-h-[500px]">
            <h2 className="text-lg font-heading mb-4">Recent Activity</h2>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {data.recentActivity && data.recentActivity.length > 0 ? data.recentActivity.map((act, i) => (
                <Link key={i} to={act.link} className="flex gap-3 p-3 bg-gray-50/50 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-200 group">
                  <div className="w-9 h-9 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:border-red-200 transition-colors">
                    <Clock size={14} className="text-gray-400 group-hover:text-red-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{act.type}</p>
                    <p className="text-sm font-medium text-dark leading-snug">{act.title}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <p className="text-[10px] text-gray-400">{new Date(act.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                      <span className="text-[10px] text-gray-300">•</span>
                      <p className="text-[10px] text-gray-500 font-medium">
                        By {act.actor?.name || 'System'}
                      </p>
                    </div>
                  </div>
                </Link>
              )) : (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">No recent activity.</div>
              )}
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
};

export default Dashboard;
