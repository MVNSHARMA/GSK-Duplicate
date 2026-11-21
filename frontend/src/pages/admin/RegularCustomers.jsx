import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Search, Plus, ChevronLeft, ChevronRight, UserCircle, Car, X, FileText, Mail, Phone, Edit2, Trash2, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import { hasActionPermission } from '../../utils/pageAccess';
import { useToast } from '../../components/ui/ToastContext';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';

const RegularCustomers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startTour } = useTour();
  const { showToast } = useToast();
  
  const canCreate = hasActionPermission(user, 'customers.create');
  const canEdit = hasActionPermission(user, 'customers.edit');
  const canDelete = hasActionPermission(user, 'customers.delete');

  const [customers, setCustomers] = useState([]);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Unified Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '', notes: '', idType: '', idNumber: ''
  });
  
  const abortControllerRef = useRef(null);
  const API = import.meta.env.VITE_API_URL;

  const fetchCustomers = useCallback(async (page = 1) => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('page', page);
      params.append('limit', 10);

      setIsPending(true);
      setError(null);
      const response = await fetch(`${API}/customers/regular?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await response.json();
      if (data.success) {
        setCustomers(data.data);
        setPagination(data.pagination);
      } else {
        setError(data.error || 'Failed to fetch regular customers');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to fetch customers:", err);
        setError('Network error while fetching customers');
      }
    } finally {
      setIsPending(false);
    }
  }, [debouncedSearch, API]);

  useEffect(() => {
    fetchCustomers(1);
  }, [fetchCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchCustomers(newPage);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '', notes: '', idType: '', idNumber: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
      idType: customer.idType || '',
      idNumber: customer.idNumber || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const isEdit = !!editingCustomer;
      const url = isEdit 
        ? `${API}/customers/regular/${editingCustomer._id}`
        : `${API}/customers/regular`;
      
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        showToast(isEdit ? 'Customer updated successfully!' : 'Customer created successfully!', 'success');
        setIsModalOpen(false);
        fetchCustomers(pagination.page);
      } else {
        showToast(data.error || `Failed to ${isEdit ? 'update' : 'create'} customer`, 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Are you sure you want to delete ${customer.name}?`)) return;
    setDeletingCustomer(customer._id);
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${API}/customers/regular/${customer._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        showToast('Customer deleted successfully', 'success');
        fetchCustomers(pagination.page);
      } else {
        showToast(data.error || 'Failed to delete customer', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      setDeletingCustomer(null);
    }
  };

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const { page, pages } = pagination;
    if (pages <= 5) return [...Array(pages)].map((_, i) => i + 1);
    const nums = new Set([1, pages, page]);
    if (page > 1) nums.add(page - 1);
    if (page < pages) nums.add(page + 1);
    return [...nums].sort((a, b) => a - b);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in" data-tour="regular-customers">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-dark flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
              <UserCircle className="text-primary" size={24} />
            </div>
            Regular Customers
          </h1>
          <p className="text-gray-500 mt-1 ml-[52px]">Manage walk-in and regular service customers</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary-dark transition-all font-semibold shadow-lg shadow-primary/20 whitespace-nowrap"
          >
            <Plus size={18} /> Add Customer
          </button>
        )}
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: 'min(calc(100vh - 220px), 600px)' }}>
        {/* Search Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          {/* Desktop Table */}
          <div className="hidden md:block min-w-[700px] w-full">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10">
              <div className="col-span-4">Customer</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-1 text-center">Vehicles</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {isPending ? (
              <TableSkeleton rows={8} columns={5} />
            ) : error ? (
              <ErrorState title="Failed to load customers" message={error} onRetry={() => fetchCustomers(1)} />
            ) : customers.length === 0 ? (
              <EmptyState 
                icon={Users} 
                title="No Regular Customers Found" 
                message={searchQuery ? `No matches for "${searchQuery}"` : "No regular customers yet. Click 'Add Customer' to create one."}
              />
            ) : (
              <div className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <div 
                    key={c._id} 
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/admin/customers/${c._id}`)}
                  >
                    <div className="col-span-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold shadow-inner flex-shrink-0">
                          {c.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">{c.name}</p>
                          <p className="text-xs text-gray-400">Since {new Date(c.createdAt).toLocaleDateString('en-AU')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm text-gray-700 truncate">{c.email || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-800">{c.phone || '—'}</p>
                    </div>
                    <div className="col-span-1 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">
                        <Car size={14} className={c.vehicleCount > 0 ? 'text-primary' : 'text-gray-300'} />
                        <span className="text-sm font-bold text-gray-700">{c.vehicleCount ?? 0}</span>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => navigate(`/admin/customers/${c._id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100"
                        title="View Customer"
                      >
                        <FileText size={14} />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(c)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
                          title="Edit Customer"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={deletingCustomer === c._id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-100 disabled:opacity-50"
                          title="Delete Customer"
                        >
                          {deletingCustomer === c._id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden">
            {isPending ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <ErrorState title="Failed to load customers" message={error} onRetry={() => fetchCustomers(1)} />
            ) : customers.length === 0 ? (
              <EmptyState 
                icon={Users} 
                title="No Regular Customers Found" 
                message={searchQuery ? `No matches for "${searchQuery}"` : "No regular customers yet."}
              />
            ) : (
              <div className="p-4 space-y-3">
                {customers.map((c) => (
                  <div 
                    key={c._id} 
                    onClick={() => navigate(`/admin/customers/${c._id}`)}
                    className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold flex-shrink-0">
                          {c.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                          <p className="text-xs text-gray-400">Since {new Date(c.createdAt).toLocaleDateString('en-AU')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0">
                        <Car size={14} className={c.vehicleCount > 0 ? 'text-primary' : 'text-gray-300'} />
                        <span className="text-sm font-bold text-gray-700">{c.vehicleCount ?? 0}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Mail size={12} /> {c.email || '—'}</span>
                      <span className="flex items-center gap-1"><Phone size={12} /> {c.phone || '—'}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 pt-3 border-t border-gray-50" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => navigate(`/admin/customers/${c._id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <FileText size={14} /> View
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(c)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={deletingCustomer === c._id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {deletingCustomer === c._id ? <Loader size={14} className="animate-spin" /> : <><Trash2 size={14} /> Delete</>}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {!isPending && !error && customers.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto shrink-0">
            <p className="text-sm text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-900">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold text-gray-900">{pagination.total}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              {getPageNumbers().map((num, idx, arr) => (
                <span key={num} className="contents">
                  {idx > 0 && num - arr[idx - 1] > 1 && <span className="px-1 text-gray-400">…</span>}
                  <button
                    onClick={() => handlePageChange(num)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                      pagination.page === num 
                        ? 'bg-primary text-white shadow-md shadow-primary/20' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                </span>
              ))}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unified Create/Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingCustomer ? 'Edit Regular Customer' : 'Add Regular Customer'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{editingCustomer ? 'Update details for this customer' : 'Create a new walk-in / regular service customer'}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Full Name *</label>
                <input 
                  type="text" required name="name" value={formData.name} onChange={handleInputChange}
                  placeholder="e.g. John Smith"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-dark focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Phone *</label>
                  <input 
                    type="text" required name="phone" value={formData.phone} onChange={handleInputChange}
                    placeholder="e.g. 0412 345 678"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-dark focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Email</label>
                  <input 
                    type="email" name="email" value={formData.email} onChange={handleInputChange}
                    placeholder="e.g. john@email.com"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-dark focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Address</label>
                <input 
                  type="text" name="address" value={formData.address} onChange={handleInputChange}
                  placeholder="e.g. 123 Main St, Sydney NSW 2000"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-dark focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">ID Type</label>
                  <select 
                    name="idType" value={formData.idType} onChange={handleInputChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-dark focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none transition-all"
                  >
                    <option value="">Select Type</option>
                    <option value="Driver License">Driver License</option>
                    <option value="Passport">Passport</option>
                    <option value="State ID">State ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">ID No.</label>
                  <input 
                    type="text" name="idNumber" value={formData.idNumber} onChange={handleInputChange}
                    placeholder="ID Number"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-dark focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Notes</label>
                <textarea 
                  name="notes" value={formData.notes} onChange={handleInputChange} rows="2"
                  placeholder="Any additional notes..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-dark focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none transition-all"
                ></textarea>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : (editingCustomer ? 'Save Changes' : 'Create Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegularCustomers;
