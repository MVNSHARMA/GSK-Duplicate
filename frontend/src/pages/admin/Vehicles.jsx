import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  Car, Search, Filter, Plus, Edit2, Info, X, Clock, CheckCircle, Trash2, Calendar, FileText, User, Wrench, FileSignature
} from 'lucide-react';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';
import UnifiedHistoryTimeline from '../../components/admin/UnifiedHistoryTimeline';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import { hasActionPermission } from '../../utils/pageAccess';
import { useToast } from '../../components/ui/ToastContext';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ConfirmModal from '../../components/ui/ConfirmModal';

const Vehicles = () => {
  const { user } = useAuth();
  const { startTour } = useTour();
  const toast = useToast();
  const navigate = useNavigate();
  const canCreate = hasActionPermission(user, 'vehicles.create');
  const canEdit = hasActionPermission(user, 'vehicles.edit');
  const canDelete = hasActionPermission(user, 'vehicles.delete');
  const [vehicles, setVehicles] = useState([]);
  const [isPending, setIsPending] = useState(true);
  const [metrics, setMetrics] = useState({
    totalVehicles: 0
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerType, setSelectedCustomerType] = useState('All Types');
  
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: '',
    registrationNumber: '',
    vin: '',
    mileage: '',
    dailyRate: '',
    customerLink: '',
    imageFile: null,
    imagePreview: null,
    existingImageUrl: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);
  
  // Details Modal State
  const [viewDetailsVehicle, setViewDetailsVehicle] = useState(null);
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const [historyTab, setHistoryTab] = useState('Overview');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Wizard State
  const [serviceRequests, setServiceRequests] = useState([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchVehicles = useCallback(async (signal) => {
    try {
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams({ page, limit: 50 });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedCustomerType !== 'All Types') {
        const typeMap = { 'REGULAR': 'regular', 'RENTAL': 'rental_company', 'IMPORT': 'import_company' };
        params.set('customerType', typeMap[selectedCustomerType] || selectedCustomerType.toLowerCase());
      }
      setIsPending(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/vehicles?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      const data = await response.json();
      if (!response.ok && response.status === 409) {
          toast.error(data.error || 'Conflict error.');
          return;
      }
      if (data.success) {
        setVehicles(data.data);
        setMetrics(data.metrics);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || data.data.length);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch vehicles:", error);
      }
    } finally {
      setIsPending(false);
    }
  }, [page, debouncedSearch, selectedCustomerType, toast]);

  const location = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    fetchVehicles(controller.signal);
    return () => controller.abort();
  }, [fetchVehicles]);

  useEffect(() => {
    // Check for query parameters for automatic linking or creation
    const searchParams = new URLSearchParams(location.search);
    const addForCustomer = searchParams.get('addForCustomer');
    const searchVal = searchParams.get('search');
    
    if (addForCustomer) {
      setFormData(prev => ({ ...prev, customerLink: addForCustomer }));
      setIsModalOpen(true);
    }
    if (searchVal) {
      setSearchQuery(searchVal);
    }
  }, [location.search]);

  useEffect(() => {
    if (viewDetailsVehicle) {
      const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
          const token = localStorage.getItem('gsk_token');
          const response = await fetch(`${import.meta.env.VITE_API_URL}/vehicles/${viewDetailsVehicle._id}/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          if (data.success) {
            setVehicleHistory(data.data);
          }
        } catch (error) {
          console.error("Failed to fetch vehicle history:", error);
        } finally {
          setIsLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [viewDetailsVehicle]);

  const fetchServiceRequests = async (customerId) => {
    setIsLoadingRequests(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/customers/${customerId}/service-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok && response.status === 409) {
          toast.error(data.error || 'Conflict error.');
          return;
      }
      if (data.success) {
        setServiceRequests(data.data);
      } else {
        setServiceRequests([]);
      }
    } catch (error) {
      console.error("Failed to fetch service requests:", error);
      setServiceRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      setFormData({
        ...formData,
        imageFile: file,
        imagePreview: URL.createObjectURL(file),
        existingImageUrl: ''
      });
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('gsk_token');
      
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'imageFile' && formData[key]) {
          submitData.append('image', formData[key]);
        } else if (key === 'existingImageUrl') {
          if (!formData.imageFile) {
            submitData.append('imageUrl', formData[key]);
          }
        } else if (key === 'customerLink') {
          if (formData[key]) submitData.append('customerId', formData[key]);
        } else if (key !== 'imagePreview' && key !== 'imageFile' && key !== 'existingImageUrl' && key !== 'customerObject') {
          submitData.append(key, formData[key]);
        }
      });
      
      // Explicitly append customerId if selected from wizard
      if (selectedCustomerId && !editingId) {
          submitData.append('customerId', selectedCustomerId);
      }

      const url = editingId ? `${import.meta.env.VITE_API_URL}/vehicles/${editingId}` : `${import.meta.env.VITE_API_URL}/vehicles`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      });
      const data = await response.json();
      if (!response.ok && response.status === 409) {
          toast.error(data.error || 'Conflict error.');
          return;
      }
      if (data.success) {
        setIsModalOpen(false);
        setIsEditModalOpen(false);
        setEditingId(null);
        
        // If we were editing from the details view, update the details view data
        if (viewDetailsVehicle && editingId === viewDetailsVehicle._id) {
           setViewDetailsVehicle(data.data);
        }

            setFormData({ brand: '', model: '', year: '', registrationNumber: '', vin: '', mileage: '', dailyRate: '', status: 'Available', customerLink: '', imageFile: null, imagePreview: null, existingImageUrl: '' });
        fetchVehicles();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Failed to save vehicle:", error);
    }
  };

  const openEditModal = (vehicle) => {
    setFormData({
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      year: vehicle.year || '',
      registrationNumber: vehicle.registrationNumber || '',
      vin: vehicle.vin || '',
      mileage: vehicle.mileage || '',
      dailyRate: vehicle.dailyRate || '',
      status: vehicle.status || 'Available',
      customerLink: vehicle.customerId ? vehicle.customerId._id : '',
      customerObject: vehicle.customerId || null,
      imageFile: null,
      imagePreview: vehicle.imageUrl || null,
      existingImageUrl: vehicle.imageUrl || ''
    });
    setEditingId(vehicle._id);
    setWizardStep(3); // Skip straight to the form
    setIsEditModalOpen(true);
  };

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/vehicles/${vehicleToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok && response.status === 409) {
          toast.error(data.error || 'Conflict error.');
          return;
      }
      if (data.success) {
        if (viewDetailsVehicle && viewDetailsVehicle._id === vehicleToDelete) {
          setViewDetailsVehicle(null);
        }
        fetchVehicles();
      } else {
        toast.error(data.error || "Failed to remove vehicle");
      }
    } catch (error) {
      console.error("Failed to delete vehicle:", error);
    } finally {
      setVehicleToDelete(null);
    }
  };

  const filteredVehicles = vehicles;

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Car size={24} className="text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="font-heading text-3xl mb-1">Vehicle Management</h1>
              {user && (user.role === 'admin' || user.role === 'superadmin') && (
                <button
                  onClick={() => startTour('vehicles')}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold bg-dark hover:bg-black text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <Car size={14} /> Page Tour
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm">Manage inventory and rental vehicles</p>
          </div>
        </div>
        {canCreate && <button 
          data-tour="vehicles-add"
          onClick={() => {
            setFormData({ brand: '', model: '', year: '', registrationNumber: '', mileage: '', dailyRate: '', status: 'Available', customerLink: '', imageFile: null, imagePreview: null, existingImageUrl: '' });
            setEditingId(null);
            setWizardStep(1);
            setSelectedCustomerId('');
            setServiceRequests([]);
            setIsModalOpen(true);
          }}
          className="bg-primary hover:bg-primary-dark text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> Add Vehicle
        </button>}
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-100 p-4 rounded-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded-lg">
            <Car size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.totalVehicles}</p>
            <p className="text-xs text-gray-500">Total Vehicles</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div data-tour="vehicles-search" className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search Rego, Brand, Model, or Customer Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-sm focus:border-primary outline-none transition-colors text-dark placeholder:text-gray-500"
          />
        </div>
        <div className="w-full md:w-48 relative">
          <select 
            value={selectedCustomerType}
            onChange={(e) => setSelectedCustomerType(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-primary outline-none transition-colors text-dark appearance-none cursor-pointer"
          >
            {['All Types', 'REGULAR', 'IMPORT', 'RENTAL'].map(cat => {
              let label = cat;
              if (cat === 'REGULAR') label = 'Regular';
              if (cat === 'IMPORT') label = 'Import';
              if (cat === 'RENTAL') label = 'Rental';
              return <option key={cat} value={cat}>{label}</option>
            })}
          </select>
          <Filter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mb-8 text-sm text-gray-500">
          <span>Page {page} of {totalPages} ({totalCount} vehicles)</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Vehicle Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredVehicles.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Car}
              title={searchQuery || selectedCustomerType !== 'All Types' ? 'No vehicles match your filters' : 'No vehicles found'}
              description={searchQuery || selectedCustomerType !== 'All Types' ? 'Try adjusting your search or filters.' : 'Add a new vehicle to see it here.'}
            />
          </div>
        ) : (
          filteredVehicles.map(vehicle => (
            <div key={vehicle._id} className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors flex flex-col group relative">
              
              {/* Delete Button (X) */}
              {canDelete && <button 
                onClick={() => setVehicleToDelete(vehicle._id)}
                className="absolute top-2 left-2 z-10 w-8 h-8 bg-black/40 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors shadow-sm backdrop-blur-sm"
                title="Remove Vehicle"
              >
                <X size={16} />
              </button>}

              {/* Image Placeholder (or actual image) */}
              <div className="h-48 bg-[#222] relative overflow-hidden flex items-center justify-center">
                {vehicle.imageUrl ? (
                  <img src={vehicle.imageUrl} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <Car size={48} className="text-gray-600 opacity-50" />
                )}
                {vehicle.status && vehicle.status !== 'Available' && (
                  <div className={`absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider
                    ${vehicle.status === 'Rented' ? 'bg-blue-500 text-dark' : 'bg-red-500 text-dark'}`}>
                    {vehicle.status}
                  </div>
                )}
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">{vehicle.year} {vehicle.brand}</p>
                    <h3 className="text-lg font-bold text-dark leading-tight uppercase">{vehicle.model}</h3>
                  </div>
                  {vehicle.dailyRate && (
                    <div className="text-right">
                      <p className="text-primary font-bold">${vehicle.dailyRate}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs text-gray-500 mb-2 border-t border-gray-100 pt-4">
                  <div className="flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Rego No</span>
                    <span className="font-medium text-dark">{vehicle.registrationNumber || 'Not Assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#222] flex items-center justify-center text-white">
                      <Clock size={12} />
                    </div>
                    <span>{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} KMS` : '-'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4 border-t border-gray-100 pt-3 text-xs">
                    <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                        <User size={14} className="text-gray-400 shrink-0" />
                        {vehicle.customerId ? (
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-dark font-bold truncate">{vehicle.customerId.name || 'Assigned'}</span>
                                {vehicle.customerId.email && <span className="text-gray-500 truncate">{vehicle.customerId.email}</span>}
                            </div>
                        ) : (
                            <span className="text-gray-400 italic">Unassigned</span>
                        )}
                    </div>
                    {vehicle.customerId && (
                        <button 
                            onClick={() => window.open(`/admin/customers/${vehicle.customerId._id}`, '_blank')}
                            className="shrink-0 px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold rounded flex items-center gap-1 transition-colors"
                        >
                            <User size={12} /> View
                        </button>
                    )}
                </div>

                <div className="mt-auto grid grid-cols-2 gap-3 pt-2">
                  {canEdit && <button onClick={() => openEditModal(vehicle)} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-dark text-sm font-medium transition-colors shadow-sm">
                    <Edit2 size={14} /> Edit
                  </button>}
                  <button onClick={() => setViewDetailsVehicle(vehicle)} className="flex items-center justify-center gap-2 py-2 rounded-lg bg-dark text-white hover:bg-black text-sm font-medium transition-colors shadow-sm">
                    <Info size={14} /> Details
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      {(isModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Vehicle' : 'Add New Vehicle'}</h2>
              <button onClick={() => { setIsModalOpen(false); setIsEditModalOpen(false); }} className="text-gray-500 hover:text-dark transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 custom-scrollbar">
              {wizardStep === 1 && !editingId && (
                <div className="animate-fade-in-up">
                  <h3 className="text-lg font-bold mb-4">Step 1: Select Customer</h3>
                  <div className="mb-6">
                    <EntityAutocomplete
                      label=""
                      placeholder="Search customers by name, email..."
                      fetchOptions={async (query) => {
                        const token = localStorage.getItem('gsk_token');
                        const res = await fetch(`${import.meta.env.VITE_API_URL}/customers?search=${encodeURIComponent(query)}&limit=10`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const data = await res.json();
                        return data.success ? data.data : [];
                      }}
                      getOptionLabel={(c) => `${c.name} (${c.email || c.phone})`}
                      getOptionValue={(c) => c._id}
                      onSelect={(c) => {
                        if (c) {
                          setSelectedCustomerId(c._id);
                          fetchServiceRequests(c._id);
                          setWizardStep(2);
                        } else {
                          setSelectedCustomerId(null);
                        }
                      }}
                    />
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button onClick={() => setWizardStep(3)} className="w-full py-3 bg-gray-100 text-dark hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">
                      Skip / Enter Details Manually
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 2 && !editingId && (
                <div className="animate-fade-in-up">
                  <h3 className="text-lg font-bold mb-1">Step 2: Select Service Request</h3>
                  <p className="text-sm text-gray-500 mb-4">Select a recent request to auto-fill vehicle details.</p>
                  
                  {isLoadingRequests ? (
                    <div className="py-8 text-center text-gray-500"><Clock className="animate-spin mx-auto mb-2" size={24} /> Loading requests...</div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                      {serviceRequests.length === 0 ? (
                        <div className="py-6 text-center text-gray-500">
                          <FileText size={32} className="mx-auto mb-2 opacity-50" />
                          <p>No recent service requests found.</p>
                        </div>
                      ) : (
                        serviceRequests.map(req => (
                          <div 
                            key={req._id}
                            onClick={() => {
                              // Duplicate check logic
                              const isDuplicate = vehicles.some(v => 
                                v.customerId?._id === selectedCustomerId && 
                                v.registrationNumber?.toLowerCase() === req.vehicleInfo?.regNo?.toLowerCase()
                              );
                              if (isDuplicate) {
                                toast.error("This vehicle already exists for this customer! Redirecting you to the existing vehicle.");
                                setIsModalOpen(false);
                                return;
                              }

                              setFormData({
                                ...formData,
                                brand: req.vehicleInfo?.make || req.vehicleInfo?.brand || '',
                                model: req.vehicleInfo?.model || '',
                                year: req.vehicleInfo?.year || '',
                                registrationNumber: req.vehicleInfo?.regNo || '',
                                mileage: req.vehicleInfo?.kilometers || '',
                                existingImageUrl: req.images && req.images.length > 0 ? req.images[0].url : '',
                                imagePreview: req.images && req.images.length > 0 ? req.images[0].url : null
                              });
                              setWizardStep(3);
                            }}
                            className="p-3 border border-gray-200 rounded-lg hover:border-primary cursor-pointer transition-colors bg-white relative overflow-hidden"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${req.requestType === 'booking' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {req.requestType}
                              </span>
                              <span className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="font-bold text-dark">{req.vehicleInfo?.make} {req.vehicleInfo?.model}</p>
                            <p className="text-xs text-gray-500 font-mono">Reg: {req.vehicleInfo?.regNo || 'N/A'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <button onClick={() => setWizardStep(1)} className="flex-1 py-3 bg-gray-100 text-dark hover:bg-gray-200 rounded-lg text-sm font-bold transition-colors">
                      Back
                    </button>
                    <button onClick={() => setWizardStep(3)} className="flex-1 py-3 bg-primary text-white hover:bg-primary-dark rounded-lg text-sm font-bold transition-colors">
                      Enter Manually
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="animate-fade-in-up">
                  <form id="vehicleForm" onSubmit={handleAddVehicle}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Brand (Make)*</label>
                        <input 
                          type="text" required name="brand" value={formData.brand} onChange={handleInputChange}
                          placeholder="e.g. KIA"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:border-primary outline-none uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Model*</label>
                        <input 
                          type="text" required name="model" value={formData.model} onChange={handleInputChange}
                          placeholder="e.g. SELTOS"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:border-primary outline-none uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Year*</label>
                        <input 
                          type="number" required min="1900" max="2100" name="year" value={formData.year} onChange={handleInputChange}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Rego No</label>
                        <input 
                          type="text" name="registrationNumber" value={formData.registrationNumber} onChange={handleInputChange}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:border-primary outline-none uppercase"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-2">VIN</label>
                      <input type="text" name="vin" value={formData.vin} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:border-primary outline-none uppercase" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Mileage (KMS)</label>
                        <input 
                          type="number" name="mileage" value={formData.mileage} onChange={handleInputChange}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:border-primary outline-none"
                        />
                      </div>
                    </div>

                    {(!selectedCustomerId || editingId) && (
                      <div className="mb-4">
                        <EntityAutocomplete
                            label="Link Customer"
                            placeholder="Search customer by name, email..."
                            value={formData.customerObject ? { _id: formData.customerLink, ...formData.customerObject } : (formData.customerLink ? { _id: formData.customerLink, name: "Selected Customer" } : null)}
                            fetchOptions={async (query) => {
                                const token = localStorage.getItem('gsk_token');
                                const res = await fetch(`${import.meta.env.VITE_API_URL}/customers?search=${encodeURIComponent(query)}&limit=10`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                const data = await res.json();
                                return data.success ? data.data : [];
                            }}
                            getOptionLabel={(c) => c.name === "Selected Customer" ? c.name : `${c.name} (${c.email || c.phone})`}
                            getOptionValue={(c) => c._id}
                            onSelect={(c) => {
                                setFormData({ ...formData, customerLink: c ? c._id : '', customerObject: c });
                            }}
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Leave blank if this is a company-owned vehicle.</p>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Vehicle Image</label>
                      {formData.imagePreview && (
                        <div className="mb-3 relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img src={formData.imagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setFormData({...formData, imageFile: null, imagePreview: null, existingImageUrl: ''})} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      {!formData.imagePreview && (
                        <input 
                          type="file" accept="image/*" onChange={handleImageChange}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:border-primary outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-6 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              {wizardStep === 3 && !editingId ? (
                <button type="button" onClick={() => setWizardStep(2)} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                  Back
                </button>
              ) : (
                <div className="w-[88px]"></div> /* Placeholder for alignment */
              )}
              
              <div className="flex gap-3">
                <button type="button" onClick={() => { setIsModalOpen(false); setIsEditModalOpen(false); }} className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                {wizardStep === 3 && (
                  <button form="vehicleForm" type="submit" className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">
                    {editingId ? 'Save Changes' : 'Add Vehicle'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewDetailsVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
            
            {/* Details Header (Image + Close) */}
            <div className="h-64 relative bg-[#222] flex-shrink-0">
              {viewDetailsVehicle.imageUrl ? (
                <img src={viewDetailsVehicle.imageUrl} alt="Vehicle" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Car size={64} className="text-gray-600 opacity-50" />
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
              
              {canDelete && <button 
                onClick={() => setViewDetailsVehicle(null)} 
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
              >
                <X size={20} />
              </button>}
              
              <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1 drop-shadow-md">{viewDetailsVehicle.year} {viewDetailsVehicle.brand}</p>
                  <h2 className="text-3xl font-bold text-white uppercase drop-shadow-md">{viewDetailsVehicle.model}</h2>
                </div>
                {viewDetailsVehicle.status && viewDetailsVehicle.status !== 'Available' && (
                  <div className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider shadow-lg
                    ${viewDetailsVehicle.status === 'Rented' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>
                    {viewDetailsVehicle.status}
                  </div>
                )}
              </div>
            </div>

            <div className="flex border-b border-gray-100 bg-gray-50 flex-shrink-0">
              {['Overview', 'Service History'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHistoryTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    historyTab === tab 
                      ? 'bg-white text-primary border-b-2 border-primary' 
                      : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Details Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar bg-gray-50 flex-1">
              {historyTab === 'Overview' ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Rego No</p>
                      <p className="font-mono text-dark font-medium">{viewDetailsVehicle.registrationNumber || 'N/A'}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Mileage</p>
                      <p className="font-mono text-dark font-medium">{viewDetailsVehicle.mileage ? `${viewDetailsVehicle.mileage.toLocaleString()} KMS` : 'N/A'}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-center">
                      <Link 
                        to={`/admin/job-cards/new?vehicleId=${viewDetailsVehicle._id}&customerId=${typeof viewDetailsVehicle.customerId === 'object' ? viewDetailsVehicle.customerId?._id : (viewDetailsVehicle.customerId || '')}`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors w-full justify-center"
                      >
                        <Wrench size={14} /> Create Job Card
                      </Link>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Added On</p>
                      <p className="font-mono text-dark font-medium text-sm">{new Date(viewDetailsVehicle.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm mb-6">
                    <h3 className="text-sm font-bold text-dark mb-4 flex items-center gap-2">
                      <User size={16} className="text-primary" /> 
                      Ownership Information
                    </h3>
                    {viewDetailsVehicle.customerId ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Owner Name</p>
                          <p className="font-medium text-dark">{viewDetailsVehicle.customerId.name || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                          <p className="font-medium text-dark">{viewDetailsVehicle.customerId.email || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</p>
                          <p className="font-medium text-dark">{viewDetailsVehicle.customerId.phone || 'N/A'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-200">
                        <p className="text-sm text-gray-500 font-medium">This is a company-owned fleet vehicle.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <UnifiedHistoryTimeline entityId={viewDetailsVehicle._id} entityType="vehicle" />
                </div>
              )}
            </div>

            {/* Details Actions */}
            <div className="p-6 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-4 flex-shrink-0">
              {canDelete ? (
                <button 
                  onClick={() => { setVehicleToDelete(viewDetailsVehicle._id); }} 
                  className="w-full sm:w-auto justify-center px-4 py-2.5 text-primary hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={16} /> Delete Vehicle
                </button>
              ) : <div />}
              
              <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                <button onClick={() => setViewDetailsVehicle(null)} className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
                  Close
                </button>
                {canEdit && <button onClick={() => openEditModal(viewDetailsVehicle)} className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 flex items-center gap-2">
                  <Edit2 size={16} /> Edit Details
                </button>}
              </div>
            </div>

          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!vehicleToDelete}
        onClose={() => setVehicleToDelete(null)}
        onConfirm={confirmDeleteVehicle}
        title="Move Vehicle to Trash?"
        message="Are you sure you want to remove this vehicle? It will be moved to the Trash."
        confirmText="Move to Trash"
      />
    </div>
  );
};

export default Vehicles;
