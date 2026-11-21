import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, CheckCircle, Search, X, Trash2
} from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';
import { useToast } from '../../components/ui/ToastContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';

const NEEDS_PRESETS = [
  "Engine Tune up", "Steering Alignment", "Tyre/ Balance", "Cooling System",
  "Brake", "Electrical", "Transmission", "Exhaust", "Body Faults"
];

const NewJobCard = () => {
  const { user } = useAuth();
  const isMechanic = user?.role === 'mechanic' || user?.role === 'user';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin';
  const navigate = useNavigate();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialBookingId = searchParams.get('bookingId') || '';
  const initialVehicleId = searchParams.get('vehicleId') || '';
  const initialRentalEntryId = searchParams.get('rentalEntryId') || '';
  const initialCustomerId = searchParams.get('customerId') || '';
  
  // Support for Rental Workflow
  const { trackerId, trackerCarId, customerId: stateCustomerId } = location.state || {};

  // Form State
  const [formData, setFormData] = useState({
    bookingId: initialBookingId,
    vehicleId: initialVehicleId,
    trackerId: trackerId || '',
    trackerCarId: trackerCarId || '',
    rentalEntryId: initialRentalEntryId,
    
    // Owner Details
    customerObj: null,
    customerId: '', ownerName: '', ownerPhone: '', ownerAddress: '', ownerPostalCode: '', ownerEmail: '', ownerMobile: '',
    
    // Vehicle Details
    vehicleObj: null,
    vehicleMake: '', vehicleModel: '', vehicleEngineNo: '', vehicleSpeedo: '', vehicleMfgDate: '', vehicleChassisNo: '', vehicleRegNo: '',
    
    // Checklists
    needsAttention: [],
    
    // Parts & Services
    partsUsed: [],
    servicesProvided: [],
    
    // Additional
    technicianId: '',
    mechanic: '',
    notes: ''
  });

  const [customNeed, setCustomNeed] = useState('');
  const [searchInventoryText, setSearchInventoryText] = useState('');

  // Service Line Input State
  const [newServiceLine, setNewServiceLine] = useState({ name: '', cost: '', quantity: 1 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('gsk_token');
        if (initialBookingId) {
          const bookingRes = await fetch(`${import.meta.env.VITE_API_URL}/communications/bookings/${initialBookingId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const bookingData = await bookingRes.json();
          if (bookingData.success && bookingData.data) {
            const booking = bookingData.data;
            const customer = booking.customerId;
            const vehicle = booking.vehicleId;
            
            setFormData(prev => ({
              ...prev,
              customerObj: customer || null,
              customerId: customer ? customer._id : '',
              ownerName: customer ? customer.name : (booking.customerInfo?.fullName || `${booking.customerInfo?.firstName || ''} ${booking.customerInfo?.lastName || ''}`.trim()),
              ownerPhone: customer ? customer.phone : (booking.customerInfo?.phone || ''),
              ownerEmail: customer ? customer.email : (booking.customerInfo?.email || ''),
              ownerAddress: customer ? (customer.address || '') : '',
              
              vehicleObj: vehicle || null,
              vehicleId: vehicle ? vehicle._id : (initialVehicleId || ''),
              vehicleMake: vehicle ? vehicle.brand : (booking.vehicleInfo?.make || ''),
              vehicleModel: vehicle ? vehicle.model : (booking.vehicleInfo?.model || ''),
              vehicleRegNo: vehicle ? vehicle.registrationNumber : (booking.vehicleInfo?.regNo || ''),
              vehicleEngineNo: vehicle ? (vehicle.engineNumber || '') : '',
              vehicleChassisNo: vehicle ? (vehicle.vin || '') : '',
              vehicleSpeedo: vehicle ? (vehicle.mileage || '') : (booking.vehicleInfo?.kilometers || ''),
              vehicleMfgDate: vehicle ? (vehicle.year || '') : (booking.vehicleInfo?.year || ''),
              notes: booking.additionalInfo ? `Service Request Notes: ${booking.additionalInfo}` : ''
            }));
          }
        }
        
        if (trackerCarId) {
          const tCarRes = await fetch(`${import.meta.env.VITE_API_URL}/vehicle-batches/cars/${trackerCarId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const tCarData = await tCarRes.json();
          if (tCarData.success && tCarData.data) {
            const tCar = tCarData.data;
            const customer = tCar.batchId?.customerId;
            setFormData(prev => ({
              ...prev,
              customerObj: customer || null,
              customerId: customer ? customer._id : (stateCustomerId || ''),
              ownerName: customer ? customer.name : 'Rental Company',
              ownerPhone: customer ? customer.phone : '',
              ownerEmail: customer ? customer.email : '',
              ownerAddress: customer ? (customer.address || '') : '',
              vehicleId: '',
              vehicleMake: tCar.make || '',
              vehicleModel: tCar.model || '',
              vehicleRegNo: tCar.registrationNumber || '',
              vehicleEngineNo: '',
              vehicleChassisNo: tCar.vin || '',
              vehicleSpeedo: '',
              vehicleMfgDate: tCar.year ? tCar.year.toString() : '',
            }));
          }
        }

        if (initialRentalEntryId && initialCustomerId) {
          const custRes = await fetch(`${import.meta.env.VITE_API_URL}/customers/${initialCustomerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const custData = await custRes.json();
          
          const vehId = searchParams.get('vehicleId');
          let vehicleData = null;
          if (vehId) {
            const vehRes = await fetch(`${import.meta.env.VITE_API_URL}/vehicles/${vehId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            vehicleData = await vehRes.json();
          }

          if (custData.success && custData.data) {
            const customer = custData.data;
            const vehicle = vehicleData?.success ? vehicleData.data : null;
            setFormData(prev => ({
              ...prev,
              customerObj: customer,
              customerId: customer._id,
              ownerName: customer.name || '',
              ownerPhone: customer.phone || '',
              ownerEmail: customer.email || '',
              ownerAddress: customer.address || '',
              ownerPostalCode: customer.postalCode || '',
              ownerMobile: customer.phone || '',
              vehicleObj: vehicle || null,
              vehicleId: vehicle ? vehicle._id : '',
              vehicleMake: vehicle ? vehicle.brand : '',
              vehicleModel: vehicle ? vehicle.model : '',
              vehicleRegNo: vehicle ? vehicle.registrationNumber : '',
              vehicleEngineNo: vehicle ? (vehicle.engineNo || '') : '',
              vehicleChassisNo: vehicle ? (vehicle.vin || '') : '',
              vehicleSpeedo: vehicle ? (vehicle.speedo || '') : '',
              vehicleMfgDate: vehicle ? (vehicle.year ? vehicle.year.toString() : '') : '',
            }));
          }
        }

        // Pre-populate from customerId + vehicleId URL params (e.g. from Rentals page)
        if (!initialBookingId && !trackerCarId && !initialRentalEntryId && initialCustomerId && initialVehicleId) {
          const custRes = await fetch(`${import.meta.env.VITE_API_URL}/customers/${initialCustomerId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const custData = await custRes.json();
          
          const vehRes = await fetch(`${import.meta.env.VITE_API_URL}/vehicles/${initialVehicleId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const vehicleData = await vehRes.json();

          if (custData.success && custData.data) {
            const customer = custData.data;
            const vehicle = vehicleData?.success ? vehicleData.data : null;
            setFormData(prev => ({
              ...prev,
              customerObj: customer,
              customerId: customer._id,
              ownerName: customer.name || '',
              ownerPhone: customer.phone || '',
              ownerEmail: customer.email || '',
              ownerAddress: customer.address || '',
              ownerPostalCode: customer.postalCode || '',
              ownerMobile: customer.phone || '',
              vehicleObj: vehicle || null,
              vehicleId: vehicle ? vehicle._id : '',
              vehicleMake: vehicle ? vehicle.brand : '',
              vehicleModel: vehicle ? vehicle.model : '',
              vehicleRegNo: vehicle ? vehicle.registrationNumber : '',
              vehicleEngineNo: vehicle ? (vehicle.engineNo || '') : '',
              vehicleChassisNo: vehicle ? (vehicle.vin || '') : '',
              vehicleSpeedo: vehicle ? (vehicle.speedo || '') : '',
              vehicleMfgDate: vehicle ? (vehicle.year ? vehicle.year.toString() : '') : '',
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      }
    };
    fetchData();
  }, [initialBookingId, initialVehicleId, trackerCarId, stateCustomerId, initialRentalEntryId, initialCustomerId]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCustomerSelect = (selectedCustomer) => {
    if (initialBookingId) return;

    if (!selectedCustomer) {
      setFormData(prev => ({
        ...prev,
        customerObj: null,
        customerId: '', ownerName: '', ownerPhone: '', ownerAddress: '', ownerPostalCode: '', ownerEmail: '', ownerMobile: '',
        vehicleObj: null,
        vehicleId: '', vehicleMake: '', vehicleModel: '', vehicleMfgDate: '', vehicleEngineNo: '', vehicleChassisNo: '', vehicleSpeedo: '', vehicleRegNo: ''
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      customerObj: selectedCustomer,
      customerId: selectedCustomer._id,
      ownerName: selectedCustomer.name || '',
      ownerPhone: selectedCustomer.phone || '',
      ownerMobile: selectedCustomer.phone || '',
      ownerEmail: selectedCustomer.email || '',
      ownerAddress: selectedCustomer.address || '',
      ownerPostalCode: selectedCustomer.postalCode || '',
      vehicleObj: null,
      vehicleId: '', vehicleMake: '', vehicleModel: '', vehicleMfgDate: '', vehicleEngineNo: '', vehicleChassisNo: '', vehicleSpeedo: '', vehicleRegNo: ''
    }));
  };

  const handleVehicleSelect = (selectedVehicle) => {
    if (initialBookingId || trackerCarId) return;

    if (!selectedVehicle) {
      setFormData(prev => ({
        ...prev,
        vehicleObj: null,
        vehicleId: '', vehicleMake: '', vehicleModel: '', vehicleMfgDate: '', vehicleEngineNo: '', vehicleChassisNo: '', vehicleSpeedo: '', vehicleRegNo: ''
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      vehicleObj: selectedVehicle,
      vehicleId: selectedVehicle._id,
      vehicleMake: selectedVehicle.brand || '',
      vehicleModel: selectedVehicle.model || '',
      vehicleRegNo: selectedVehicle.registrationNumber || '',
      vehicleMfgDate: selectedVehicle.year ? selectedVehicle.year.toString() : '',
      vehicleEngineNo: selectedVehicle.engineNo || '',
      vehicleChassisNo: selectedVehicle.vin || '',
      vehicleSpeedo: selectedVehicle.speedo || ''
    }));
  };

  const toggleCheckbox = (field, value) => {
    setFormData(prev => {
      const arr = prev[field];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter(item => item !== value) };
      }
      return { ...prev, [field]: [...arr, value] };
    });
  };

  // Inventory Table Handlers
  const handleInventorySelect = (item) => {
    if (!item) return;
    
    setFormData(prev => {
      const existingPartIndex = prev.partsUsed.findIndex(p => 
        p.inventoryId === item.inventoryId && p.variantId === item.variantId
      );

      if (existingPartIndex !== -1) {
        toast.info(`${item.displayLabel || item.itemName} is already in the list. Increased quantity.`);
        const updatedParts = [...prev.partsUsed];
        updatedParts[existingPartIndex].quantity += 1;
        return { ...prev, partsUsed: updatedParts };
      }

      return {
        ...prev,
        partsUsed: [...prev.partsUsed, {
          id: Date.now() + Math.random(),
          inventoryId: item.inventoryId,
          variantId: item.variantId,
          itemName: item.itemName,
          variantName: item.variantName,
          quantity: 1,
          ...(isMechanic ? {} : { unitPrice: item.unitPrice || 0 })
        }]
      };
    });
  };

  const updatePart = (id, field, value) => {
    if (isMechanic && field === 'unitPrice') return;
    setFormData(prev => ({
      ...prev,
      partsUsed: prev.partsUsed.map(p => p.id === id ? { ...p, [field]: Number(value) } : p)
    }));
  };

  const removePart = (id) => {
    setFormData(prev => ({
      ...prev,
      partsUsed: prev.partsUsed.filter(p => p.id !== id)
    }));
  };

  // Services Table Handlers
  const addServiceLine = () => {
    if (!newServiceLine.name.trim()) return;
    setFormData(prev => ({
      ...prev,
      servicesProvided: [...prev.servicesProvided, {
        id: Date.now() + Math.random(),
        name: newServiceLine.name,
        ...(isMechanic ? {} : { cost: Number(newServiceLine.cost) || 0 }),
        quantity: Number(newServiceLine.quantity) || 1
      }]
    }));
    setNewServiceLine({ name: '', cost: '', quantity: 1 });
  };

  const updateService = (id, field, value) => {
    if (isMechanic && field === 'cost') return;
    setFormData(prev => ({
      ...prev,
      servicesProvided: prev.servicesProvided.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : Number(value) } : s)
    }));
  };

  const removeService = (id) => {
    setFormData(prev => ({
      ...prev,
      servicesProvided: prev.servicesProvided.filter(s => s.id !== id)
    }));
  };

  const handleAddJobCard = async (e) => {
    e.preventDefault();
    if (!formData.customerId) {
      toast.error('Please select a customer.');
      return;
    }
    if (!formData.vehicleId && !trackerCarId) {
      toast.error('Please select a vehicle.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('gsk_token');
      
      const partsPayload = formData.partsUsed.map(p => ({
        inventoryId: p.inventoryId,
        variantId: p.variantId,
        variantName: p.variantName,
        quantity: p.quantity,
        ...(isMechanic ? {} : { unitPrice: p.unitPrice || 0 })
      }));

      const servicesPayload = formData.servicesProvided.map(s => ({
        name: s.name,
        quantity: s.quantity,
        ...(isMechanic ? {} : { cost: s.cost || 0, total: (s.cost || 0) * s.quantity })
      }));

      const payload = {
        bookingId: formData.bookingId || undefined,
        vehicleId: formData.vehicleId || undefined,
        trackerId: formData.trackerId || undefined,
        trackerCarId: formData.trackerCarId || undefined,
        rentalEntryId: formData.rentalEntryId || undefined,
        customerId: formData.customerId,
        technicianId: formData.technicianId || undefined,
        mechanic: formData.mechanic,
        needsAttention: formData.needsAttention,
        partsUsed: partsPayload,
        servicesProvided: servicesPayload,
        notes: formData.notes
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/job-cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('Job Card created successfully!');
        if (formData.rentalEntryId) {
          navigate(-1);
        } else {
          navigate('/admin/job-cards');
        }
      } else {
        toast.error(data.error || 'Failed to create Job Card');
      }
    } catch (error) {
      console.error(error);
      toast.error('Network error creating Job Card');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations (only computed/displayed for Admin / Super Admin)
  const partsTotal = isMechanic ? 0 : formData.partsUsed.reduce((sum, p) => sum + ((p.quantity || 1) * (p.unitPrice || 0)), 0);
  const servicesTotal = isMechanic ? 0 : formData.servicesProvided.reduce((sum, s) => sum + ((s.quantity || 1) * (s.cost || 0)), 0);
  const subtotal = partsTotal + servicesTotal;
  const gstAmount = subtotal * 0.10; // Assuming 10% GST visually for form feedback
  const grandTotal = subtotal + gstAmount;

  return (
    <div className="max-w-4xl mx-auto text-dark animate-fade-in-up pb-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Wrench size={24} className="text-red-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">New Job Card</h1>
            <p className="text-gray-500 text-sm">Create a new service job card</p>
          </div>
        </div>
        <button onClick={() => navigate('/admin/job-cards')} className="text-gray-500 hover:text-dark transition-colors bg-white border border-gray-200 p-2 rounded-lg">
          <X size={20} />
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8">
          <form id="jobCardForm" onSubmit={handleAddJobCard}>
            
            {/* 1. Customer Selection */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Select Customer</label>
                <EntityAutocomplete
                  placeholder="Search Customer..."
                  fetchOptions={async (q, signal) => {
                    const res = await fetch(`${import.meta.env.VITE_API_URL}/customers?search=${encodeURIComponent(q)}&limit=10`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }, signal });
                    const data = await res.json();
                    return data.success ? data.data : [];
                  }}
                  getOptionLabel={(c) => `${c.name} - ${c.phone}`}
                  value={formData.customerObj}
                  onSelect={handleCustomerSelect}
                  disabled={!!initialBookingId || !!trackerCarId}
                />
            </div>

            {/* 2. Vehicle Selection */}
            <div className="mb-10">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Select Vehicle</label>
                <EntityAutocomplete
                  placeholder={formData.customerId ? "Search Vehicle..." : "Select Customer First"}
                  fetchOptions={async (q, signal) => {
                    if (!formData.customerId) return [];
                    const url = `${import.meta.env.VITE_API_URL}/vehicles?search=${encodeURIComponent(q)}&customerId=${formData.customerId}&limit=10`;
                    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }, signal });
                    const data = await res.json();
                    return data.success ? data.data : [];
                  }}
                  getOptionLabel={(v) => `${v.registrationNumber} - ${v.brand} ${v.model}`}
                  value={formData.vehicleObj}
                  onSelect={handleVehicleSelect}
                  disabled={!formData.customerId || !!initialBookingId || !!trackerCarId}
                />
              {trackerCarId && (
                  <p className="text-xs font-bold text-blue-600 mt-2">
                    Creating Job Card for Rental Tracker Car.
                  </p>
              )}
            </div>

            {/* 3. Owner & Vehicle Details (Read Only) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-100 pb-2">Owner</h3>
                <div className="space-y-2">
                  <div className="text-sm"><span className="text-gray-500 inline-block w-20">Name:</span> <span className="font-medium">{formData.ownerName || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 inline-block w-20">Phone:</span> <span className="font-medium">{formData.ownerPhone || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 inline-block w-20">Email:</span> <span className="font-medium">{formData.ownerEmail || '-'}</span></div>
                </div>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-100 pb-2">Vehicle</h3>
                <div className="space-y-2">
                  <div className="text-sm"><span className="text-gray-500 inline-block w-20">Make:</span> <span className="font-medium">{formData.vehicleMake || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 inline-block w-20">Model:</span> <span className="font-medium">{formData.vehicleModel || '-'}</span></div>
                  <div className="text-sm"><span className="text-gray-500 inline-block w-20">Reg No:</span> <span className="font-medium">{formData.vehicleRegNo || '-'}</span></div>
                </div>
              </div>
            </div>

            {/* 4. Mechanic */}
            <div className="mb-10 w-full md:w-1/2">
              <label className="block text-xs text-gray-500 mb-1 uppercase font-bold tracking-wider">Mechanic</label>
              <EntityAutocomplete
                placeholder="Search mechanic name..."
                fetchOptions={async (q, signal) => {
                  const res = await fetch(`${import.meta.env.VITE_API_URL}/admins/technicians?search=${encodeURIComponent(q)}&limit=10`, { 
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }, 
                    signal 
                  });
                  const data = await res.json();
                  return data.success ? data.data : [];
                }}
                onSelect={(mechanic) => {
                  if (mechanic) {
                    setFormData(prev => ({ ...prev, technicianId: mechanic._id, mechanic: mechanic.name }));
                  } else {
                    setFormData(prev => ({ ...prev, technicianId: '', mechanic: '' }));
                  }
                }}
                value={formData.technicianId ? { _id: formData.technicianId, name: formData.mechanic } : null}
              />
            </div>

            {/* 5. Inventory Items Used */}
            <div className="mb-10">
              <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-5 border-b border-gray-100 pb-2">Inventory Items Used</h3>
              <div className="mb-4">
                <EntityAutocomplete
                  placeholder="Search Inventory Items..."
                  fetchOptions={async (q, signal) => {
                    const res = await fetch(`${import.meta.env.VITE_API_URL}/inventory?search=${encodeURIComponent(q)}&limit=10`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }, signal });
                    const data = await res.json();
                    if (data.success) {
                      const flattened = [];
                      data.data.forEach(item => {
                        if (item.variants && item.variants.length > 0) {
                          item.variants.forEach(v => {
                            flattened.push({
                              inventoryId: item._id,
                              variantId: v._id,
                              itemName: item.itemName,
                              variantName: v.name,
                              ...(isMechanic ? {} : { unitPrice: v.unitPrice || 0 }),
                              displayLabel: `${item.itemName} - ${v.name}`
                            });
                          });
                        } else {
                          flattened.push({
                            inventoryId: item._id,
                            variantId: null,
                            itemName: item.itemName,
                            variantName: '',
                            ...(isMechanic ? {} : { unitPrice: 0 }),
                            displayLabel: item.itemName
                          });
                        }
                      });
                      return flattened;
                    }
                    return [];
                  }}
                  getOptionLabel={(item) => item.displayLabel}
                  value={null}
                  resetOnSelect={true}
                  onSelect={handleInventorySelect}
                />
              </div>
              {formData.partsUsed.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-medium">Item Name</th>
                        <th className="px-4 py-3 font-medium w-24">Qty</th>
                        {isAdmin && <th className="px-4 py-3 font-medium w-32">Unit Price ($)</th>}
                        {isAdmin && <th className="px-4 py-3 font-medium w-32 text-right">Total ($)</th>}
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.partsUsed.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-medium text-dark">{p.itemName} {p.variantName ? `- ${p.variantName}` : ''}</td>
                          <td className="px-4 py-3">
                            <input 
                              type="number" min="1" value={p.quantity} onChange={(e) => updatePart(p.id, 'quantity', e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500"
                            />
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <input 
                                type="number" min="0" step="0.01" value={p.unitPrice ?? 0} onChange={(e) => updatePart(p.id, 'unitPrice', e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500"
                              />
                            </td>
                          )}
                          {isAdmin && (
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{((p.quantity || 1) * (p.unitPrice || 0)).toFixed(2)}</td>
                          )}
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => removePart(p.id)} className="text-gray-400 hover:text-red-500">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 6. Services Provided */}
            <div className="mb-10">
              <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-5 border-b border-gray-100 pb-2">Services Provided</h3>
              
              <div className="flex gap-3 mb-4 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Service Description</label>
                  <input 
                    type="text" value={newServiceLine.name} onChange={(e) => setNewServiceLine({...newServiceLine, name: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-red-500"
                    placeholder="e.g. Engine Tune Up"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Qty (Hrs)</label>
                  <input 
                    type="number" min="1" step="0.5" value={newServiceLine.quantity} onChange={(e) => setNewServiceLine({...newServiceLine, quantity: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-red-500"
                  />
                </div>
                {isAdmin && (
                  <div className="w-32">
                    <label className="block text-[10px] uppercase text-gray-500 font-bold mb-1">Rate ($)</label>
                    <input 
                      type="number" min="0" step="0.01" value={newServiceLine.cost} onChange={(e) => setNewServiceLine({...newServiceLine, cost: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-red-500"
                    />
                  </div>
                )}
                <button 
                  type="button" onClick={addServiceLine}
                  className="bg-gray-100 hover:bg-gray-200 text-dark px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors h-[42px]"
                >
                  ADD
                </button>
              </div>

              {formData.servicesProvided.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-medium">Service Description</th>
                        <th className="px-4 py-3 font-medium w-24">Qty (Hrs)</th>
                        {isAdmin && <th className="px-4 py-3 font-medium w-32">Rate ($)</th>}
                        {isAdmin && <th className="px-4 py-3 font-medium w-32 text-right">Total ($)</th>}
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.servicesProvided.map((s) => (
                        <tr key={s.id}>
                          <td className="px-4 py-3">
                            <input 
                              type="text" value={s.name} onChange={(e) => updateService(s.id, 'name', e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="number" min="0.5" step="0.5" value={s.quantity} onChange={(e) => updateService(s.id, 'quantity', e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500"
                            />
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <input 
                                type="number" min="0" step="0.01" value={s.cost ?? 0} onChange={(e) => updateService(s.id, 'cost', e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500"
                              />
                            </td>
                          )}
                          {isAdmin && (
                            <td className="px-4 py-3 text-right font-mono text-gray-700">{((s.quantity || 1) * (s.cost || 0)).toFixed(2)}</td>
                          )}
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => removeService(s.id)} className="text-gray-400 hover:text-red-500">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 7. Needs Attention & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div>
                <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-3 border-b border-gray-100 pb-2">Needs Attention</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {NEEDS_PRESETS.map(need => (
                    <label key={need} className="flex items-center gap-2 cursor-pointer group bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-300">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.needsAttention.includes(need) ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                        {formData.needsAttention.includes(need) && <CheckCircle size={10} className="text-white" />}
                      </div>
                      <span className="text-xs text-gray-700 group-hover:text-dark">{need}</span>
                      <input type="checkbox" className="hidden" checked={formData.needsAttention.includes(need)} onChange={() => toggleCheckbox('needsAttention', need)} />
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" value={customNeed} onChange={(e) => setCustomNeed(e.target.value)} placeholder="Add Custom Need"
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none"
                  />
                  <button type="button" onClick={() => { if(customNeed) { toggleCheckbox('needsAttention', customNeed); setCustomNeed(''); } }} className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-xs font-bold">ADD</button>
                </div>
              </div>
              
              <div>
                <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-3 border-b border-gray-100 pb-2">Notes</h3>
                <textarea 
                  name="notes" value={formData.notes} onChange={handleInputChange} rows="5"
                  className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-red-500 outline-none resize-none"
                ></textarea>
              </div>
            </div>

            {/* 8. Summary Math (Admin / Super Admin Only) */}
            {isAdmin && (
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-4 border-b border-gray-200 pb-2">Calculation Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Parts Total</span>
                    <span className="font-mono text-dark font-medium">${partsTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Services Total</span>
                    <span className="font-mono text-dark font-medium">${servicesTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 border-t border-gray-200 pt-3">
                    <span>Subtotal</span>
                    <span className="font-mono text-dark font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Estimated GST (10%)</span>
                    <span className="font-mono text-dark font-medium">${gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-gray-300 pt-4 mt-2">
                    <span className="font-bold text-dark uppercase tracking-wider text-lg">TOTAL INC. GST</span>
                    <span className="text-2xl font-bold font-mono text-red-600">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
            
          </form>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="jobCardForm" variant="primary" loading={isSubmitting}>
            Create Job Card
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewJobCard;
