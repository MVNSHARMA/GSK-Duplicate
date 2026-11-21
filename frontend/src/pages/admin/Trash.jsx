import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, RotateCcw, AlertTriangle, Search, Filter, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastContext';
import { useAuth } from '../../context/AuthContext';

const Trash = () => {
  const toast = useToast();
  const [trashItems, setTrashItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [filters, setFilters] = useState({ search: '', type: 'All' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAllActive, setSelectAllActive] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null });

  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const abortControllerRef = useRef(null);

  const fetchTrash = React.useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const token = localStorage.getItem('gsk_token');
      const query = new URLSearchParams({
        page,
        limit: pagination.limit,
        search: filters.search,
        type: filters.type
      }).toString();

      const response = await fetch(`${import.meta.env.VITE_API_URL}/trash?${query}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await response.json();
      if (data.success) {
        setTrashItems(data.data);
        if (data.pagination) setPagination(data.pagination);
      } else {
        setError(data.error);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch trash:", error);
        setError("Unable to load Trash.");
      }
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, filters.search, filters.type]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTrash(1);
    }, 300); // debounce search
    return () => clearTimeout(timer);
  }, [filters.search, filters.type, fetchTrash]);

  const allCurrentPageSelected = trashItems.length > 0 && trashItems.every(item => selectedItems.has(`${item.type}:${item._id}`));
  const isIndeterminate = selectedItems.size > 0 && !allCurrentPageSelected;

  const toggleMasterCheckbox = () => {
    if (selectAllActive) {
      setSelectAllActive(false);
      setSelectedItems(new Set());
    } else if (allCurrentPageSelected) {
      setSelectedItems(new Set());
    } else {
      const newSet = new Set(selectedItems);
      trashItems.forEach(item => newSet.add(`${item.type}:${item._id}`));
      setSelectedItems(newSet);
    }
  };

  const toggleItemCheckbox = (type, id) => {
    if (selectAllActive) {
      setSelectAllActive(false);
    }
    const key = `${type}:${id}`;
    const newSet = new Set(selectedItems);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedItems(newSet);
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.pages) {
      fetchTrash(newPage);
    }
  };

  const handleRestore = async (type, id) => {
    if (!window.confirm(`Are you sure you want to restore this ${type}?`)) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/trash/${type}/${id}/restore`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        fetchTrash(pagination.page);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Failed to restore item:", error);
      toast.error("Failed to restore item.");
    }
  };

  const handleDeletePermanently = async () => {
    if (!deleteModal.item) return;
    const { type, _id } = deleteModal.item;
    
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/trash/${type}/${_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setDeleteModal({ isOpen: false, item: null });
        fetchTrash(pagination.page);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Failed to permanently delete item:", error);
      toast.error("Failed to permanently delete item.");
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleting) return;
    setBulkDeleting(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const payload = {
        selectAll: selectAllActive,
        filters: { search: filters.search, type: filters.type },
        items: Array.from(selectedItems).map(key => {
          const [type, id] = key.split(':');
          return { type, id };
        })
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/trash/bulk-delete`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        setBulkDeleteModal(false);
        setSelectedItems(new Set());
        setSelectAllActive(false);
        
        let msg = `${data.data.deleted} items permanently deleted.`;
        if (data.data.skipped > 0) {
            msg += `\n${data.data.skipped} items were skipped due to dependencies or errors.`;
        }
        toast.error(msg);
        fetchTrash(pagination.page);
      } else {
        toast.error(data.error || "Failed to bulk delete");
      }
    } catch (error) {
      console.error("Failed to bulk delete:", error);
      toast.error("Failed to perform bulk delete.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const totalSelectedCount = selectAllActive ? pagination.total : selectedItems.size;

  return (
    <div className="max-w-[1400px] mx-auto text-dark p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">Recycle Bin</h1>
            <p className="text-gray-500 text-sm">Manage deleted records</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full">
          {totalSelectedCount > 0 && isSuperAdmin && (
            <div className="flex items-center justify-between gap-3 md:pr-4 md:border-r border-gray-200 w-full md:w-auto">
              <span className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg whitespace-nowrap">
                {totalSelectedCount} selected
              </span>
              <button 
                onClick={() => setBulkDeleteModal(true)}
                className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 flex-1 md:flex-none whitespace-nowrap"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )}
          <div className="relative flex-1 w-full md:w-64">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search deleted records..." 
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setSelectedItems(new Set());
                setSelectAllActive(false);
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-red-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
            <Filter size={18} className="text-gray-400" />
            <select 
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value });
                setSelectedItems(new Set());
                setSelectAllActive(false);
              }}
              className="bg-transparent text-sm w-full outline-none font-bold text-dark cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="Customer">Customers</option>
              <option value="Vehicle">Vehicles</option>
              <option value="JobCard">Job Cards</option>
              <option value="Invoice">Invoices</option>
              <option value="Sale">Sales</option>
              <option value="Rental">Rentals</option>
              <option value="DealerCar">Import Trackers</option>
              <option value="Contact">Contacts/Messages</option>
              <option value="Quote">Quotes</option>
              <option value="Booking">Bookings</option>
              <option value="PurchaseOrder">Purchase Orders</option>
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 text-red-500 p-6 rounded-xl border border-red-100 flex flex-col items-center justify-center">
            <AlertTriangle size={32} className="mb-2" />
            <p className="font-bold">{error}</p>
            <button onClick={() => fetchTrash(pagination.page)} className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-sm font-bold transition-colors">Retry</button>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {isSuperAdmin && allCurrentPageSelected && pagination.total > trashItems.length && !selectAllActive && (
            <div className="bg-blue-50 border-b border-blue-100 py-3 px-6 flex justify-center items-center text-sm">
              <span className="text-gray-700">All <strong>{trashItems.length}</strong> items on this page are selected.</span>
              <button 
                onClick={() => setSelectAllActive(true)}
                className="ml-2 text-blue-600 font-bold hover:underline"
              >
                Select all {pagination.total} matching items
              </button>
            </div>
          )}
          {isSuperAdmin && selectAllActive && (
            <div className="bg-blue-50 border-b border-blue-100 py-3 px-6 flex justify-center items-center text-sm">
              <span className="text-blue-800 font-bold">All <strong>{pagination.total}</strong> matching items are selected.</span>
              <button 
                onClick={() => {
                  setSelectAllActive(false);
                  setSelectedItems(new Set());
                }}
                className="ml-2 text-blue-600 hover:underline"
              >
                Clear selection
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {isSuperAdmin && (
                    <th className="py-4 px-6 w-12">
                      <input 
                        type="checkbox"
                        checked={selectAllActive || allCurrentPageSelected}
                        ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                        onChange={toggleMasterCheckbox}
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        disabled={trashItems.length === 0}
                      />
                    </th>
                  )}
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Identifier / Label</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Deleted Date</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? "5" : "4"} className="py-12 text-center text-gray-500 text-sm">
                      <div className="animate-pulse flex justify-center">Loading Trash...</div>
                    </td>
                  </tr>
                ) : trashItems.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? "5" : "4"} className="py-12 text-center text-gray-500 text-sm flex flex-col items-center">
                      <Trash2 size={32} className="text-gray-300 mb-2" />
                      Trash is empty.<br />No deleted records are currently available.
                    </td>
                  </tr>
                ) : (
                  trashItems.map(item => {
                    const isSelected = selectAllActive || selectedItems.has(`${item.type}:${item._id}`);
                    return (
                    <tr key={`${item.type}-${item._id}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-red-50/50' : ''}`}>
                      {isSuperAdmin && (
                        <td className="py-4 px-6">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItemCheckbox(item.type, item._id)}
                            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-4 px-6 text-sm text-gray-500 font-bold">{item.type}</td>
                      <td className="py-4 px-6 text-sm text-dark font-bold">{item.label}</td>
                      <td className="py-4 px-6 text-sm text-gray-500">{new Date(item.deletedAt).toLocaleString()}</td>
                      <td className="py-4 px-6 text-right flex items-center justify-end gap-3">
                        <button 
                          onClick={() => handleRestore(item.type, item._id)}
                          className="text-xs font-bold text-green-600 hover:bg-green-50 bg-white border border-gray-200 px-3 py-1.5 rounded transition-colors flex items-center gap-2 uppercase tracking-wider shadow-sm"
                        >
                          <RotateCcw size={14} /> Restore
                        </button>
                        
                        {isSuperAdmin && (
                          <button 
                            onClick={() => setDeleteModal({ isOpen: true, item })}
                            className="text-xs font-bold text-red-600 hover:bg-red-50 bg-white border border-gray-200 px-3 py-1.5 rounded transition-colors flex items-center gap-2 uppercase tracking-wider shadow-sm"
                          >
                            <AlertTriangle size={14} /> Delete Forever
                          </button>
                        )}
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">
                Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} deleted records
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-sm font-bold text-dark px-2">
                  Page {pagination.page} of {pagination.pages}
                </div>
                <button 
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl scale-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-500/5">
              <h3 className="font-heading text-xl text-red-600 flex items-center gap-2">
                <AlertTriangle size={24} /> Permanently Delete
              </h3>
              <button 
                onClick={() => setDeleteModal({ isOpen: false, item: null })}
                className="text-gray-400 hover:text-dark transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-dark mb-4 text-sm font-medium">
                Are you sure you want to permanently delete this <span className="font-bold text-red-600">{deleteModal.item?.type}</span>? 
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4 text-sm font-mono text-gray-700">
                {deleteModal.item?.label}
              </div>
              <p className="text-red-500 text-sm font-bold uppercase tracking-wider mb-6">
                This action cannot be undone. Historical records dependent on this may prevent deletion.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setDeleteModal({ isOpen: false, item: null })}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition-colors uppercase tracking-wider text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeletePermanently}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex justify-center items-center gap-2 uppercase tracking-wider text-sm"
                 aria-label="Delete">
<Trash2 size={18} /> Permanently Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl scale-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-500/5">
              <h3 className="font-heading text-xl text-red-600 flex items-center gap-2">
                <AlertTriangle size={24} /> Delete Selected
              </h3>
              <button 
                onClick={() => setBulkDeleteModal(false)}
                disabled={bulkDeleting}
                className="text-gray-400 hover:text-dark transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-dark mb-4 text-sm font-medium">
                You are about to permanently delete <strong>{totalSelectedCount}</strong> {totalSelectedCount === 1 ? 'item' : 'items'}.
              </p>
              <p className="text-red-500 text-sm font-bold uppercase tracking-wider mb-6">
                This action cannot be undone. Historical records dependent on any of these items may cause those specific items to be skipped.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => setBulkDeleteModal(false)}
                  disabled={bulkDeleting}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition-colors uppercase tracking-wider text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex justify-center items-center gap-2 uppercase tracking-wider text-sm disabled:opacity-50"
                >
                  {bulkDeleting ? 'Deleting...' : `Delete ${totalSelectedCount}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trash;
