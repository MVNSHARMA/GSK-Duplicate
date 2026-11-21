import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, Car, AlertCircle, Edit2, List, Settings, Plus, Wrench } from 'lucide-react';
import UnifiedHistoryTimeline from '../../components/admin/UnifiedHistoryTimeline';
import { useToast } from '../../components/ui/ToastContext';
import AddVehicleModal from '../../components/admin/AddVehicleModal';

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [rentalEntries, setRentalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const handleSaveVehicle = async (vehicleData) => {
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/vehicles`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData)
      });
      const result = await res.json();
      if (result.success) {
        setVehicles(prev => [...prev, result.data]);
        toast.success('Vehicle added successfully');
        setShowAddVehicle(false);
      } else {
        toast.error(result.error || 'Failed to add vehicle');
      }
    } catch (err) {
      toast.error('Network error while adding vehicle');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('gsk_token');
        
        const [custRes, vehRes, trackRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/customers/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${import.meta.env.VITE_API_URL}/customers/${id}/vehicles`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${import.meta.env.VITE_API_URL}/vehicle-batches?customerId=${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const custData = await custRes.json();
        const vehData = await vehRes.json();
        const trackData = await trackRes.json();

        if (custData.success) {
          setCustomer(custData.data);
        } else {
          setError(custData.error || 'Customer not found');
        }

        if (vehData.success) setVehicles(vehData.data);
        if (trackData.success) setTrackers(trackData.data);

        // For rental_company, also fetch rental entries
        if (custData.success && custData.data?.customerType === 'rental_company') {
          try {
            const rentalRes = await fetch(`${import.meta.env.VITE_API_URL}/rental-entries?customerId=${id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const rentalData = await rentalRes.json();
            if (rentalData.success) setRentalEntries(rentalData.data);
          } catch (e) {
            console.error('Failed to fetch rental entries:', e);
          }
        }

      } catch (err) {
        setError('Network error loading customer details');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto text-dark animate-pulse">
        <div className="h-10 w-48 bg-gray-200 rounded-lg mb-6"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="h-64 bg-gray-200 rounded-xl"></div>
            <div className="h-64 bg-gray-200 rounded-xl"></div>
          </div>
          <div className="lg:col-span-2">
            <div className="h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="max-w-[1200px] mx-auto text-center py-20">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-2xl font-bold font-heading mb-2">Customer Not Found</h2>
        <p className="text-gray-500 mb-6">{error || "The customer you are looking for does not exist."}</p>
        <button onClick={() => navigate('/admin/customers')} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">
          <ArrowLeft size={20} /> Back to Customers
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto text-dark pb-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/admin/customers')}
          className="px-4 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors text-sm font-bold text-gray-600"
        >
          <ArrowLeft size={16} /> Back to Customers
        </button>
        <div>
          <h1 className="font-heading text-3xl font-bold mb-1">Customer Details</h1>
          <p className="text-sm text-gray-500">View information, vehicles, and company history.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Info & Vehicles */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Customer Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-10"></div>
             
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">
                   {customer.name.charAt(0).toUpperCase()}
                 </div>
                 <div>
                   <h2 className="font-bold text-xl">{customer.name}</h2>
                   <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold uppercase tracking-wider">{customer.customerType.replace('_', ' ')}</span>
                 </div>
               </div>
             </div>

             <div className="space-y-4">
               {customer.email && (
                 <div className="flex items-start gap-3">
                   <Mail size={18} className="text-gray-400 mt-0.5" />
                   <div>
                     <p className="text-xs text-gray-500 font-bold uppercase mb-0.5">Email</p>
                     <p className="text-sm">{customer.email}</p>
                   </div>
                 </div>
               )}
               <div className="flex items-start gap-3">
                 <Phone size={18} className="text-gray-400 mt-0.5" />
                 <div>
                   <p className="text-xs text-gray-500 font-bold uppercase mb-0.5">Phone</p>
                   <p className="text-sm">{customer.phone}</p>
                 </div>
               </div>
               {customer.address && (
                 <div className="flex items-start gap-3">
                   <MapPin size={18} className="text-gray-400 mt-0.5" />
                   <div>
                     <p className="text-xs text-gray-500 font-bold uppercase mb-0.5">Address</p>
                     <p className="text-sm">{customer.address}</p>
                   </div>
                 </div>
               )}
             </div>
          </div>

          {/* Vehicles Card */}
          {(customer.customerType === 'regular' || customer.customerType === 'rental_company' || customer.customerType === 'import_company') && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold font-heading flex items-center gap-2">
                            <Car size={18} className="text-blue-500" /> {(customer.customerType === 'rental_company' || customer.customerType === 'import_company') ? 'Registered Vehicles' : 'Associated Vehicles'}
                        </h3>
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{vehicles.length}</span>
                    </div>
                    <button 
                        onClick={() => setShowAddVehicle(true)} 
                        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark px-3 py-1.5 rounded-lg bg-blue-50 transition-colors"
                    >
                        <Plus size={16} /> Add Vehicle
                    </button>
                </div>
                <div className="p-4">
                    {vehicles.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">{(customer.customerType === 'rental_company' || customer.customerType === 'import_company') ? 'No registered vehicles yet.' : 'No vehicles are currently associated with this customer.'}</p>
                    ) : (
                        <div className="space-y-3">
                            {vehicles.map(v => (
                                <div key={v._id} className="border border-gray-100 rounded-lg p-3 hover:border-blue-200 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold font-mono text-blue-600 mb-0.5">{v.registrationNumber}</div>
                                            <div className="text-sm text-dark font-medium">{v.year} {v.brand} {v.model}</div>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-green-100 text-green-700">
                                            {v.status}
                                        </span>
                                    </div>
                                    {v.vin && <div className="text-xs text-gray-500 mb-3">VIN: {v.vin}</div>}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => navigate(`/admin/vehicles?search=${encodeURIComponent(v.registrationNumber)}`)} 
                                            className="flex-1 py-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:text-dark transition-colors"
                                        >
                                            View Vehicle
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/admin/job-cards/new?customerId=${customer._id}&vehicleId=${v._id}`)} 
                                            className="flex-1 py-1.5 text-xs font-bold text-white bg-primary rounded shadow-sm hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Wrench size={12} /> Job Card
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>
          )}


        </div>

        {/* Right Column: Company History / Trackers */}
        <div className="lg:col-span-2 space-y-6">
            {/* Import Trackers - ONLY for import_company */}
            {customer.customerType === 'import_company' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-bold text-lg font-heading flex items-center gap-2">
                        <List size={20} className="text-primary" /> Import Trackers
                    </h2>
                </div>
                <div className="p-5">
                    {trackers.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No trackers found for this company.</p>
                    ) : (
                        <div className="grid gap-3">
                            {trackers.map(t => (
                                <div key={t._id} className="border border-gray-100 rounded-lg p-4 flex justify-between items-center hover:border-primary/30 transition-colors">
                                    <div>
                                        <div className="font-bold text-dark font-mono text-lg">{t.batchNumber}</div>
                                        <div className="text-sm text-gray-500">{t.carCount} Cars • {t.completedCount} Completed</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                                            t.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                            t.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {t.status}
                                        </span>
                                        <button 
                                            onClick={() => navigate(`/admin/import-trackers/${t._id}`)}
                                            className="px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 rounded hover:bg-primary hover:text-white transition-colors"
                                        >
                                            View
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>
            )}

            {/* Rental Service Entries - ONLY for rental_company */}
            {customer.customerType === 'rental_company' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-bold text-lg font-heading flex items-center gap-2">
                        <List size={20} className="text-primary" /> Rental Service Entries
                    </h2>
                    <button onClick={() => navigate('/admin/rentals')} className="px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 rounded hover:bg-primary hover:text-white transition-colors">
                        Manage in Rentals
                    </button>
                </div>
                <div className="p-5">
                    {rentalEntries.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No rental service entries yet.</p>
                    ) : (
                        <div className="grid gap-3">
                            {rentalEntries.map(entry => (
                                <div key={entry._id} className="border border-gray-100 rounded-lg p-4 flex justify-between items-center hover:border-primary/30 transition-colors">
                                    <div>
                                        <div className="font-bold text-dark">{entry.vehicleCount || 0} Car{(entry.vehicleCount || 0) !== 1 ? 's' : ''}</div>
                                        <div className="text-sm text-gray-500">{entry.notes || 'Service Entry'}</div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            {new Date(entry.createdAt).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                                        entry.overallStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                        entry.overallStatus === 'Stuck' ? 'bg-red-100 text-red-800' :
                                        entry.overallStatus === 'In Service' ? 'bg-blue-100 text-blue-800' :
                                        entry.overallStatus === 'Received' ? 'bg-amber-100 text-amber-800' :
                                        'bg-slate-100 text-slate-700'
                                    }`}>
                                        {entry.overallStatus || 'Empty'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full min-h-[600px]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-bold text-lg font-heading flex items-center gap-2">
                        Company History
                    </h2>
                </div>
                <div className="p-5">
                    <UnifiedHistoryTimeline entityId={id} entityType="customer" />
                </div>
            </div>
        </div>

      </div>


      <AddVehicleModal
        isOpen={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
        onSave={handleSaveVehicle}
        customerType={customer?.customerType}
        customerName={customer?.name}
        customerId={id}
      />
    </div>
  );
};

export default CustomerDetail;
