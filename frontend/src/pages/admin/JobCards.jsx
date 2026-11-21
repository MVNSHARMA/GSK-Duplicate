import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wrench, Plus, CheckCircle, Search, Trash2, Edit2, FileText, Download, X, ChevronLeft, ChevronRight, Loader, ClipboardList, Clock
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportCsv';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import { JOB_CARD_STATUSES } from '../../utils/statusConstants';
import { hasActionPermission } from '../../utils/pageAccess';
import { useToast } from '../../components/ui/ToastContext';
import { TableSkeleton } from '../../components/ui/Skeleton';
import JobCardHistoryModal from '../../components/admin/JobCardHistoryModal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import JobCardRow from '../../components/admin/JobCardRow';

const JobCards = () => {
  const { user } = useAuth();
  const { startTour } = useTour();
  const toast = useToast();
  const isMechanic = user?.role === 'mechanic' || user?.role === 'user';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin';
  const canCreate = hasActionPermission(user, 'jobCards.create');
  const canEdit = hasActionPermission(user, 'jobCards.edit');
  const canDelete = hasActionPermission(user, 'jobCards.delete');
  const [jobCards, setJobCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState({});
  
  const [metrics, setMetrics] = useState({
    openCount: 0,
    completedCount: 0,
    totalRevenue: 0
  });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [jobCardType, setJobCardType] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;
  const [deletingCard, setDeletingCard] = useState({});
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryCardId, setSelectedHistoryCardId] = useState(null);
  
  const abortControllerRef = useRef(null);

  const STATUS_OPTIONS = ['All', ...JOB_CARD_STATUSES];
  const PRIMARY_STATUSES = ['All', ...JOB_CARD_STATUSES.filter(s => ['Open', 'In Progress', 'Waiting For Parts', 'Completed'].includes(s))];
  const VALID_STATUSES = JOB_CARD_STATUSES;

  useEffect(() => {
    const handler = setTimeout(() => {
      if (debouncedSearch !== search) {
        setDebouncedSearch(search);
        setPage(1); // Reset page on search change
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [search, debouncedSearch]);

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1); // Reset page on filter change
  };

  const handleClearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const handleTypeChange = (e) => {
    setJobCardType(e.target.value);
    setPage(1);
  };

  const handleUpdateStatus = async (id, newStatus, currentStatus) => {
    if (newStatus === currentStatus) return;
    
    if (newStatus === 'Completed') {
      if (!window.confirm("Are you sure you want to set it to completed, this will reflect a change in inventory. Parts/quantities will be deducted.")) {
        return;
      }
    }

    // Optimistic UI updates could be tricky if it fails, so we show loading
    setUpdatingStatus(prev => ({ ...prev, [id]: true }));
    
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update local state with the authoritative returned value
        setJobCards(prev => prev.map(jc => jc._id === id ? {
          ...jc,
          status: data.data.status,
          financialsFinalized: data.data.financialsFinalized
        } : jc));
        if (newStatus === 'Completed') {
          toast.success(
            isMechanic
              ? 'Job Card marked as Completed. Administrators have been notified to finalize pricing.'
              : 'Job Card marked as Completed. Please review and finalize the final amount before invoicing.'
          );
        }
      } else {
        toast.error(data.error || 'Failed to update status');
        // Restore from authoritative pull if needed, but since we didn't optimistically update, we just let it be.
      }
    } catch (error) {
      console.error('Error updating Job Card status:', error);
      toast.error('An error occurred while updating the status.');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [id]: false }));
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const signal = abortController.signal;

      const token = localStorage.getItem('gsk_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const queryParams = new URLSearchParams({
        page,
        limit
      });
      if (debouncedSearch) queryParams.append('search', debouncedSearch);
      if (statusFilter && statusFilter !== 'All') queryParams.append('status', statusFilter);
      if (jobCardType && jobCardType !== 'All') queryParams.append('jobCardType', jobCardType);

      const jobsRes = await fetch(`${import.meta.env.VITE_API_URL}/job-cards?${queryParams}`, { headers, signal });
      
      if (abortControllerRef.current !== abortController) return;
      
      const jobsData = await jobsRes.json();
      
      if (jobsData.success) {
        setJobCards(jobsData.data);
        setMetrics(jobsData.metrics || metrics);
        if (jobsData.pagination) {
          setTotalPages(jobsData.pagination.pages);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch data:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [debouncedSearch, statusFilter, jobCardType, page]);

  const deleteCard = async (id) => {
    if (deletingCard[id]) return;
    if (!window.confirm("Are you sure you want to delete this job card?")) return;
    
    setDeletingCard(prev => ({ ...prev, [id]: true }));
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        let errMessage = "Server returned " + response.status;
        if (response.headers.get('content-type')?.includes('application/json')) {
          try {
            const data = await response.json();
            errMessage = data.error || errMessage;
          } catch (e) {}
        }
        alert(`Error deleting job card: ${errMessage}`);
        return;
      }
      
      // Update local state immediately to avoid stale UI while fetching
      setJobCards(prev => {
        const remaining = prev.filter(jc => jc._id !== id);
        if (remaining.length === 0 && page > 1) {
          setPage(page - 1); // This will trigger useEffect which calls fetchData
        } else {
          // Refetch to ensure authoritative metrics and pagination from backend
          fetchData();
        }
        return remaining;
      });
      
    } catch (error) {
      console.error("Failed to delete job card:", error);
      alert(`Network error: ${error.message}`);
    } finally {
      setDeletingCard(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleExportCSV = () => {
    const headers = [
      { label: 'Job Card ID', key: '_id' },
      { label: 'Formal ID', key: 'formalId' },
      { label: 'Status', key: 'status' },
      { label: 'Customer', key: 'customerId' },
      { label: 'Vehicle', key: 'vehicleId' },
      { label: 'Mechanic', key: 'mechanic' },
      ...(isAdmin ? [{ label: 'Total Amount', key: 'totalAmount' }] : []),
      { label: 'Created At', key: 'createdAt' }
    ];
    
    const formattedData = jobCards.map(jc => ({
      _id: jc._id,
      formalId: `JC-${jc._id.slice(-4).toUpperCase()}`,
      status: jc.status,
      customerId: jc.customerId?.name || 'N/A',
      vehicleId: jc.vehicleId 
        ? `${jc.vehicleId.brand} ${jc.vehicleId.model} (${jc.vehicleId.registrationNumber || 'N/A'})` 
        : jc.trackerCarId
          ? `${jc.trackerCarId.make} ${jc.trackerCarId.model} (${jc.trackerCarId.registrationNumber || 'N/A'})`
          : 'N/A',
      mechanic: jc.mechanic || 'N/A',
      ...(isAdmin ? { totalAmount: jc.totalAmount } : {}),
      createdAt: new Date(jc.createdAt).toLocaleDateString()
    }));

    downloadCSV(formattedData, 'JobCards_Export', headers);
  };

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Wrench size={24} className="text-red-500" />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="font-heading text-3xl mb-1">Service Job Cards</h1>
              {user && (user.role === 'admin' || user.role === 'superadmin') && (
                <button
                  onClick={() => startTour('job-cards')}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold bg-dark hover:bg-black text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <ClipboardList size={14} /> Page Tour
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm">Track repairs, services and mechanic notes</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button 
            onClick={handleExportCSV}
            className="w-full sm:w-auto justify-center bg-white border border-gray-200 hover:border-gray-300 text-dark font-bold px-4 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download size={18} /> Export
          </button>
          {canCreate && <Link
            to="/admin/job-cards/new"
            className="w-full sm:w-auto justify-center bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20"
          >
            <Plus size={18} /> New Job Card
          </Link>}
        </div>
      </div>

      {/* Metrics */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-8`}>
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 flex items-center justify-center rounded-lg">
            <FileText size={24} className="text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.openCount}</p>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Open Cards</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500/10 flex items-center justify-center rounded-lg">
            <CheckCircle size={24} className="text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.completedCount}</p>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completed Cards</p>
          </div>
        </div>
        {isAdmin && (
          <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 flex items-center justify-center rounded-lg">
              <span className="text-blue-500 font-bold text-xl">$</span>
            </div>
            <div>
              <p className="text-2xl font-bold font-heading">${(metrics.totalRevenue || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Revenue</p>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div data-tour="job-cards-search" className="bg-white border border-gray-100 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto flex-1">
          <div className="relative w-full md:max-w-[400px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search Rego No, Customer, JC-XXXX or Date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-10 py-2.5 text-sm text-dark focus:border-red-500 outline-none transition-colors"
            />
            {search && (
              <button 
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <select
            value={jobCardType}
            onChange={handleTypeChange}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 font-medium outline-none focus:border-red-500 w-full md:w-auto"
          >
            <option value="All">All Types</option>
            <option value="Regular">Regular</option>
            <option value="Rental">Rental</option>
            <option value="Import">Import</option>
          </select>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {PRIMARY_STATUSES.map(status => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                statusFilter === status 
                  ? 'bg-red-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
          
          {/* If the current selected filter is not in primary, show it so user can clear it easily or see it's active */}
          {!PRIMARY_STATUSES.includes(statusFilter) && (
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors bg-red-500 text-white"
            >
              {statusFilter}
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      {isLoading ? (
        <TableSkeleton rows={10} columns={9} />
      ) : jobCards.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search || statusFilter !== 'All' ? 'No Job Cards match your filters' : 'No Job Cards Found'}
          description="Adjust your search or status filters to find what you're looking for."
          action={search || statusFilter !== 'All' ? () => { setSearch(''); setDebouncedSearch(''); setStatusFilter('All'); setPage(1); } : null}
          actionLabel="Clear Filters"
        />
      ) : (
        <div data-tour="job-cards-list" className="bg-white border border-gray-100 rounded-xl overflow-hidden relative min-h-[300px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Job Card</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Rego No</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle / Fleet</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Mechanic</th>
                  {isAdmin && <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>}
                  {isAdmin && <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Invoice</th>}
                  <th data-tour="job-cards-actions" className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobCards.map(jc => (
                  <JobCardRow 
                    key={jc._id}
                    jc={jc}
                    isAdmin={isAdmin}
                    isMechanic={isMechanic}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    updatingStatus={updatingStatus}
                    handleUpdateStatus={handleUpdateStatus}
                    deletingCard={deletingCard}
                    deleteCard={deleteCard}
                    setSelectedHistoryCardId={setSelectedHistoryCardId}
                    setHistoryModalOpen={setHistoryModalOpen}
                    VALID_STATUSES={VALID_STATUSES}
                  />
                ))}
              </tbody>
            </table>
          </div>
        
        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      <JobCardHistoryModal 
        isOpen={historyModalOpen} 
        onClose={() => setHistoryModalOpen(false)} 
        jobCardId={selectedHistoryCardId} 
      />
    </div>
  );
};

export default JobCards;
