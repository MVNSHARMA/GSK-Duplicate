import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Car, Edit2, Trash2, User, X, Wrench } from 'lucide-react';
import UnifiedHistoryTimeline from '../../components/admin/UnifiedHistoryTimeline';
import VehicleDocumentation from '../../components/admin/VehicleDocumentation';
import { useAuth } from '../../context/AuthContext';
import { hasActionPermission } from '../../utils/pageAccess';
import ConfirmModal from '../../components/ui/ConfirmModal';

const VehicleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const canEdit = hasActionPermission(user, 'vehicles.edit');
  const canDelete = hasActionPermission(user, 'vehicles.delete');

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyTab, setHistoryTab] = useState('Overview');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const API = import.meta.env.VITE_API_URL;
  const headers = { Authorization: `Bearer ${localStorage.getItem('gsk_token')}` };

  const fetchVehicle = async () => {
    try {
      const res = await fetch(`${API}/vehicles/${id}`, { headers });
      const data = await res.json();
      if (data.success) {
        setVehicle(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch vehicle');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicle();
  }, [id]);

  const handleDeleteVehicle = async () => {
    try {
      const res = await fetch(`${API}/vehicles/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        navigate('/admin/vehicles');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading vehicle details...</div>;
  if (error || !vehicle) return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-red-50 text-red-600 p-6 rounded-xl mb-4">Error: {error || 'Vehicle not found'}</div>
      <button onClick={() => navigate('/admin/vehicles')} className="flex items-center gap-2 text-primary"><ArrowLeft size={16} /> Back to Vehicles</button>
    </div>
  );

  return (
    <div className="max-w-[1000px] mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
      <button onClick={() => navigate('/admin/vehicles')} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 mb-6 text-sm font-medium transition-colors">
        <ArrowLeft size={16} /> Back to Vehicles
      </button>

      <div className="bg-white rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header (Image) */}
        <div className="h-64 relative bg-[#222] flex-shrink-0">
          {vehicle.imageUrl ? (
            <img src={vehicle.imageUrl} alt="Vehicle" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car size={64} className="text-gray-600 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
          
          <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1 drop-shadow-md">{vehicle.year} {vehicle.brand}</p>
              <h2 className="text-3xl font-bold text-white uppercase drop-shadow-md">{vehicle.model}</h2>
            </div>
            {vehicle.status && vehicle.status !== 'Available' && (
              <div className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider shadow-lg
                ${vehicle.status === 'Rented' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'}`}>
                {vehicle.status}
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

        <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
          {historyTab === 'Overview' ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Rego No</p>
                  <p className="font-mono text-dark font-medium">{vehicle.registrationNumber || 'N/A'}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Mileage</p>
                  <p className="font-mono text-dark font-medium">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} KMS` : 'N/A'}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-center">
                  <Link 
                    to={`/admin/job-cards/new?vehicleId=${vehicle._id}&customerId=${typeof vehicle.customerId === 'object' ? vehicle.customerId?._id : (vehicle.customerId || '')}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-colors w-full justify-center"
                  >
                    <Wrench size={14} /> Create Job Card
                  </Link>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Added On</p>
                  <p className="font-mono text-dark font-medium text-sm">{new Date(vehicle.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm mb-6">
                <h3 className="text-sm font-bold text-dark mb-4 flex items-center gap-2">
                  <User size={16} className="text-primary" /> 
                  Ownership Information
                </h3>
                {vehicle.customerId ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Owner Name</p>
                      <p className="font-medium text-dark">{vehicle.customerId.name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                      <p className="font-medium text-dark">{vehicle.customerId.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</p>
                      <p className="font-medium text-dark">{vehicle.customerId.phone || 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500 font-medium">This is a company-owned fleet vehicle.</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8">
                <VehicleDocumentation vehicleId={vehicle._id} />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <UnifiedHistoryTimeline entityId={vehicle._id} entityType="vehicle" />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-4 flex-shrink-0">
          <button 
            onClick={() => setIsDeleteModalOpen(true)} 
            className="w-full sm:w-auto justify-center px-4 py-2.5 text-red-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
          >
            <Trash2 size={16} /> Delete Vehicle
          </button>
        </div>
      </div>
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteVehicle}
        title="Delete Canonical Vehicle?"
        message="Are you sure you want to permanently delete this canonical vehicle? This action cannot be undone."
        confirmText="Delete Vehicle"
      />
    </div>
  );
};

export default VehicleDetail;
