import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, Search, Filter, Plus, Edit2, Trash2, X, Download,
  Building2, Car, UserCircle, ChevronLeft, ChevronRight, FileText, Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { downloadCSV } from '../../utils/exportCsv';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';
import UnifiedHistoryTimeline from '../../components/admin/UnifiedHistoryTimeline';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import { hasActionPermission } from '../../utils/pageAccess';
import { useToast } from '../../components/ui/ToastContext';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';

const CUSTOMER_TYPE_CONFIG = {
  regular: { label: 'Regular Customer', color: 'bg-gray-100 text-gray-700', icon: UserCircle },
  import_company: { label: 'Import Company', color: 'bg-blue-50 text-blue-700', icon: Building2 },
  rental_company: { label: 'Rental Company', color: 'bg-amber-50 text-amber-700', icon: Car }
};

const CustomerTypeBadge = ({ type }) => {
  const config = CUSTOMER_TYPE_CONFIG[type] || CUSTOMER_TYPE_CONFIG.regular;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.color}`}>
      <config.icon size={12} />
      {config.label}
    </span>
  );
};


const Customers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startTour } = useTour();
  const canCreate = hasActionPermission(user, 'customers.create');
  const canEdit = hasActionPermission(user, 'customers.edit');
  const canDelete = hasActionPermission(user, 'customers.delete');
  const canLinkVehicles = hasActionPermission(user, 'customers.edit');
  const canReassignVehicles = hasActionPermission(user, 'vehicles.reassign');
  const canProvisionPortal = hasActionPermission(user, 'customers.provisionPortal');
  const [customers, setCustomers] = useState([]);
  const [isPending, setIsPending] = useState(true);
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    regularCount: 0,
    importCount: 0,
    rentalCount: 0
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 1 });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [viewCustomer, setViewCustomer] = useState(null);
  
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [portalUsers, setPortalUsers] = useState([]);
  const [historyTab, setHistoryTab] = useState('Overview');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [isLoadingPortalUsers, setIsLoadingPortalUsers] = useState(false);
  const [showLinkVehicleInput, setShowLinkVehicleInput] = useState(false);
  const [reassigningVehicleId, setReassigningVehicleId] = useState(null);
  const [provisionEmail, setProvisionEmail] = useState('');
  const [provisionName, setProvisionName] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const abortControllerRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    customerType: 'regular',
    idType: '',
    idNumber: '',
    notes: '',
    vehicleId: ''
  });

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', address: '', customerType: 'regular', idType: '', idNumber: '', notes: '', vehicleId: '' });
    setEditingCustomer(null);
  };

  const fetchCustomers = useCallback(async (page = 1) => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      if (selectedType) params.append('customerType', selectedType);
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('page', page);
      params.append('limit', 50);

      setIsPending(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/customers?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await response.json();
      if (data.success) {
        setCustomers(data.data);
        setMetrics(data.metrics);
        setPagination(data.pagination);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch customers:", error);
      }
    } finally {
      setIsPending(false);
    }
  }, [selectedType, debouncedSearch]);

  useEffect(() => {
    fetchCustomers(1);
  }, [fetchCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (viewCustomer) {
      const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
          const token = localStorage.getItem('gsk_token');
          const response = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/service-requests`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            setCustomerHistory(data.data);
          }
        } catch (error) {
          console.error("Failed to fetch customer history:", error);
        } finally {
          setIsLoadingHistory(false);
        }
      };
      
      const fetchVehicles = async () => {
        setIsLoadingVehicles(true);
        try {
          const token = localStorage.getItem('gsk_token');
          const response = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/vehicles`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            setCustomerVehicles(data.data);
          }
        } catch (error) {
          console.error("Failed to fetch customer vehicles:", error);
        } finally {
          setIsLoadingVehicles(false);
        }
      };

      const fetchPortalUsers = async () => {
        setIsLoadingPortalUsers(true);
        try {
          const token = localStorage.getItem('gsk_token');
          const response = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/portal-users`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            setPortalUsers(data.data);
          }
        } catch (error) {
          console.error("Failed to fetch portal users:", error);
        } finally {
          setIsLoadingPortalUsers(false);
        }
      };

      fetchHistory();
      fetchVehicles();
      fetchPortalUsers();
    }
  }, [viewCustomer]);

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (customer) => {
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      customerType: customer.customerType || 'regular',
      idType: customer.idType || '',
      idNumber: customer.idNumber || '',
      notes: customer.notes || ''
    });
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('gsk_token');
      const isEdit = !!editingCustomer;
      const url = isEdit 
        ? `${import.meta.env.VITE_API_URL}/customers/${editingCustomer._id}`
        : `${import.meta.env.VITE_API_URL}/customers`;

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setIsModalOpen(false);
        resetForm();
        fetchCustomers();
        if (!isEdit && data.data && data.data._id) {
            navigate(`/admin/customers/${data.data._id}`);
        }
      } else {
        alert(data.error || "An error occurred");
      }
    } catch (error) {
      console.error("Failed to save customer:", error);
    }
  };

  const handleLinkExistingVehicle = async (vehicleId) => {
    if (!vehicleId) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/vehicles/link`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicleId })
      });
      const data = await response.json();
      if (data.success) {
        setShowLinkVehicleInput(false);
        // Refetch vehicles
        setIsLoadingVehicles(true);
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/vehicles`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const d = await res.json();
          if (d.success) setCustomerVehicles(d.data);
        } finally {
          setIsLoadingVehicles(false);
        }
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Failed to link vehicle:", error);
    }
  };

  const handleUnlinkVehicle = async (vehicleId) => {
    if (!window.confirm("Are you sure you want to unlink this vehicle from the customer?")) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/vehicles/unlink`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicleId })
      });
      const data = await response.json();
      if (data.success) {
        // Refetch vehicles
        const fetchVehicles = async () => {
          setIsLoadingVehicles(true);
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/vehicles`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const d = await res.json();
            if (d.success) setCustomerVehicles(d.data);
          } finally {
            setIsLoadingVehicles(false);
          }
        };
        fetchVehicles();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Failed to unlink vehicle:", error);
    }
  };

  const handleReassignVehicle = async (vehicleId, targetCustomer) => {
    if (!targetCustomer) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/customers/${targetCustomer._id}/vehicles/reassign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vehicleId })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to reassign vehicle');
      setReassigningVehicleId(null);
      setCustomerVehicles((current) => current.filter((vehicle) => vehicle._id !== vehicleId));
    } catch (error) {
      alert(error.message || 'Unable to reassign vehicle');
    }
  };

  const deleteCustomer = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      const token = localStorage.getItem('gsk_token');
      await fetch(`${import.meta.env.VITE_API_URL}/customers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchCustomers();
    } catch (error) {
      console.error("Failed to delete customer:", error);
    }
  };

  const handleProvisionUser = async (e) => {
    e.preventDefault();
    setIsProvisioning(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/provision-portal`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: provisionName, email: provisionEmail })
      });
      const data = await response.json();
      if (data.success) {
        setProvisionName('');
        setProvisionEmail('');
        
        // Refetch portal users
        setIsLoadingPortalUsers(true);
        const res = await fetch(`${import.meta.env.VITE_API_URL}/customers/${viewCustomer._id}/portal-users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await res.json();
        if (d.success) setPortalUsers(d.data);
        setIsLoadingPortalUsers(false);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Failed to provision portal user:", error);
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' },
      { label: 'Customer Type', key: 'customerType' },
      { label: 'ID Type', key: 'idType' },
      { label: 'ID Number', key: 'idNumber' },
      { label: 'Address', key: 'address' },
      { label: 'Notes', key: 'notes' },
      { label: 'Created At', key: 'createdAt' }
    ];
    downloadCSV(customers, 'Customers_Export', headers);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchCustomers(newPage);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Users size={24} className="text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="font-heading text-3xl mb-1">Customers</h1>
              {user && (user.role === 'admin' || user.role === 'superadmin') && (
                <button
                  onClick={() => startTour('customers')}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold bg-dark hover:bg-black text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <Users size={14} /> Page Tour
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm">Manage client directory and records</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {canCreate && <button 
            onClick={handleExportCSV}
            className="w-full sm:w-auto justify-center bg-white border border-gray-200 hover:border-gray-300 text-dark font-bold px-4 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download size={18} /> Export
          </button>}
          <button 
            data-tour="customers-add"
            onClick={openCreateModal}
            className="w-full sm:w-auto justify-center bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus size={18} /> New Customer
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-lg">
            <Users size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.totalCustomers}</p>
            <p className="text-xs text-gray-500">Total Customers</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-100 flex items-center justify-center rounded-lg">
            <UserCircle size={20} className="text-gray-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.regularCount}</p>
            <p className="text-xs text-gray-500">Regular</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 flex items-center justify-center rounded-lg">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.importCount}</p>
            <p className="text-xs text-gray-500">Import Companies</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-50 flex items-center justify-center rounded-lg">
            <Car size={20} className="text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.rentalCount}</p>
            <p className="text-xs text-gray-500">Rental Companies</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1" data-tour="customers-search">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search by name, email, or phone..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-sm focus:border-primary outline-none transition-colors text-dark placeholder:text-gray-500"
          />
        </div>
        <div className="w-full md:w-64 relative">
          <select 
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-primary outline-none transition-colors text-dark appearance-none cursor-pointer"
          >
            <option value="">All Customer Types</option>
            <option value="regular">Regular Customers</option>
            <option value="import_company">Import Companies</option>
            <option value="rental_company">Rental Companies</option>
          </select>
          <Filter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Data Table */}
      <div data-tour="customers-table" className="bg-white border border-gray-100 rounded-xl overflow-hidden relative min-h-[300px]">
        {isPending ? (
          <TableSkeleton rows={10} columns={7} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery || selectedType ? 'No customers match your filters' : 'No customers found'}
            description={searchQuery || selectedType ? 'Try adjusting your search or filters.' : 'Add your first customer to get started.'}
            action={searchQuery || selectedType ? () => { setSearchQuery(''); setSelectedType(''); fetchCustomers(1); } : null}
            actionLabel="Clear Filters"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Name</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">ID Type</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">ID No.</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr key={customer._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/customers/${customer._id}`)}>
                    <td className="py-4 px-6 font-medium text-sm text-gray-800">{customer.name}</td>
                    <td className="py-4 px-6 text-sm text-gray-500">{customer.phone}</td>
                    <td className="py-4 px-6 text-sm text-gray-500 hidden md:table-cell">{customer.email || '-'}</td>
                    <td className="py-4 px-6"><CustomerTypeBadge type={customer.customerType} /></td>
                    <td className="py-4 px-6 text-sm text-gray-500 hidden lg:table-cell">{customer.idType || '-'}</td>
                    <td className="py-4 px-6 text-sm text-gray-500 hidden lg:table-cell">{customer.idNumber || '-'}</td>
                    <td className="py-4 px-6 text-right flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/customers/${customer._id}`); }} className="text-gray-500 hover:text-dark transition-colors" title="View Details">
                        <FileText size={16} />
                      </button>
                      {canEdit && <button onClick={() => openEditModal(customer)} className="text-gray-500 hover:text-dark transition-colors" title="Edit">
                        <Edit2 size={16} />
                      </button>}
                      {canDelete && <button onClick={() => deleteCustomer(customer._id)} className="text-gray-500 hover:text-primary transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-gray-700">Page {pagination.page} of {pagination.pages}</span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Customer Details Modal */}
      {viewCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">Customer Details</h2>
              <button onClick={() => { setViewCustomer(null); setPortalUsers([]); }} className="text-gray-500 hover:text-dark transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex border-b border-gray-100 bg-gray-50 mt-4 overflow-x-auto">
              {['Overview', 'Vehicles', 'Service History', 'Portal Access'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHistoryTab(tab)}
                  className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    historyTab === tab 
                      ? 'bg-white text-primary border-b-2 border-primary' 
                      : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {historyTab === 'Overview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-dark">{viewCustomer.name}</h3>
                    <CustomerTypeBadge type={viewCustomer.customerType} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Phone</p>
                      <p className="text-sm text-gray-700">{viewCustomer.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Email</p>
                      <p className="text-sm text-gray-700">{viewCustomer.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Address</p>
                      <p className="text-sm text-gray-700">{viewCustomer.address || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Customer Type</p>
                      <p className="text-sm text-gray-700">{CUSTOMER_TYPE_CONFIG[viewCustomer.customerType]?.label || 'Regular Customer'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">ID Type</p>
                      <p className="text-sm text-gray-700">{viewCustomer.idType || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">ID Number</p>
                      <p className="text-sm text-gray-700">{viewCustomer.idNumber || '-'}</p>
                    </div>
                  </div>
                  {viewCustomer.notes && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Notes</p>
                      <p className="text-sm text-gray-700">{viewCustomer.notes}</p>
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    {canEdit && <button onClick={() => { setViewCustomer(null); openEditModal(viewCustomer); }} className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">
                      Edit Customer
                    </button>}
                  </div>
                </div>
              )}
              
              {historyTab === 'Vehicles' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-dark">Customer Vehicles</h3>
                    <div className="flex gap-2">
                      {canCreate && <button 
                        onClick={() => window.open(`/admin/vehicles?addForCustomer=${viewCustomer._id}`, '_self')}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded hover:bg-primary-dark transition-colors flex items-center gap-1"
                      >
                        <Plus size={14} /> New Vehicle
                      </button>}
                      {canLinkVehicles && (!showLinkVehicleInput ? (
                        <button 
                          onClick={() => setShowLinkVehicleInput(true)}
                          className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
                        >
                          <Plus size={14} /> Link Existing
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-64 relative z-50">
                            <EntityAutocomplete
                              placeholder="Search Rego/Model..."
                              fetchOptions={async (query) => {
                                const token = localStorage.getItem('gsk_token');
                                const res = await fetch(`${import.meta.env.VITE_API_URL}/vehicles?search=${encodeURIComponent(query)}&limit=10`, {
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                const data = await res.json();
                                return data.success ? data.data : [];
                              }}
                              getOptionLabel={(v) => `${v.registrationNumber} - ${v.brand || ''} ${v.model || ''}`}
                              value={null}
                              onSelect={(val) => {
                                if (val) handleLinkExistingVehicle(val._id);
                              }}
                            />
                          </div>
                          <button 
                            onClick={() => setShowLinkVehicleInput(false)}
                            className="px-2 py-1.5 text-gray-400 hover:text-gray-600"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isLoadingVehicles ? (
                    <div className="text-center py-8 text-gray-500 text-sm">Loading vehicles...</div>
                  ) : customerVehicles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">No vehicles found for this customer.</div>
                  ) : (
                    <div className="space-y-3">
                      {customerVehicles.map(vehicle => (
                        <div key={vehicle._id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 flex justify-between items-center hover:bg-white transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                              <Car size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-dark">{vehicle.registrationNumber}</div>
                              <div className="text-xs text-gray-500">{vehicle.brand} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <button
                              onClick={() => window.open(`/admin/vehicles?search=${encodeURIComponent(vehicle.registrationNumber)}`, '_self')}
                              className="text-xs text-primary hover:text-primary-dark font-bold px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-1"
                            >
                              View Vehicle <ChevronRight size={14} />
                            </button>
                            {canReassignVehicles && <button
                              onClick={() => setReassigningVehicleId(reassigningVehicleId === vehicle._id ? null : vehicle._id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-bold border border-blue-200 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              Reassign
                            </button>}
                            {canLinkVehicles && <button
                              onClick={() => handleUnlinkVehicle(vehicle._id)}
                              className="text-xs text-primary hover:text-red-700 font-bold border border-red-200 px-2 py-1 rounded bg-red-50 hover:bg-red-100 transition-colors"
                            >
                              Unlink
                            </button>}
                            {reassigningVehicleId === vehicle._id && canReassignVehicles && (
                              <div className="w-56">
                                <EntityAutocomplete
                                  placeholder="Choose new customer..."
                                  fetchOptions={async (query) => {
                                    const token = localStorage.getItem('gsk_token');
                                    const response = await fetch(`${import.meta.env.VITE_API_URL}/customers?search=${encodeURIComponent(query)}&limit=10`, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    const data = await response.json();
                                    return data.success ? data.data.filter((customer) => customer._id !== viewCustomer._id) : [];
                                  }}
                                  getOptionLabel={(customer) => `${customer.name} (${customer.email || customer.phone})`}
                                  value={null}
                                  onSelect={(customer) => handleReassignVehicle(vehicle._id, customer)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {historyTab === 'Service History' && (
                <div className="space-y-4">
                  <UnifiedHistoryTimeline entityId={viewCustomer._id} entityType="customer" />
                </div>
              )}

              {historyTab === 'Portal Access' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                    <h3 className="font-bold text-dark mb-2">Provision Portal User</h3>
                    <p className="text-sm text-gray-500 mb-4">Create a customer portal account for this customer. They will receive an email to set their password.</p>
                    {canProvisionPortal && <form onSubmit={handleProvisionUser} className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text"
                        placeholder="User Name"
                        required
                        value={provisionName}
                        onChange={(e) => setProvisionName(e.target.value)}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                      />
                      <input 
                        type="email"
                        placeholder="Email Address"
                        required
                        value={provisionEmail}
                        onChange={(e) => setProvisionEmail(e.target.value)}
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary outline-none"
                      />
                      <button 
                        type="submit"
                        disabled={isProvisioning}
                        className="bg-primary hover:bg-primary-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isProvisioning ? 'Provisioning...' : 'Provision'}
                      </button>
                    </form>}
                  </div>

                  <div>
                    <h3 className="font-bold text-dark mb-4">Active Portal Users</h3>
                    {isLoadingPortalUsers ? (
                      <div className="text-center py-4 text-gray-500 text-sm">Loading users...</div>
                    ) : portalUsers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        No portal users provisioned for this customer.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {portalUsers.map(user => (
                          <div key={user._id} className="border border-gray-100 rounded-xl p-4 bg-white flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                                <UserCircle size={20} />
                              </div>
                              <div>
                                <div className="font-bold text-dark">{user.name}</div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-gray-500">
                                Status: <span className={user.status === 'active' ? 'text-green-600' : 'text-primary'}>{user.status}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                Last Login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 ">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-gray-500 hover:text-dark transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Customer's Name *</label>
                <input 
                  type="text" required name="name" value={formData.name} onChange={handleInputChange}
                  className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {/* Customer Type */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-3">Customer Type *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'regular', label: 'Regular Customer', icon: UserCircle, activeColor: 'border-gray-600 bg-gray-50' },
                    { value: 'import_company', label: 'Import Company', icon: Building2, activeColor: 'border-blue-500 bg-blue-50' },
                    { value: 'rental_company', label: 'Rental Company', icon: Car, activeColor: 'border-amber-500 bg-amber-50' }
                  ].map(({ value, label, icon: Icon, activeColor }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, customerType: value })}
                      className={`flex flex-col items-center gap-2 px-3 py-3 rounded-lg border-2 text-xs font-semibold transition-all ${
                        formData.customerType === value 
                          ? `${activeColor} shadow-sm` 
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-center leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Phone *</label>
                  <input 
                    type="text" required name="phone" value={formData.phone} onChange={handleInputChange}
                    className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Email</label>
                  <input 
                    type="email" name="email" value={formData.email} onChange={handleInputChange}
                    className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Address</label>
                <input 
                  type="text" name="address" value={formData.address} onChange={handleInputChange}
                  className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              {!editingCustomer && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Link Existing Vehicle (Optional)</label>
                  <EntityAutocomplete 
                    endpoint="/vehicles"
                    placeholder="Search by Rego No, Brand, or Model..."
                    displayKey="registrationNumber"
                    secondaryKey="brand"
                    onSelect={(vehicle) => setFormData({ ...formData, vehicleId: vehicle ? vehicle._id : '' })}
                    renderItem={(vehicle) => (
                      <div className="flex justify-between items-center w-full">
                        <div>
                          <div className="font-bold">{vehicle.registrationNumber}</div>
                          <div className="text-xs text-gray-500">{vehicle.brand} {vehicle.model}</div>
                        </div>
                        {vehicle.customerId ? (
                          <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">Assigned</span>
                        ) : (
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase">Available</span>
                        )}
                      </div>
                    )}
                  />
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Only available (unassigned) vehicles can be linked.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">ID Type</label>
                  <select 
                    name="idType" value={formData.idType} onChange={handleInputChange}
                    className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none appearance-none"
                  >
                    <option value="">Select Type</option>
                    <option value="Driver License">Driver License</option>
                    <option value="Passport">Passport</option>
                    <option value="State ID">State ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">ID No.</label>
                  <input 
                    type="text" name="idNumber" value={formData.idNumber} onChange={handleInputChange}
                    className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Notes</label>
                <textarea 
                  name="notes" value={formData.notes} onChange={handleInputChange} rows="3"
                  className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none resize-none"
                ></textarea>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">
                  {editingCustomer ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Customers;
