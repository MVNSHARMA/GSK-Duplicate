import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Car, Eye, Trash2, Edit2, X, ChevronDown, CheckSquare, Settings, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

import ConfirmModal from '../../components/ui/ConfirmModal';
import AddVehicleModal from '../../components/admin/AddVehicleModal';
import VehicleStatusHistoryModal from '../../components/admin/VehicleStatusHistoryModal';

const IMPORT_CAR_STATUSES = ['Received', 'In Compliance', 'Stuck', 'Ready', 'Handed Over'];

const statusColor = (s) => {
  switch (s) {
    case 'Received': return 'bg-blue-100 text-blue-700';
    case 'In Compliance': return 'bg-orange-100 text-orange-700';
    case 'Stuck': return 'bg-red-100 text-red-700';
    case 'Ready': return 'bg-purple-100 text-purple-700';
    case 'Handed Over': return 'bg-emerald-100 text-emerald-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const TrackerDetail = () => {
  const { id } = useParams();
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

  const [tracker, setTracker] = useState(null);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Selection
  const [selectedCars, setSelectedCars] = useState([]);

  // Modals
  const [showRegisterNewCar, setShowRegisterNewCar] = useState(false);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [carToDelete, setCarToDelete] = useState(null);
  const [bulkStatusValue, setBulkStatusValue] = useState('Received');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoryVehicle, setSelectedHistoryVehicle] = useState(null);
  const [updatingVehicles, setUpdatingVehicles] = useState([]);

  const fetchTrackerAndCars = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trackerRes, carsRes] = await Promise.all([
        fetch(`${API}/vehicle-batches/${id}`, { headers }),
        fetch(`${API}/vehicle-batches/${id}/vehicles?limit=500`, { headers })
      ]);

      const tData = await trackerRes.json().catch(() => ({ success: false, error: 'Failed to parse response' }));
      const cData = await carsRes.json().catch(() => ({ success: false, error: 'Failed to parse response' }));

      if (!trackerRes.ok || !tData.success) {
        setError(tData.error || (trackerRes.status === 404 ? 'Import Container not found' : 'Failed to load tracker details'));
        setTracker(null);
      } else {
        setTracker(tData.data);
      }

      if (carsRes.ok && cData.success) {
        setCars(cData.data || []);
      } else {
        setCars([]);
      }
    } catch (err) {
      console.error('Error fetching tracker and cars:', err);
      setError('Network error while loading import tracker details');
    } finally {
      setLoading(false);
    }
  }, [id, API]);

  useEffect(() => { 
    if (id) {
      fetchTrackerAndCars(); 
    }
  }, [fetchTrackerAndCars, id]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedCars(filteredCars.map(c => c._id));
    } else {
      setSelectedCars([]);
    }
  };

  const toggleSelectCar = (carId) => {
    setSelectedCars(prev => prev.includes(carId) ? prev.filter(item => item !== carId) : [...prev, carId]);
  };

  const handleAddVehicles = async (vehicleIds) => {
    try {
      const res = await fetch(`${API}/vehicle-batches/${id}/registered-vehicles`, {
        method: 'POST', 
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleIds })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully added ${vehicleIds.length} vehicle(s)`);
        fetchTrackerAndCars();
      } else {
        showToast(data.error || 'Failed to attach vehicle to container', 'error');
      }
    } catch (err) { 
      console.error(err);
      showToast('Network error attaching vehicle', 'error');
    }
  };

  const handleSaveNewVehicle = async (vehicleData) => {
    if (isSubmittingVehicle) return;
    setIsSubmittingVehicle(true);
    try {
      const res = await fetch(`${API}/vehicles`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData)
      });
      const result = await res.json();
      if (result.success) {
        setShowRegisterNewCar(false);
        await handleAddVehicles([result.data._id]);
      } else {
        showToast(result.error || 'Failed to register vehicle', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while registering vehicle', 'error');
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  const handleDeleteCar = async () => {
    if (!carToDelete) return;
    try {
      const res = await fetch(`${API}/vehicle-batches/${id}/vehicles/${carToDelete}`, { method: 'DELETE', headers });
      if (res.ok) { 
        showToast('Car removed from container'); 
        fetchTrackerAndCars(); 
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to remove car', 'error');
      }
    } catch (err) { 
      console.error(err);
      showToast('Error removing car from container', 'error');
    } finally {
      setCarToDelete(null);
    }
  };

  const handleIndividualStatusChange = async (carId, newStatus) => {
    setUpdatingVehicles(prev => [...prev, carId]);
    try {
      const res = await fetch(`${API}/vehicle-batches/${id}/cars/${carId}/status`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Status updated');
        
        if (data.batchStatus) {
            setTracker(prev => (prev ? { ...prev, status: data.batchStatus } : prev));
        }
        
        if (data.data) {
            setCars(prev => prev.map(c => c._id === data.data._id ? data.data : c));
            if (selectedHistoryVehicle && selectedHistoryVehicle._id === data.data._id) {
                setSelectedHistoryVehicle(data.data);
            }
        }
      } else {
        showToast(data.error || 'Failed to update status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error updating status', 'error');
    } finally {
      setUpdatingVehicles(prev => prev.filter(item => item !== carId));
    }
  };

  const handleBulkStatusUpdate = async (e) => {
    e.preventDefault();
    if (selectedCars.length === 0) return;
    setUpdatingVehicles(prev => [...prev, ...selectedCars]);
    try {
      const res = await fetch(`${API}/vehicle-batches/${id}/cars/status`, {
        method: 'PATCH', 
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: bulkStatusValue, carIds: selectedCars })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Updated ${data.updatedCount || selectedCars.length} cars`);
        
        if (data.batchStatus) {
            setTracker(prev => (prev ? { ...prev, status: data.batchStatus } : prev));
        }
        
        if (data.updatedVehicles && data.updatedVehicles.length > 0) {
            const updatedCarsMap = new Map(data.updatedVehicles.map(c => [c._id, c]));
            setCars(prev => prev.map(c => updatedCarsMap.has(c._id) ? updatedCarsMap.get(c._id) : c));
            
            if (selectedHistoryVehicle && updatedCarsMap.has(selectedHistoryVehicle._id)) {
                setSelectedHistoryVehicle(updatedCarsMap.get(selectedHistoryVehicle._id));
            }
        }
        
        setSelectedCars([]);
        setShowBulkStatus(false);
      } else {
        showToast(data.error || 'Failed to bulk update status', 'error');
      }
    } catch (err) { 
      console.error(err); 
      showToast('Network error updating status', 'error');
    } finally {
        setUpdatingVehicles(prev => prev.filter(item => !selectedCars.includes(item)));
    }
  };

  const filteredCars = cars.filter(c => {
    if (statusFilter !== 'All' && c.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const vinMatch = (c.vin || c.vehicleId?.vin || '').toLowerCase().includes(q);
      const regoMatch = (c.registrationNumber || c.vehicleId?.registrationNumber || '').toLowerCase().includes(q);
      const makeMatch = (c.make || c.vehicleId?.brand || '').toLowerCase().includes(q);
      const modelMatch = (c.model || c.vehicleId?.model || '').toLowerCase().includes(q);
      if (!vinMatch && !regoMatch && !makeMatch && !modelMatch) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
        <div className="mb-6">
          <button onClick={() => navigate('/admin/import-trackers')} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Back to Import Trackers
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium text-base">Loading Container Details...</p>
        </div>
      </div>
    );
  }

  if (error || !tracker) {
    return (
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
        <div className="mb-6">
          <button onClick={() => navigate('/admin/import-trackers')} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Back to Import Trackers
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Import Container Not Found</h2>
          <p className="text-slate-500 text-sm mb-6">
            {error || 'The requested import tracker does not exist, has an invalid ID, or has been removed.'}
          </p>
          <div className="flex justify-center gap-3">
            <button 
              onClick={() => fetchTrackerAndCars()} 
              className="px-4 py-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-xl hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Retry
            </button>
            <button 
              onClick={() => navigate('/admin/import-trackers')} 
              className="px-5 py-2 bg-primary text-white font-medium text-sm rounded-xl hover:bg-primary-dark transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Return to Import Trackers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl text-white font-medium shadow-lg transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/admin/import-trackers')} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Import Trackers
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-3xl mb-1 text-slate-800 font-bold">{tracker.customerId?.name || 'Unknown Company'}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold border border-slate-200">
              Ref: {tracker.referenceNumber || tracker.batchNumber}
            </span>
            <span>Created: {new Date(tracker.createdAt).toLocaleDateString('en-AU')}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              tracker.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 
              tracker.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'
            }`}>
              {tracker.status || 'ACTIVE'}
            </span>
            {tracker.expectedVehicleCount > 0 && (
              <span className="text-slate-500 text-xs">
                Expected: {tracker.expectedVehicleCount} vehicles
              </span>
            )}
          </div>
        </div>

        {tracker.customerId?._id && (
          <button 
            onClick={() => navigate(`/admin/customers/${tracker.customerId._id}`)}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors self-start md:self-auto flex items-center gap-2"
          >
            <Eye size={15} /> View Customer Details
          </button>
        )}
      </div>

      {/* Cars In Entry Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Car size={20} className="text-primary" />
          Cars in this Container ({cars.length})
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <input 
            type="text" 
            placeholder="Search VIN, Rego, Make..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm min-w-[200px]"
          />
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm bg-white"
          >
            <option value="All">All Statuses</option>
            {IMPORT_CAR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {canEdit && (
            <button onClick={() => setShowRegisterNewCar(true)} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark shadow-sm whitespace-nowrap flex items-center gap-1.5 transition-colors">
              <span className="text-lg leading-none">+</span> Add Vehicle
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCars.length > 0 && canEdit && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl mb-6 flex items-center justify-between animate-fade-in">
          <span className="text-blue-800 font-medium text-sm">{selectedCars.length} cars selected</span>
          <div className="flex gap-2">
            <button onClick={() => setShowBulkStatus(true)} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Update Status</button>
            <button onClick={() => setSelectedCars([])} className="px-4 py-1.5 bg-white text-blue-600 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Cars List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredCars.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="font-medium text-base">No cars found matching filters.</p>
            {cars.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">Click "+ Add Vehicle" to register and assign a vehicle to this container.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={filteredCars.length > 0 && selectedCars.length === filteredCars.length} 
                      className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer" 
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Vehicle Details</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Identifiers</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCars.map(car => (
                  <tr key={car._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedCars.includes(car._id)} 
                        onChange={() => toggleSelectCar(car._id)} 
                        className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer" 
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-800 text-sm">{(car.vehicleId?.brand || car.make || 'Unknown')} {(car.vehicleId?.model || car.model || '')}</div>
                      <div className="text-xs text-slate-500">{car.vehicleId?.year || car.year || '—'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded inline-block mb-1 border border-slate-200" title="VIN">
                        {(car.vehicleId?.vin || car.vin) || 'NO VIN'}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">Rego: {(car.vehicleId?.registrationNumber || car.registrationNumber) || '-'}</div>
                    </td>
                    <td className="px-4 py-4">
                      {canEdit ? (
                        <select
                          value={car.status}
                          onChange={(e) => handleIndividualStatusChange(car._id, e.target.value)}
                          disabled={updatingVehicles.includes(car._id)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg whitespace-nowrap outline-none cursor-pointer border-r-8 border-transparent ${statusColor(car.status)} ${updatingVehicles.includes(car._id) ? 'opacity-50 pointer-events-none' : ''}`}
                          style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
                          title="Change status"
                        >
                          {IMPORT_CAR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg whitespace-nowrap ${statusColor(car.status)}`}>
                          {car.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedHistoryVehicle(car);
                            setShowHistoryModal(true);
                          }} 
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200" 
                          title="Status History"
                        >
                          <Clock size={16} />
                        </button>
                        <button 
                          onClick={() => navigate(`/admin/vehicles/${car.vehicleId?._id || car.vehicleId}`)} 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" 
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {canEdit && (
                          <button 
                            onClick={() => setCarToDelete(car._id)} 
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 opacity-0 group-hover:opacity-100 focus:opacity-100" 
                            title="Remove Car"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddVehicleModal
        isOpen={showRegisterNewCar}
        onClose={() => setShowRegisterNewCar(false)}
        onSave={handleSaveNewVehicle}
        isSubmitting={isSubmittingVehicle}
        customerType="import_company"
        customerName={tracker?.customerId?.name}
        customerId={tracker?.customerId?._id}
      />

      <VehicleStatusHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        vehicleInfo={selectedHistoryVehicle?.vehicleId || selectedHistoryVehicle}
        statusHistory={selectedHistoryVehicle?.statusHistory}
      />

      {/* Bulk Status Modal */}
      {showBulkStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold">Update {selectedCars.length} Cars</h2>
              <button onClick={() => setShowBulkStatus(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleBulkStatusUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700">New Status</label>
                <select value={bulkStatusValue} onChange={e => setBulkStatusValue(e.target.value)} className="w-full px-4 py-2 border rounded-xl outline-none border-slate-200">
                  {IMPORT_CAR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowBulkStatus(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!carToDelete}
        onClose={() => setCarToDelete(null)}
        onConfirm={handleDeleteCar}
        title="Remove Car from Container?"
        message="Are you sure you want to remove this car from the import container? The canonical vehicle will remain in the system."
        confirmText="Remove Car"
      />
    </div>
  );
};

export default TrackerDetail;
