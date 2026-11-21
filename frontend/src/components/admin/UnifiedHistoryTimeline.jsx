import React, { useState, useEffect } from 'react';
import { History, Calendar, FileText, FileCheck, Phone, MapPin, Wrench, ChevronRight, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const UnifiedHistoryTimeline = ({ entityId, entityType }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [metrics, setMetrics] = useState({ totalVisits: 0, lastService: null, totalEvents: 0 });
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [typeFilter, setTypeFilter] = useState('All');
  const [error, setError] = useState('');

  const isMechanic = user?.role === 'mechanic';
  const isCustomer = entityType === 'customer';

  const fetchHistory = async (page = 1, type = typeFilter) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('gsk_token');
      const url = `${import.meta.env.VITE_API_URL}/${entityType}s/${entityId}/history?page=${page}&limit=20&typeFilter=${type}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        if (page === 1) {
          setEvents(data.data);
        } else {
          setEvents(prev => [...prev, ...data.data]);
        }
        setMetrics(data.metrics || { totalVisits: 0, lastService: null, totalEvents: 0 });
        setPagination(data.pagination || { page: 1, pages: 1 });
      } else {
        setError(data.error || 'Failed to fetch history');
      }
    } catch (err) {
      setError('Network error fetching history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) {
      fetchHistory(1, typeFilter);
    }
  }, [entityId, typeFilter]);

  const handleFilterClick = (type) => {
    if (type !== typeFilter) {
      setTypeFilter(type);
    }
  };

  const loadMore = () => {
    if (pagination.page < pagination.pages) {
      fetchHistory(pagination.page + 1);
    }
  };

  // Group events by year
  const groupedByYear = events.reduce((acc, event) => {
    const year = new Date(event.date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(event);
    return acc;
  }, {});
  
  const sortedYears = Object.keys(groupedByYear).sort((a, b) => b - a);

  const getEventIcon = (type) => {
    switch (type) {
      case 'Service': return <Wrench size={16} className="text-white" />;
      case 'Invoice': return <FileText size={16} className="text-white" />;
      case 'Quote': return <FileCheck size={16} className="text-white" />;
      case 'Booking': return <Calendar size={16} className="text-white" />;
      default: return <History size={16} className="text-white" />;
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'Service': return 'bg-red-500';
      case 'Invoice': return 'bg-green-500';
      case 'Quote': return 'bg-blue-500';
      case 'Booking': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 overflow-hidden mt-8 animate-fade-in-up">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2">
            <History className="text-primary" size={20} />
            History with GSK Automotive
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Complete timeline of interactions, services, and transactions.
          </p>
        </div>
        <button 
          onClick={() => fetchHistory(1, typeFilter)} 
          className="text-gray-500 hover:text-primary transition-colors flex items-center gap-1 text-sm bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-200"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 bg-white">
        <div className="p-4 text-center hover:bg-gray-50 transition-colors">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1 tracking-wider">Total Visits</p>
          <p className="text-2xl font-bold text-dark">{metrics.totalVisits}</p>
        </div>
        <div className="p-4 text-center hover:bg-gray-50 transition-colors">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1 tracking-wider">Total Events</p>
          <p className="text-2xl font-bold text-dark">{metrics.totalEvents}</p>
        </div>
        <div className="p-4 text-center col-span-2 md:col-span-2 flex flex-col justify-center hover:bg-gray-50 transition-colors">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1 tracking-wider">Last Service Visit</p>
          <p className="text-sm font-bold text-dark">
            {metrics.lastService ? new Date(metrics.lastService).toLocaleDateString('en-AU', {
              day: 'numeric', month: 'long', year: 'numeric'
            }) : 'No completed services'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-100 overflow-x-auto scrollbar-hide bg-gray-50/30">
        <div className="flex gap-2 min-w-max">
          {['All', 'Services', 'Invoices', 'Quotes', 'Bookings'].map(type => (
            <button
              key={type}
              onClick={() => handleFilterClick(type)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                typeFilter === type 
                  ? 'bg-dark text-white shadow-md' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Content */}
      <div className="p-6 bg-[#fcfcfc]">
        {loading && events.length === 0 ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin shadow-md"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500 bg-red-50 rounded-lg shadow-sm border border-red-100">
            {error}
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <History size={32} className="text-gray-300" />
            </div>
            <p className="font-bold text-dark text-lg">No history found</p>
            <p className="text-sm mt-1">There are no {typeFilter !== 'All' ? typeFilter.toLowerCase() : 'historical events'} for this {entityType}.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedYears.map(year => (
              <div key={year} className="relative">
                {/* Year Badge */}
                <div className="sticky top-0 z-10 bg-[#fcfcfc]/90 backdrop-blur-sm py-2 mb-4">
                  <span className="inline-block px-3 py-1 bg-white shadow-sm text-gray-800 text-sm font-bold rounded-lg border border-gray-200 uppercase tracking-widest">
                    {year}
                  </span>
                </div>

                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                  {groupedByYear[year].map((event, idx) => (
                    <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active hover:scale-[1.01] transition-transform duration-300 ease-out">
                      
                      {/* Icon */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#fcfcfc] ${getEventColor(event.type)} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-md relative z-10 transition-transform group-hover:scale-110`}>
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content Card */}
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border border-gray-100 bg-white shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_25px_-5px_rgba(6,81,237,0.1)] transition-all relative overflow-hidden group-hover:border-primary/20">
                        {/* Status accent line */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${
                            event.status === 'Completed' || event.status === 'Paid' ? 'bg-green-500' : 
                            event.status === 'Cancelled' || event.status === 'Stuck' ? 'bg-red-500' : 'bg-gray-300'
                        }`} />

                        {/* Header: Date & Status */}
                        <div className="flex justify-between items-start mb-4 border-b border-gray-50 pb-3 pl-2">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-primary uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded text-center w-fit mb-1">{event.type}</span>
                            <span className="text-sm font-medium text-dark flex items-center gap-1.5"><Calendar size={14} className="text-gray-400"/> {formatDate(event.date)}</span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                            event.status === 'Completed' || event.status === 'Paid' ? 'bg-green-100 text-green-800 border border-green-200' : 
                            event.status === 'Cancelled' || event.status === 'Stuck' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}>
                            {event.status}
                          </span>
                        </div>

                        {/* Event Title */}
                        <h3 className="font-bold text-dark text-base mb-2 pl-2 line-clamp-2">{event.title}</h3>

                        {/* Context (Customer in Vehicle view, Vehicle in Customer view) */}
                        {isCustomer && event.vehicle && (
                          <div className="flex items-center gap-3 mb-4 bg-gray-50/80 border border-gray-100 p-2.5 rounded-xl ml-2">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-200 shrink-0">
                                <CarIcon className="text-gray-600" size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-dark truncate">{event.vehicle.brand} {event.vehicle.model}</p>
                              <p className="text-[10px] font-mono font-bold text-primary bg-white px-1.5 py-0.5 rounded border border-red-100 w-fit mt-0.5">{event.vehicle.registrationNumber}</p>
                            </div>
                          </div>
                        )}

                        {!isCustomer && event.customer && (
                          <div className="flex items-center gap-3 mb-4 bg-gray-50/80 border border-gray-100 p-2.5 rounded-xl ml-2">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-200 shrink-0">
                                <UserIcon className="text-gray-600" size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-dark truncate">{event.customer.name}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5 font-medium">{event.customer.customerType?.replace('_', ' ')}</p>
                            </div>
                          </div>
                        )}

                        {/* Related Items (Job Card, Invoice) */}
                        <div className="space-y-2 mt-4 pl-2">
                          {event.jobCard && (
                            <div className="flex justify-between items-center text-sm border border-gray-200 bg-white rounded-lg p-2.5 hover:border-primary/40 hover:bg-red-50/30 transition-all shadow-sm group/link cursor-pointer">
                              <span className="text-gray-700 font-bold flex items-center gap-2"><Wrench size={14} className="text-gray-400"/> Job Card</span>
                              <div className="flex items-center gap-3">
                                {!isMechanic && event.jobCard.totalAmount !== undefined && (
                                  <span className="font-mono text-dark font-bold">${event.jobCard.totalAmount.toFixed(2)}</span>
                                )}
                                <Link to={`/admin/job-cards/${event.jobCard.id}/edit`} className="text-white bg-primary hover:bg-red-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors opacity-0 group-hover/link:opacity-100">
                                  OPEN <ExternalLink size={10} />
                                </Link>
                              </div>
                            </div>
                          )}

                          {event.invoices && event.invoices.map((inv, idx) => (
                            <div key={inv.id || idx} className="flex justify-between items-center text-sm border border-gray-200 bg-white rounded-lg p-2.5 hover:border-primary/40 hover:bg-red-50/30 transition-all shadow-sm group/link cursor-pointer">
                              <span className="text-gray-700 font-bold flex items-center gap-2">
                                <FileText size={14} className="text-gray-400"/> Invoice 
                                <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-500 border border-gray-200">{inv.invoiceNo}</span>
                              </span>
                              <div className="flex items-center gap-3">
                                {!isMechanic && inv.totalAmount !== undefined && (
                                  <span className="font-mono text-dark font-bold">${inv.totalAmount.toFixed(2)}</span>
                                )}
                                {!isMechanic && (
                                  <Link to={`/admin/invoices?search=${inv.invoiceNo}`} className="text-white bg-primary hover:bg-red-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors opacity-0 group-hover/link:opacity-100">
                                    VIEW <ExternalLink size={10} />
                                  </Link>
                                )}
                              </div>
                            </div>
                          ))}

                          {event.invoice && (
                            <div className="flex justify-between items-center text-sm border border-gray-200 bg-white rounded-lg p-2.5 hover:border-primary/40 hover:bg-red-50/30 transition-all shadow-sm group/link cursor-pointer">
                              <span className="text-gray-700 font-bold flex items-center gap-2">
                                <FileText size={14} className="text-gray-400"/> Invoice 
                                <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-500 border border-gray-200">{event.invoice.invoiceNo}</span>
                              </span>
                              <div className="flex items-center gap-3">
                                {!isMechanic && event.invoice.totalAmount !== undefined && (
                                  <span className="font-mono text-dark font-bold">${event.invoice.totalAmount.toFixed(2)}</span>
                                )}
                                {!isMechanic && (
                                  <Link to={`/admin/invoices?search=${event.invoice.invoiceNo}`} className="text-white bg-primary hover:bg-red-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm transition-colors opacity-0 group-hover/link:opacity-100">
                                    VIEW <ExternalLink size={10} />
                                  </Link>
                                )}
                              </div>
                            </div>
                          )}

                          {event.booking && (
                             <div className="flex justify-between items-center text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                               <span className="flex items-center gap-1.5 font-medium"><Calendar size={14}/> Booking Initialized</span>
                               <CheckCircle size={14} className="text-green-500" />
                             </div>
                          )}
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {pagination.page < pagination.pages && (
          <div className="mt-10 text-center">
            <button 
              onClick={loadMore} 
              disabled={loading}
              className="px-6 py-2.5 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-sm text-dark font-bold rounded-xl transition-all text-sm flex items-center gap-2 mx-auto"
            >
              {loading ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                  <RefreshCw size={16} className="text-gray-400" />
              )}
              {loading ? 'Loading...' : 'Load Older History'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper icons
const CarIcon = ({ className, size }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </svg>
);

const UserIcon = ({ className, size }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default UnifiedHistoryTimeline;
