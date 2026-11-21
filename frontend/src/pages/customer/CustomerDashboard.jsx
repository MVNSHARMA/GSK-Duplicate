import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Car, FileText, CalendarRange, Clock, Wrench, ClipboardList, MessageSquare, AlertTriangle } from 'lucide-react';

const CustomerDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/customer-portal/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.data);
      } else {
        setError(data.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError('Unable to load your dashboard right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  if (error) return (
    <div className="max-w-[1400px] mx-auto p-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <AlertTriangle size={32} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-700 font-medium">{error}</p>
        <button onClick={fetchDashboard} className="mt-4 text-sm text-red-600 underline hover:no-underline">Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      <h1 className="font-heading text-3xl mb-8">Dashboard</h1>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-blue-50 flex items-center justify-center rounded-lg">
            <Car size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{dashboardData.vehicleCount}</p>
            <p className="text-xs text-gray-500">My Vehicles</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-amber-50 flex items-center justify-center rounded-lg">
            <Wrench size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{dashboardData.activeJobCards?.length || 0}</p>
            <p className="text-xs text-gray-500">Active Services</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-red-50 flex items-center justify-center rounded-lg">
            <FileText size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{dashboardData.outstandingInvoices?.length || 0}</p>
            <p className="text-xs text-gray-500">Outstanding Invoices</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-green-50 flex items-center justify-center rounded-lg">
            <CalendarRange size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{dashboardData.upcomingBookings?.length || 0}</p>
            <p className="text-xs text-gray-500">Upcoming Bookings</p>
          </div>
        </div>
      </div>

      {dashboardData.batchMetrics && (
        <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <ClipboardList size={24} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-indigo-900">Active Service Batches</h3>
              <p className="text-sm text-indigo-700">You have {dashboardData.batchMetrics.activeBatches} active batches currently processing.</p>
            </div>
          </div>
          <Link to="/customer/batches" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-sm">
            View Batches
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Active Services */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Wrench size={18} className="text-amber-500" /> Active Services
            </h2>
            <Link to="/customer/job-cards" className="text-sm text-primary hover:underline font-medium">View All</Link>
          </div>
          {dashboardData.activeJobCards?.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg">No active services.</div>
          ) : (
            <div className="space-y-4">
              {dashboardData.activeJobCards.map(jc => (
                <Link to={`/customer/job-cards/${jc._id}`} key={jc._id} className="border border-gray-100 p-4 rounded-lg flex justify-between items-center hover:bg-gray-50 transition-colors block">
                  <div>
                    <div className="font-bold">{jc.vehicleId?.registrationNumber}</div>
                    <div className="text-xs text-gray-500">{jc.vehicleId?.brand} {jc.vehicleId?.model}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md uppercase tracking-wide">
                      {jc.status}
                    </span>
                    {jc.expectedCompletionDate && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center justify-end gap-1">
                        <Clock size={12} /> {new Date(jc.expectedCompletionDate).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <FileText size={18} className="text-red-500" /> Outstanding Invoices
            </h2>
            <Link to="/customer/invoices" className="text-sm text-primary hover:underline font-medium">View All</Link>
          </div>
          {dashboardData.outstandingInvoices?.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg">No outstanding invoices.</div>
          ) : (
            <div className="space-y-4">
              {dashboardData.outstandingInvoices.map(inv => (
                <div key={inv._id} className="border border-gray-100 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <div className="font-bold">{inv.invoiceNumber}</div>
                    <div className="text-xs text-gray-500">Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }) : 'N/A'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-dark">${inv.amountRemaining?.toFixed(2)}</div>
                    <span className="inline-block px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded uppercase mt-1">
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Service Updates */}
      {dashboardData.recentUpdates && dashboardData.recentUpdates.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare size={18} className="text-blue-500" />
            <h2 className="font-bold text-lg">Recent Service Updates</h2>
          </div>
          <div className="space-y-3">
            {dashboardData.recentUpdates.map(update => (
              <div key={update._id} className="border-l-4 border-blue-400 bg-blue-50/50 rounded-r-lg p-4">
                <p className="text-sm text-gray-800">{update.message}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <Clock size={12} />
                  <span>{new Date(update.createdAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</span>
                  <span>— {update.author}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
