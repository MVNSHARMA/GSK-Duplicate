import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardList, Search, Filter, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const CustomerJobCards = () => {
  const [jobCards, setJobCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const abortControllerRef = useRef(null);

  const fetchJobCards = useCallback(async () => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setError(null);
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/customer-portal/job-cards?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) {
        setJobCards(data.data);
      } else {
        setError(data.error || 'Unable to load service records.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Unable to load your service records right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchJobCards();
  }, [fetchJobCards]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobCards();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchJobCards]);

  const getStatusColor = (status) => {
    if (status?.includes('Completed')) return 'bg-green-100 text-green-700';
    if (status?.includes('Cancelled')) return 'bg-red-100 text-red-700';
    if (status?.includes('Work In Progress')) return 'bg-blue-100 text-blue-700';
    if (status?.includes('Waiting')) return 'bg-amber-100 text-amber-700';
    if (status?.includes('Delayed') || status?.includes('Attention')) return 'bg-red-100 text-red-700';
    if (status?.includes('Scheduled') || status?.includes('Awaiting Work')) return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
            <ClipboardList size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">Service Records</h1>
            <p className="text-gray-500 text-sm">View your active and past services</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search by Job Card Number, Rego..." 
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
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Waiting For Parts">Waiting For Parts</option>
            <option value="Stuck">Stuck</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <Filter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading service records...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertTriangle size={32} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-700 font-medium text-sm">{error}</p>
          <button onClick={fetchJobCards} className="mt-4 text-sm text-red-600 underline hover:no-underline">Try Again</button>
        </div>
      ) : jobCards.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center shadow-sm">
          <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-dark mb-2">No Service Records Found</h3>
          <p className="text-gray-500 text-sm">No job cards match your current search criteria.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Job Card #</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Date In</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Expected Out</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {jobCards.map(jc => (
                  <tr key={jc._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="py-4 px-6">
                      <Link to={`/customer/job-cards/${jc._id}`} className="font-bold text-primary hover:underline">{jc.jobNumber}</Link>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold">{jc.vehicleId?.registrationNumber}</div>
                      <div className="text-xs text-gray-500">{jc.vehicleId?.brand} {jc.vehicleId?.model}</div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {jc.dateIn ? new Date(jc.dateIn).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }) : 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {jc.expectedCompletionDate ? new Date(jc.expectedCompletionDate).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }) : 'N/A'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(jc.status)}`}>
                        {jc.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {jc.assignedMechanic?.firstName ? `${jc.assignedMechanic.firstName} ${jc.assignedMechanic.lastName}` : 'Unassigned'}
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

export default CustomerJobCards;
