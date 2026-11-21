import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plane, Plus, Trash2, Eye, X, Clock, CheckCircle, Search, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ImportTrackers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = ['admin', 'super_admin'].includes(user?.role);
  const headers = { Authorization: `Bearer ${localStorage.getItem('gsk_token')}` };
  const API = import.meta.env.VITE_API_URL;

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [companies, setCompanies] = useState([]);
  const [selectedPill, setSelectedPill] = useState('all');
  const [loading, setLoading] = useState(true);

  // Global Search
  const [searchRego, setSearchRego] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Date filters
  const [dateRangePreset, setDateRangePreset] = useState('1_month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Imports Timeline
  const [entries, setEntries] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // Modals
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);

  const abortControllerRef = useRef(null);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch(`${API}/customers?customerType=import_company&limit=100`, { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setCompanies(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [API]);

  const buildDateParams = () => {
    let queryFrom = fromDate;
    let queryTo = toDate;
    if (dateRangePreset !== 'custom' && dateRangePreset !== 'all') {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      let start = new Date(now);
      start.setHours(0, 0, 0, 0);
      if (dateRangePreset === '1_week') start.setDate(start.getDate() - 7);
      else if (dateRangePreset === '1_month') start.setMonth(start.getMonth() - 1);
      queryFrom = start.toISOString();
      queryTo = todayEnd.toISOString();
    }
    let p = '';
    if (queryFrom) p += `&fromDate=${queryFrom}`;
    if (queryTo) p += `&toDate=${queryTo}`;
    if (dateRangePreset !== 'all') p += `&dateFilter=${dateRangePreset}`;
    return p;
  };

  const fetchTimelineEntries = useCallback(async (companyId, page = 1) => {
    setIsLoadingTimeline(true);
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      let url = `${API}/vehicle-batches?type=IMPORT&page=${page}&limit=20`;
      if (companyId && companyId !== 'all') url += `&customerId=${companyId}`;
      url += buildDateParams();

      const res = await fetch(url, { headers, signal: abortControllerRef.current.signal });
      const data = await res.json();
      if (data.success) {
        setEntries(data.data);
        setCurrentPage(data.pagination?.page || 1);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (err) { console.error(err); } finally {
      setIsLoadingTimeline(false);
    }
  }, [API, fromDate, toDate, dateRangePreset]);

  const refreshEntries = useCallback(() => {
    fetchTimelineEntries(selectedPill, currentPage);
  }, [fetchTimelineEntries, selectedPill, currentPage]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);
  useEffect(() => { fetchTimelineEntries(selectedPill, currentPage); }, [selectedPill, fetchTimelineEntries, currentPage]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchRego.trim()) { setSearchResults([]); setIsSearching(false); return; }
      setIsSearching(true);
      try {
        const query = searchRego.trim();
        const res = await fetch(`${API}/vehicles?search=${encodeURIComponent(query)}&limit=10&customerType=import_company`, { headers });
        const data = await res.json();
        if (data.success) {
          const q = query.toUpperCase();
          const matches = (data.data || []).filter(v => 
            (v.registrationNumber && v.registrationNumber.toUpperCase().includes(q)) || 
            (v.vin && v.vin.toUpperCase().includes(q))
          );
          setSearchResults(matches);
          setShowSearchDropdown(true);
        }
      } catch (err) { console.error(err); } finally { setIsSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchRego, API]);

  const handleSelectSearchResult = (v) => {
    setShowSearchDropdown(false);
    setSearchRego('');
    const cId = typeof v.customerId === 'object' ? v.customerId._id : v.customerId;
    if (cId) {
      setSelectedPill(cId);
      setTimeout(() => navigate(`/admin/vehicles/${v._id}`), 300);
    } else {
      showToast('Vehicle has no associated company', 'error');
    }
  };

  const handleAddCompany = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch(`${API}/customers`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), customerType: 'import_company' })
      });
      const data = await res.json();
      if (data.success) {
        setCompanies(prev => [...prev, data.data]);
        setSelectedPill(data.data._id);
        setShowAddCompany(false);
        showToast('Import Company created successfully');
      } else showToast(data.error || 'Failed', 'error');
    } catch (err) { console.error(err); showToast('Network error', 'error'); }
  };

  const handleNewEntry = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await fetch(`${API}/vehicle-batches`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedPill, type: 'IMPORT', expectedVehicleCount: parseInt(fd.get('expectedVehicleCount') || 0), notes: fd.get('notes') })
      });
      const data = await res.json();
      if (data.success) {
        refreshEntries();
        setShowNewEntry(false);
        showToast('Import Container created');
      } else showToast(data.error || 'Failed', 'error');
    } catch (err) { console.error(err); showToast('Network error', 'error'); }
  };

  const handleDeleteEntry = async (entryId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this entire import container?')) return;
    try {
      const res = await fetch(`${API}/vehicle-batches/${entryId}`, { method: 'DELETE', headers });
      if (res.ok) { 
        showToast('Entry deleted');
        if (entries.length === 1 && currentPage > 1) {
          setCurrentPage(p => p - 1);
        } else {
          refreshEntries();
        }
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete entry', 'error');
      }
    } catch (err) { 
      console.error(err); 
      showToast('Error deleting entry', 'error');
    }
  };

  const groupedEntries = React.useMemo(() => {
    const groups = {};
    entries.forEach(entry => {
      const d = new Date(entry.createdAt);
      const options = { year: 'numeric', month: 'long', timeZone: 'Australia/Sydney' };
      const monthYear = d.toLocaleDateString('en-AU', options);
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(entry);
    });
    return groups;
  }, [entries]);

  const [expandedMonths, setExpandedMonths] = useState({});
  useEffect(() => {
    const defaultExpanded = {};
    Object.keys(groupedEntries).forEach(m => defaultExpanded[m] = true);
    setExpandedMonths(defaultExpanded);
  }, [groupedEntries]);

  const [companySearch, setCompanySearch] = useState('');
  const selectedCompany = selectedPill !== 'all' ? companies.find(c => c._id === selectedPill) : null;
  const isAll = selectedPill === 'all';
  const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()));

  if (loading) return <div className="p-8 text-center text-slate-500">Loading imports...</div>;

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 min-h-screen overflow-x-hidden">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl text-white font-medium shadow-lg transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header & Global Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Plane size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-0.5">Import Trackers</h1>
            <p className="text-slate-500 text-sm">Manage incoming import containers and vehicles</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-slate-400" /></div>
            <input type="text" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Filter Companies..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-2 outline-none font-medium text-sm" />
          </div>
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-slate-400" /></div>
            <input type="text" value={searchRego} onChange={(e) => setSearchRego(e.target.value.toUpperCase())}
              onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              placeholder="Search Rego or VIN..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-2 outline-none font-medium text-sm" />
            {isSearching && <div className="absolute inset-y-0 right-0 pr-3 flex items-center"><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>}
            {showSearchDropdown && searchRego.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-48 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">No matching imports found</div>
                ) : (
                  searchResults.map(v => (
                    <div key={v._id} onClick={() => handleSelectSearchResult(v)} className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 text-sm">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="font-bold text-slate-800">{v.vin || 'NO VIN'} / {v.registrationNumber || 'NO REGO'}</span>
                      </div>
                      <div className="text-xs text-slate-500">{v.brand} {v.model} ({v.year})</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {canEdit && (
            <button onClick={() => setShowAddCompany(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary-dark font-medium shadow-sm whitespace-nowrap text-sm">
              <Plus size={16} /> Add Import Company
            </button>
          )}
        </div>
      </div>

      {/* Company Pills */}
      <div className="mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setSelectedPill('all')} className={`flex-shrink-0 px-4 py-2 rounded-full font-medium text-sm transition-all border ${isAll ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>All Companies</button>
          {filteredCompanies.map(c => (
            <button key={c._id} onClick={() => setSelectedPill(c._id)} className={`flex-shrink-0 px-4 py-2 rounded-full font-medium text-sm transition-all border ${selectedPill === c._id ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>{c.name}</button>
          ))}
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium"><Calendar size={16} className="text-primary" /><span>Date Range:</span></div>
        <select value={dateRangePreset} onChange={(e) => { setDateRangePreset(e.target.value); if(e.target.value !== 'custom') { setFromDate(''); setToDate(''); } }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:border-primary outline-none bg-slate-50 font-medium">
          <option value="today">Today</option>
          <option value="1_week">Last 7 Days</option>
          <option value="1_month">Last 30 Days</option>
          <option value="all">All Time</option>
          <option value="custom">Custom Range...</option>
        </select>
        {dateRangePreset === 'custom' && (
          <div className="flex items-center gap-2 animate-fade-in">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm outline-none" />
            <span className="text-slate-400 font-medium text-sm">to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm outline-none" />
          </div>
        )}
      </div>

      {/* Company Info (when selected) */}
      {!isAll && selectedCompany && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6 animate-fade-in">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">{selectedCompany.name}</h2>
              <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-sm text-slate-600">
                <p>Email: <span className="font-medium">{selectedCompany.email || 'N/A'}</span></p>
                <p>Phone: <span className="font-medium">{selectedCompany.phone || 'N/A'}</span></p>
              </div>
            </div>
            <button onClick={() => navigate(`/admin/customers/${selectedCompany._id}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"><Eye size={14} /> View Customer</button>
          </div>
        </div>
      )}

      {/* Imports Timeline */}
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-slate-800">Operational Timeline</h3>
          {canEdit && !isAll && selectedPill && (
            <button onClick={() => setShowNewEntry(true)} className="flex items-center gap-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 px-4 py-2 rounded-lg shadow-sm transition-colors">
              <Plus size={14} /> New Container / Entry
            </button>
          )}
        </div>
        
        {isLoadingTimeline ? (
          <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Loading timeline...</div>
        ) : entries.length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center"><p className="text-slate-500 font-medium">No import entries found.</p></div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedEntries).map(([monthYear, monthEntries]) => (
              <div key={monthYear} className="relative">
                <button 
                  onClick={() => setExpandedMonths(p => ({...p, [monthYear]: !p[monthYear]}))}
                  className="w-full flex items-center justify-between mb-4 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-0.5 w-8 bg-slate-200"></div>
                    <h4 className="text-lg font-bold text-slate-800 uppercase tracking-widest">{monthYear}</h4>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{monthEntries.length} Entries</span>
                  </div>
                  <span className="text-slate-400 text-sm group-hover:text-primary transition-colors">{expandedMonths[monthYear] ? 'Collapse' : 'Expand'}</span>
                </button>
                
                {expandedMonths[monthYear] && (
                  <div className="relative pl-8 sm:pl-10 space-y-5 before:content-[''] before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {monthEntries.map(entry => {
                      const entryDate = new Date(entry.createdAt);
                      const isCompleted = entry.status === 'COMPLETED' || entry.status === 'CANCELLED';
                      return (
                        <div key={entry._id} className="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-primary/30 transition-all hover:shadow-md cursor-pointer" onClick={() => navigate(`/admin/import-trackers/${entry._id}`)}>
                          {/* Timeline dot */}
                          <div className={`absolute -left-8 sm:-left-10 top-5 w-3 h-3 rounded-full border-2 ${isCompleted ? 'bg-emerald-500 border-emerald-200' : 'bg-blue-500 border-blue-200'} z-10`}></div>
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-5 gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-slate-500 tracking-wider">
                                <span>{entryDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</span>
                                <span>•</span>
                                <span>{entryDate.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</span>
                              </div>
                              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                                <span className="font-bold text-slate-800">{entry.customerId?.name || 'Unknown'}</span>
                                <span className="font-mono text-xs text-primary font-bold bg-primary/5 px-2 py-0.5 rounded border border-primary/10">{entry.batchNumber}</span>
                                {entry.referenceNumber && <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Ref: {entry.referenceNumber}</span>}
                              </div>
                              
                              <div className="flex items-center gap-3 mt-3 flex-wrap">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                                  entry.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                                  entry.status === 'EXPECTED' ? 'bg-slate-100 text-slate-700' :
                                  entry.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                                  entry.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {entry.status}
                                </span>
                                
                                <div className="h-4 w-px bg-slate-200"></div>
                                
                                <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{entry.actualVehicleCount || 0} Total Vehicles</span>
                                {entry.handedOverCount > 0 && <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">{entry.handedOverCount} Handed Over</span>}
                                {entry.complianceCount > 0 && <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">{entry.complianceCount} In Compliance</span>}
                                {entry.stuckCount > 0 && <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">{entry.stuckCount} Stuck</span>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-5">
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/import-trackers/${entry._id}`); }} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-primary text-sm font-medium transition-colors flex items-center justify-center gap-1.5"><Eye size={14} /> Open</button>
                              {canEdit && <button onClick={(e) => handleDeleteEntry(entry._id, e)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all">Previous</button>
            <span className="text-sm font-medium text-slate-500 bg-slate-50 px-4 py-1.5 rounded-full">Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-all">Next</button>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}

      {/* Add Company Modal */}
      {showAddCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold">Add Import Company</h2>
              <button onClick={() => setShowAddCompany(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleAddCompany} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1">Company Name *</label><input required name="name" type="text" className="w-full px-4 py-2.5 rounded-xl border outline-none" /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label><input name="email" type="email" className="w-full px-4 py-2.5 rounded-xl border outline-none" /></div>
              <div><label className="block text-sm font-medium mb-1">Phone *</label><input required name="phone" type="text" className="w-full px-4 py-2.5 rounded-xl border outline-none" /></div>
              <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowAddCompany(false)} className="px-4 py-2 text-slate-600">Cancel</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* New Container Modal */}
      {showNewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold">New Import Container</h2>
              <button onClick={() => setShowNewEntry(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleNewEntry} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1">Expected Vehicle Count</label><input type="number" name="expectedVehicleCount" className="w-full px-4 py-2 border rounded-xl" /></div>
              <div><label className="block text-sm font-medium mb-1">Notes</label><textarea name="notes" className="w-full px-4 py-2 border rounded-xl h-24"></textarea></div>
              <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={() => setShowNewEntry(false)} className="px-4 py-2 text-slate-600">Cancel</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl">Create</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportTrackers;
