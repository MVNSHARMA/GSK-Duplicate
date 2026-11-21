import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CalendarRange, Search, Filter } from 'lucide-react';

const CustomerBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const abortControllerRef = useRef(null);

  const fetchBookings = useCallback(async () => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setError(null);
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/customer-portal/bookings?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) {
        setBookings(data.data);
      } else {
        setError(data.error || 'Unable to load bookings.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Unable to load your bookings right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBookings();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchBookings]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-700';
      case 'Confirmed': return 'bg-blue-100 text-blue-700';
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
            <CalendarRange size={24} className="text-green-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">Bookings</h1>
            <p className="text-gray-500 text-sm">View your service bookings and requests</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search by Vehicle Rego..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-sm focus:border-primary outline-none transition-colors shadow-sm"
          />
        </div>
        <div className="w-full md:w-64 relative">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-primary outline-none transition-colors text-dark appearance-none cursor-pointer shadow-sm"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <Filter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading bookings...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <p className="text-red-700 font-medium text-sm">{error}</p>
          <button onClick={fetchBookings} className="mt-4 text-sm text-red-600 underline hover:no-underline">Try Again</button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center shadow-sm">
          <CalendarRange size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-dark mb-2">No Bookings Found</h3>
          <p className="text-gray-500 text-sm">No bookings match your current search criteria.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Service Type</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(booking => (
                  <tr key={booking._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-dark">
                      {new Date(booking.preferredDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {booking.preferredTime || 'Any Time'}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold">{booking.vehicleId?.registrationNumber || booking.vehicleRego}</div>
                      <div className="text-xs text-gray-500">{booking.vehicleId?.brand || booking.vehicleMake} {booking.vehicleId?.model || booking.vehicleModel}</div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-700 max-w-[200px] truncate" title={booking.serviceType}>
                      {booking.serviceType}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerBookings;
