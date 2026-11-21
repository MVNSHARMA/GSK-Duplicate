import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wrench, CheckCircle, X, ShieldAlert, MessageSquare, Send, ArrowLeft, Loader2, Lock, DollarSign, FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';
import { useParams, useNavigate } from 'react-router-dom';
import { JOB_CARD_STATUSES } from '../../utils/statusConstants';

const SERVICES_PRESETS = [
  "Lubrication", "Wheel Alignment", "Exhaust System", "Safety Check", 
  "Dyn. Wheel Balance", "Brake Services", "Electronic Tune Up", 
  "Auto Trans. Service", "Cooling System Service"
];

const NEEDS_PRESETS = [
  "Engine Tune up", "Steering Alignment", "Tyre/ Balance", "Cooling System",
  "Brake", "Electrical", "Transmission", "Exhaust", "Body Faults"
];

const EditJobCard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [showMechanicModal, setShowMechanicModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isLoadingJobCard, setIsLoadingJobCard] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const { user } = useAuth();
  const isMechanic = user?.role === 'mechanic' || user?.role === 'user';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'superadmin';
  const [existingInvoiceId, setExistingInvoiceId] = useState(null);
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    vehicleObj: null,
    vehicleId: '',
    
    // Owner Details
    customerObj: null,
    customerId: '',
    ownerName: '', ownerPhone: '', ownerAddress: '', 
    ownerPostalCode: '', ownerEmail: '', ownerMobile: '',
    
    // Vehicle Details
    vehicleRegNo: '',
    vehicleMake: '', vehicleModel: '', vehicleEngineNo: '',
    vehicleSpeedo: '', vehicleMfgDate: '', vehicleChassisNo: '',
    
    // Rental / Fleet
    trackerId: '',
    trackerCarId: '',
    rentalEntryId: '',
    isRental: false,
    
    // Checklists
    servicesOrdered: [],
    needsAttention: [],
    
    // Repairs & Labour
    repairsOrdered: '',
    labourHours: '',
    hourlyRate: '',
    
    // Charges & Financials (Admin only)
    chargeLubricants: '',
    chargeDifferential: '',
    chargeMisc: '',
    chargeTransmission: '',
    chargeBrake: '',
    discountAmount: '',
    finalAmount: '',
    gstRate: 10,
    financialsFinalized: false,
    finalizedBy: null,
    finalizedAt: null,
    completedAt: null,
    completedBy: null,
    
    // Additional
    technicianId: '',
    mechanic: '',
    partsUsed: [],
    servicesProvided: [],
    notes: '',
    status: 'Open'
  });

  // State for parts/services insertion
  const [selectedInvPartObj, setSelectedInvPartObj] = useState(null);
  const [partQuantity, setPartQuantity] = useState(1);
  const [newServiceLine, setNewServiceLine] = useState({ name: '', cost: '', quantity: 1 });

  const [customService, setCustomService] = useState('');
  const [customNeed, setCustomNeed] = useState('');

  // Customer Service Updates state
  const [customerUpdates, setCustomerUpdates] = useState([]);
  const [newCustomerUpdate, setNewCustomerUpdate] = useState('');
  const [customerUpdateLoading, setCustomerUpdateLoading] = useState(false);

  const populateFormFromJobCard = useCallback((jc) => {
    const customer = jc.customerId && typeof jc.customerId === 'object' ? jc.customerId : null;
    const vehicle = jc.vehicleId && typeof jc.vehicleId === 'object' ? jc.vehicleId : null;
    const trackerCar = jc.trackerCarId && typeof jc.trackerCarId === 'object' ? jc.trackerCarId : null;
    const technician = jc.technicianId && typeof jc.technicianId === 'object' ? jc.technicianId : null;

    const normalizedParts = (jc.partsUsed || []).map((p, idx) => {
      const invObj = p.inventoryId && typeof p.inventoryId === 'object' ? p.inventoryId : null;
      const invId = invObj ? invObj._id : p.inventoryId;
      const itemName = invObj?.itemName || p.itemName || 'Part';
      const partNumber = invObj?.partNumber || p.partNumber || '';
      return {
        id: p._id || `part-${idx}-${Date.now()}`,
        _id: p._id,
        inventoryId: invId,
        itemName,
        partNumber,
        variantId: p.variantId || undefined,
        variantName: p.variantName || '',
        quantity: Number(p.quantity) || 1,
        ...(isAdmin ? { unitPrice: Number(p.unitPrice) || 0 } : {})
      };
    });

    const normalizedServices = (jc.servicesProvided || []).map((s, idx) => ({
      id: s._id || `svc-${idx}-${Date.now()}`,
      _id: s._id,
      name: s.name || '',
      quantity: Number(s.quantity) || 1,
      ...(isAdmin ? { cost: Number(s.cost) || 0 } : {})
    }));

    if (jc.hasInvoice && jc.invoiceId) {
      setExistingInvoiceId(jc.invoiceId);
      setExistingInvoiceNumber(jc.invoiceNumber || null);
    }

    setFormData({
      vehicleObj: vehicle || (trackerCar ? {
        _id: trackerCar._id,
        registrationNumber: trackerCar.registrationNumber,
        brand: trackerCar.make,
        model: trackerCar.model
      } : null),
      vehicleId: vehicle?._id || (typeof jc.vehicleId === 'string' ? jc.vehicleId : '') || '',
      customerObj: customer || null,
      customerId: customer?._id || (typeof jc.customerId === 'string' ? jc.customerId : '') || '',
      
      ownerName: customer?.name || '',
      ownerPhone: customer?.phone || '',
      ownerAddress: customer?.address || '',
      ownerPostalCode: customer?.postalCode || '',
      ownerEmail: customer?.email || '',
      ownerMobile: customer?.mobile || customer?.phone || '',
      
      vehicleRegNo: vehicle?.registrationNumber || trackerCar?.registrationNumber || jc.vehicleDetails?.registrationNumber || '',
      vehicleMake: vehicle?.brand || vehicle?.make || trackerCar?.make || jc.vehicleDetails?.brand || '',
      vehicleModel: vehicle?.model || trackerCar?.model || jc.vehicleDetails?.model || '',
      vehicleEngineNo: vehicle?.engineNo || jc.vehicleDetails?.engineNo || vehicle?.registrationNumber || trackerCar?.registrationNumber || '',
      vehicleSpeedo: vehicle?.speedo || vehicle?.mileage || trackerCar?.finalOdometer || jc.vehicleDetails?.speedo || '',
      vehicleMfgDate: (vehicle?.mfgDate || vehicle?.year || trackerCar?.year || jc.vehicleDetails?.mfgDate || '').toString(),
      vehicleChassisNo: vehicle?.chassisNo || vehicle?.vin || trackerCar?.vin || jc.vehicleDetails?.chassisNo || '',
      
      trackerId: jc.trackerId || '',
      trackerCarId: trackerCar?._id || (typeof jc.trackerCarId === 'string' ? jc.trackerCarId : '') || '',
      rentalEntryId: jc.rentalEntryId || '',
      isRental: !!(trackerCar || jc.trackerCarId),
      
      technicianId: technician?._id || (typeof jc.technicianId === 'string' ? jc.technicianId : '') || '',
      mechanic: technician?.name || jc.mechanic || '',
      
      servicesOrdered: Array.isArray(jc.servicesOrdered) ? jc.servicesOrdered : [],
      needsAttention: Array.isArray(jc.needsAttention) ? jc.needsAttention : [],
      
      partsUsed: normalizedParts,
      servicesProvided: normalizedServices,
      
      repairsOrdered: jc.repairsOrdered || '',
      labourHours: jc.labourHours !== undefined && jc.labourHours !== null ? jc.labourHours : '',
      hourlyRate: isAdmin ? (jc.hourlyRate !== undefined && jc.hourlyRate !== null ? jc.hourlyRate : '') : '',
      
      chargeLubricants: isAdmin ? (jc.charges?.lubricantsOil ?? '') : '',
      chargeDifferential: isAdmin ? (jc.charges?.differentialOil ?? '') : '',
      chargeMisc: isAdmin ? (jc.charges?.miscellaneous ?? '') : '',
      chargeTransmission: isAdmin ? (jc.charges?.transmission ?? '') : '',
      chargeBrake: isAdmin ? (jc.charges?.brakeFluid ?? '') : '',
      discountAmount: isAdmin ? (jc.discountAmount ?? '') : '',
      finalAmount: isAdmin && jc.finalAmount !== null && jc.finalAmount !== undefined ? jc.finalAmount : '',
      gstRate: jc.gstRate ?? 10,
      financialsFinalized: !!jc.financialsFinalized,
      finalizedBy: jc.finalizedBy || null,
      finalizedAt: jc.finalizedAt || null,
      completedAt: jc.completedAt || null,
      completedBy: jc.completedBy || null,
      
      notes: jc.notes || '',
      status: jc.status || 'Open'
    });
  }, [isAdmin]);

  useEffect(() => {
    if (!id) return;
    
    const fetchJobCard = async () => {
      setIsLoadingJobCard(true);
      try {
        const token = localStorage.getItem('gsk_token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success && data.data) {
          setFetchError(null);
          populateFormFromJobCard(data.data);
        } else {
          setFetchError(data.error || 'Job Card not found');
        }
      } catch (error) {
        console.error("Failed to fetch job card:", error);
        setFetchError('Failed to load Job Card details');
      } finally {
        setIsLoadingJobCard(false);
      }
    };

    fetchJobCard();
  }, [id, populateFormFromJobCard]);

  // Fetch Customer Updates when editing a job card (Admin only)
  useEffect(() => {
    if (!id || !isAdmin) return;
    const fetchCustomerUpdates = async () => {
      try {
        const token = localStorage.getItem('gsk_token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}/customer-updates`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setCustomerUpdates(data.data || []);
      } catch (err) {
        console.error('Failed to fetch customer updates:', err);
      }
    };
    fetchCustomerUpdates();
  }, [id, isAdmin]);

  const handleSendCustomerUpdate = async () => {
    if (!newCustomerUpdate.trim() || !id) return;
    setCustomerUpdateLoading(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}/customer-updates`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newCustomerUpdate.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setCustomerUpdates(prev => [data.data, ...prev]);
        setNewCustomerUpdate('');
      }
    } catch (err) {
      console.error('Failed to create customer update:', err);
    } finally {
      setCustomerUpdateLoading(false);
    }
  };

  const handleDeleteCustomerUpdate = async (updateId) => {
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}/customer-updates/${updateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCustomerUpdates(prev => prev.filter(u => u._id !== updateId));
      }
    } catch (err) {
      console.error('Failed to delete customer update:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCustomerSelect = (selectedCustomer) => {
    if (!selectedCustomer) {
      setFormData(prev => ({
        ...prev,
        customerObj: null,
        customerId: '', ownerName: '', ownerPhone: '', ownerAddress: '', ownerPostalCode: '', ownerEmail: '', ownerMobile: '',
        vehicleObj: null,
        vehicleId: '', vehicleRegNo: '', vehicleMake: '', vehicleModel: '', vehicleMfgDate: '', vehicleEngineNo: '', vehicleChassisNo: '', vehicleSpeedo: ''
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      customerObj: selectedCustomer,
      customerId: selectedCustomer._id,
      ownerName: selectedCustomer.name || '',
      ownerPhone: selectedCustomer.phone || '',
      ownerMobile: selectedCustomer.mobile || selectedCustomer.phone || '',
      ownerEmail: selectedCustomer.email || '',
      ownerAddress: selectedCustomer.address || '',
      ownerPostalCode: selectedCustomer.postalCode || '',
      
      // Clear vehicle selection when customer changes
      vehicleObj: null,
      vehicleId: '', vehicleRegNo: '', vehicleMake: '', vehicleModel: '', vehicleMfgDate: '', vehicleEngineNo: '', vehicleChassisNo: '', vehicleSpeedo: ''
    }));
  };

  const handleVehicleSelect = (selectedVehicle) => {
    if (!selectedVehicle) {
      setFormData(prev => ({
        ...prev,
        vehicleObj: null,
        vehicleId: '',
        vehicleRegNo: '', vehicleMake: '', vehicleModel: '', vehicleMfgDate: '', vehicleEngineNo: '', vehicleChassisNo: '', vehicleSpeedo: ''
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      vehicleObj: selectedVehicle,
      vehicleId: selectedVehicle._id,
      vehicleRegNo: selectedVehicle.registrationNumber || '',
      vehicleMake: selectedVehicle.brand || selectedVehicle.make || '',
      vehicleModel: selectedVehicle.model || '',
      vehicleMfgDate: selectedVehicle.year ? selectedVehicle.year.toString() : '',
      vehicleEngineNo: selectedVehicle.engineNo || selectedVehicle.registrationNumber || '',
      vehicleChassisNo: selectedVehicle.chassisNo || selectedVehicle.vin || '',
      vehicleSpeedo: selectedVehicle.speedo || selectedVehicle.mileage || ''
    }));
  };

  const toggleCheckbox = (listName, item) => {
    setFormData(prev => {
      const list = [...(prev[listName] || [])];
      if (list.includes(item)) {
        return { ...prev, [listName]: list.filter(i => i !== item) };
      } else {
        return { ...prev, [listName]: [...list, item] };
      }
    });
  };

  // Add inventory part to partsUsed and immediately reset search state
  const addInventoryPartToJobCard = (partOption, qtyOverride = null) => {
    if (!partOption) return;
    const qty = Math.max(1, Number(qtyOverride ?? partQuantity) || 1);

    setFormData(prev => {
      const existingPartIndex = prev.partsUsed.findIndex(p => 
        String(p.inventoryId) === String(partOption.inventoryId) && 
        String(p.variantId || '') === String(partOption.variantId || '')
      );

      if (existingPartIndex !== -1) {
        const displayLabel = partOption.variantName
          ? `${partOption.itemName} - ${partOption.variantName}`
          : partOption.itemName;
        toast.info(`${displayLabel} is already in the list. Increased quantity.`);
        const updatedParts = [...prev.partsUsed];
        updatedParts[existingPartIndex] = {
          ...updatedParts[existingPartIndex],
          quantity: (Number(updatedParts[existingPartIndex].quantity) || 1) + qty
        };
        return { ...prev, partsUsed: updatedParts };
      }

      return {
        ...prev,
        partsUsed: [
          ...prev.partsUsed,
          {
            id: `${Date.now()}-${Math.random()}`,
            inventoryId: partOption.inventoryId,
            variantId: partOption.variantId || undefined,
            variantName: partOption.name || partOption.variantName || '',
            itemName: partOption.itemName || partOption.productName || 'Part',
            quantity: qty,
            ...(isAdmin ? { unitPrice: Number(partOption.unitPrice) || 0 } : {})
          }
        ]
      };
    });

    setSelectedInvPartObj(null);
    setPartQuantity(1);
  };

  const handleAddPart = () => {
    if (!selectedInvPartObj) {
      toast.error("Please select a part from inventory.");
      return;
    }
    addInventoryPartToJobCard(selectedInvPartObj, partQuantity);
  };

  const updatePart = (partId, field, value) => {
    if (isMechanic && field === 'unitPrice') return;
    setFormData(prev => ({
      ...prev,
      partsUsed: prev.partsUsed.map(p => (p.id === partId || p._tempId === partId) ? { ...p, [field]: Number(value) } : p)
    }));
  };

  const handleRemovePart = (partId) => {
    setFormData(prev => ({
      ...prev,
      partsUsed: prev.partsUsed.filter(p => p.id !== partId && p._tempId !== partId)
    }));
  };

  const addServiceLine = () => {
    if (!newServiceLine.name.trim()) return;
    setFormData(prev => ({
      ...prev,
      servicesProvided: [...prev.servicesProvided, {
        id: `${Date.now()}-${Math.random()}`,
        name: newServiceLine.name.trim(),
        quantity: Math.max(0.5, Number(newServiceLine.quantity) || 1),
        ...(isAdmin ? { cost: Math.max(0, Number(newServiceLine.cost) || 0) } : {})
      }]
    }));
    setNewServiceLine({ name: '', cost: '', quantity: 1 });
  };

  const updateServiceLine = (serviceId, field, value) => {
    if (isMechanic && field === 'cost') return;
    setFormData(prev => ({
      ...prev,
      servicesProvided: prev.servicesProvided.map(s =>
        s.id === serviceId
          ? { ...s, [field]: field === 'name' ? value : Number(value) }
          : s
      )
    }));
  };

  const removeServiceLine = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      servicesProvided: prev.servicesProvided.filter(s => s.id !== serviceId)
    }));
  };

  const handleSaveJobCard = async (e, options = {}) => {
    if (e && e.preventDefault) e.preventDefault();
    const { overrideStatus = null, finalizeFinancials = undefined, stayOnPage = false } = options;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('gsk_token');

      const normalizedPartsPayload = (formData.partsUsed || []).map(p => ({
        inventoryId: p.inventoryId?._id || p.inventoryId,
        variantId: p.variantId || undefined,
        variantName: p.variantName || '',
        quantity: Math.max(1, Number(p.quantity) || 1),
        ...(isAdmin ? { unitPrice: Math.max(0, Number(p.unitPrice) || 0) } : {})
      }));

      const normalizedServicesPayload = (formData.servicesProvided || []).map(s => ({
        ...(s._id ? { _id: s._id } : {}),
        name: s.name,
        quantity: Math.max(0.5, Number(s.quantity) || 1),
        ...(isAdmin ? {
          cost: Math.max(0, Number(s.cost) || 0),
          total: Number(((Number(s.quantity) || 1) * (Number(s.cost) || 0)).toFixed(2))
        } : {})
      }));

      const payload = {
        customerId: formData.customerId,
        vehicleId: formData.vehicleId || null,
        trackerId: formData.trackerId || null,
        trackerCarId: formData.trackerCarId || null,
        rentalEntryId: formData.rentalEntryId || null,
        technicianId: formData.technicianId || null,
        mechanic: formData.mechanic,
        servicesOrdered: formData.servicesOrdered,
        needsAttention: formData.needsAttention,
        repairsOrdered: formData.repairsOrdered,
        labourHours: Number(formData.labourHours) || 0,
        partsUsed: normalizedPartsPayload,
        servicesProvided: normalizedServicesPayload,
        notes: formData.notes,
        status: overrideStatus || formData.status
      };

      if (isAdmin) {
        payload.hourlyRate = Number(formData.hourlyRate) || 0;
        payload.charges = {
          lubricantsOil: Number(formData.chargeLubricants) || 0,
          differentialOil: Number(formData.chargeDifferential) || 0,
          miscellaneous: Number(formData.chargeMisc) || 0,
          transmission: Number(formData.chargeTransmission) || 0,
          brakeFluid: Number(formData.chargeBrake) || 0
        };
        payload.discountAmount = Math.max(0, Number(formData.discountAmount) || 0);
        if (formData.finalAmount !== '' && formData.finalAmount !== null && formData.finalAmount !== undefined) {
          payload.finalAmount = Math.max(0, Number(formData.finalAmount));
        }
        if (finalizeFinancials !== undefined) {
          payload.finalizeFinancials = finalizeFinancials;
          payload.financialsFinalized = finalizeFinancials;
        }
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        populateFormFromJobCard(data.data);
        if (finalizeFinancials === true) {
          toast.success('Final amount saved and finalized! You can now generate the invoice.');
        } else if (overrideStatus === 'Completed') {
          toast.success(
            isMechanic
              ? 'Job Card marked as Completed! Administrators have been notified to finalize pricing.'
              : 'Job Card marked as Completed!'
          );
        } else {
          toast.success('Job Card updated successfully!');
        }
        if (!stayOnPage && !finalizeFinancials) {
          navigate('/admin/job-cards');
        }
      } else {
        toast.error(data.error || 'Failed to update job card');
      }
    } catch (error) {
      console.error("Error saving job card:", error);
      toast.error('Server error saving job card');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations (Admin / Super Admin Only)
  const lHours = Number(formData.labourHours) || 0;
  const hRate = isAdmin ? (Number(formData.hourlyRate) || 0) : 0;
  const cLub = isAdmin ? (Number(formData.chargeLubricants) || 0) : 0;
  const cDiff = isAdmin ? (Number(formData.chargeDifferential) || 0) : 0;
  const cMisc = isAdmin ? (Number(formData.chargeMisc) || 0) : 0;
  const cTrans = isAdmin ? (Number(formData.chargeTransmission) || 0) : 0;
  const cBrake = isAdmin ? (Number(formData.chargeBrake) || 0) : 0;
  const discountVal = isAdmin ? Math.max(0, Number(formData.discountAmount) || 0) : 0;
  
  const labourTotal = lHours * hRate;
  const partsUsedTotal = isAdmin
    ? (formData.partsUsed || []).reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0)
    : 0;
  const servicesTotal = isAdmin
    ? (formData.servicesProvided || []).reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.cost) || 0)), 0)
    : 0;
  const fluidsTotal = cLub + cDiff + cMisc + cTrans + cBrake;
  const partsTotal = fluidsTotal + partsUsedTotal + servicesTotal;
  const grossSubtotal = labourTotal + partsTotal;
  const netSubtotal = Math.max(0, grossSubtotal - discountVal);
  const appliedGstRate = Number(formData.gstRate ?? 10);
  const calculatedGstAmount = (netSubtotal * appliedGstRate) / 100;
  const calculatedTotalIncGst = netSubtotal + calculatedGstAmount;
  const effectiveFinalAmount = (formData.finalAmount !== '' && formData.finalAmount !== null && formData.finalAmount !== undefined)
    ? Math.max(0, Number(formData.finalAmount) || 0)
    : calculatedTotalIncGst;

  if (isLoadingJobCard) {
    return (
      <div className="max-w-4xl mx-auto text-dark py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        <p className="text-sm text-gray-500 font-medium">Loading Job Card details...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-4xl mx-auto text-dark animate-fade-in-up pb-10 pt-10 text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-2">Error Loading Job Card</h1>
        <p className="text-gray-600">{fetchError}</p>
        <button onClick={() => navigate('/admin/job-cards')} className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium">
            Back to Job Cards
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto text-dark animate-fade-in-up pb-10">
      
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/admin/job-cards')} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Job Cards
        </button>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="font-heading text-3xl mb-1 flex items-center gap-3 font-bold">
            <Wrench className="text-red-500" size={32} /> Edit Job Card
            <span className="text-lg font-mono text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
              JC-{id?.slice(-4).toUpperCase()}
            </span>
          </h1>
          <p className="text-gray-500 text-sm">Update service details, inventory items, and progress</p>
        </div>
        {isAdmin && formData.status === 'Completed' && (
          <div className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            formData.financialsFinalized
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {formData.financialsFinalized ? (
              <>
                <CheckCircle size={16} className="text-emerald-600" />
                <span>Final Amount Finalized (${effectiveFinalAmount.toFixed(2)})</span>
              </>
            ) : (
              <>
                <DollarSign size={16} className="text-amber-600" />
                <span>Completed — Final Amount Required Before Invoicing</span>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Form Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8">
          <form id="jobCardForm" onSubmit={(e) => handleSaveJobCard(e)}>
            
            {/* 1. Customer Selection */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Select Customer</label>
              <EntityAutocomplete
                placeholder="Search Customer..."
                fetchOptions={async (q) => {
                  const res = await fetch(`${import.meta.env.VITE_API_URL}/customers?search=${encodeURIComponent(q)}&limit=10`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` } });
                  const data = await res.json();
                  return data.success ? data.data : [];
                }}
                getOptionLabel={(c) => `${c.name}${c.phone ? ` - ${c.phone}` : ''}`}
                value={formData.customerObj}
                onSelect={handleCustomerSelect}
                disabled={isMechanic || formData.isRental}
              />
            </div>

            {/* 2. Vehicle Selection */}
            <div className="mb-10">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Select Vehicle</label>
              <EntityAutocomplete
                placeholder={formData.customerId ? "Search Vehicle..." : "Select Customer First"}
                fetchOptions={async (q) => {
                  if (!formData.customerId) return [];
                  const url = `${import.meta.env.VITE_API_URL}/vehicles?search=${encodeURIComponent(q)}&customerId=${formData.customerId}&limit=10`;
                  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` } });
                  const data = await res.json();
                  return data.success ? data.data : [];
                }}
                getOptionLabel={(v) => `${v.registrationNumber || 'No Rego'} - ${v.brand || v.make || ''} ${v.model || ''}`}
                value={formData.vehicleObj}
                onSelect={handleVehicleSelect}
                disabled={isMechanic || !formData.customerId || formData.isRental}
              />
              <p className="text-[10px] text-gray-500 mt-1 pl-1">Selecting a vehicle will auto-populate vehicle details.</p>
              {formData.isRental && (
                  <p className="text-xs font-bold text-blue-600 mt-2">
                    This is a Rental Tracker Car Job Card (Permanent vehicle selection disabled).
                  </p>
              )}
            </div>

            {/* 3. Owner Details */}
            <div className="mb-10 bg-gray-50 p-6 rounded-xl border border-gray-100">
              <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-5 border-b border-gray-100 pb-2">Owner Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Owner&apos;s Name*</label>
                  <input type="text" readOnly name="ownerName" value={formData.ownerName} className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Phone</label>
                  <input type="text" readOnly name="ownerPhone" value={formData.ownerPhone} className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Address</label>
                  <input type="text" readOnly name="ownerAddress" value={formData.ownerAddress} className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Postal Code</label>
                  <input type="text" readOnly name="ownerPostalCode" value={formData.ownerPostalCode} className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Email</label>
                  <input type="email" readOnly name="ownerEmail" value={formData.ownerEmail} className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Mobile</label>
                  <input type="text" readOnly name="ownerMobile" value={formData.ownerMobile} className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
              </div>
            </div>

            {/* 4. Vehicle Details */}
            <div className="mb-10 bg-gray-50 p-6 rounded-xl border border-gray-100">
              <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-5 border-b border-gray-100 pb-2">Vehicle Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Rego No.</label>
                  <input type="text" readOnly name="vehicleRegNo" value={formData.vehicleRegNo} placeholder="REGO" className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Make*</label>
                  <input type="text" readOnly name="vehicleMake" value={formData.vehicleMake} placeholder="BRAND" className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Model</label>
                  <input type="text" readOnly name="vehicleModel" value={formData.vehicleModel} placeholder="Model" className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Engine No.</label>
                  <input type="text" readOnly name="vehicleEngineNo" value={formData.vehicleEngineNo} placeholder="ENGINE" className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Speedo</label>
                  <input type="text" readOnly name="vehicleSpeedo" value={formData.vehicleSpeedo} placeholder="KMS" className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Mfg Date</label>
                  <input type="text" readOnly name="vehicleMfgDate" value={formData.vehicleMfgDate} placeholder="YEAR" className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Chassis No.</label>
                  <input type="text" readOnly name="vehicleChassisNo" value={formData.vehicleChassisNo} placeholder="CHASSIS" className="w-full bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Mechanic</label>
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
                    value={formData.technicianId ? { _id: formData.technicianId, name: formData.mechanic } : (formData.mechanic ? { _id: formData.mechanic, name: formData.mechanic } : null)}
                  />
                </div>
              </div>
            </div>

            {/* 5. Services Ordered */}
            <div className="mb-10">
              <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-5 border-b border-gray-100 pb-2">Services Ordered</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                {SERVICES_PRESETS.map(service => (
                  <label key={service} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${(formData.servicesOrdered || []).includes(service) ? 'bg-red-500 border-red-500' : 'border-gray-300 group-hover:border-red-400'}`}>
                      {(formData.servicesOrdered || []).includes(service) && <CheckCircle size={14} className="text-white" />}
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-dark transition-colors">{service}</span>
                    <input type="checkbox" className="hidden" checked={(formData.servicesOrdered || []).includes(service)} onChange={() => toggleCheckbox('servicesOrdered', service)} />
                  </label>
                ))}
                {(formData.servicesOrdered || []).filter(s => !SERVICES_PRESETS.includes(s)).map(custom => (
                  <label key={custom} className="flex items-center gap-3 cursor-pointer group">
                    <div className="w-5 h-5 rounded border border-red-500 bg-red-500 flex items-center justify-center">
                      <CheckCircle size={14} className="text-white" />
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-dark">{custom}</span>
                    <input type="checkbox" className="hidden" checked onChange={() => toggleCheckbox('servicesOrdered', custom)} />
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <input 
                  type="text" value={customService} onChange={(e) => setCustomService(e.target.value)} placeholder="Add Custom Services Ordered"
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-dark focus:border-red-500 outline-none transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => { if(customService) { toggleCheckbox('servicesOrdered', customService); setCustomService(''); } }}
                  className="bg-gray-100 hover:bg-gray-200 text-dark px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  ADD
                </button>
              </div>
            </div>

            {/* 6. Needs Attention */}
            <div className="mb-10">
              <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-5 border-b border-gray-100 pb-2">Needs Attention</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                {NEEDS_PRESETS.map(need => (
                  <label key={need} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.needsAttention?.includes(need) ? 'bg-red-500 border-red-500' : 'border-gray-300 group-hover:border-red-400'}`}>
                      {formData.needsAttention?.includes(need) && <CheckCircle size={14} className="text-white" />}
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-dark transition-colors">{need}</span>
                    <input type="checkbox" className="hidden" checked={formData.needsAttention?.includes(need)} onChange={() => toggleCheckbox('needsAttention', need)} />
                  </label>
                ))}
                {formData.needsAttention?.filter(n => !NEEDS_PRESETS.includes(n)).map(custom => (
                  <label key={custom} className="flex items-center gap-3 cursor-pointer group">
                    <div className="w-5 h-5 rounded border border-red-500 bg-red-500 flex items-center justify-center">
                      <CheckCircle size={14} className="text-white" />
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-dark">{custom}</span>
                    <input type="checkbox" className="hidden" checked onChange={() => toggleCheckbox('needsAttention', custom)} />
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <input 
                  type="text" value={customNeed} onChange={(e) => setCustomNeed(e.target.value)} placeholder="Add Custom Needs Attention"
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-dark focus:border-red-500 outline-none transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => { if(customNeed) { toggleCheckbox('needsAttention', customNeed); setCustomNeed(''); } }}
                  className="bg-gray-100 hover:bg-gray-200 text-dark px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  ADD
                </button>
              </div>
            </div>

            {/* 7. Repairs Ordered */}
            <div className="mb-10">
              <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-5 border-b border-gray-100 pb-2">Repairs Ordered</h3>
              <textarea 
                name="repairsOrdered" value={formData.repairsOrdered} onChange={handleInputChange} rows="3" placeholder="Describe repairs to be carried out"
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:border-red-500 outline-none resize-none mb-5 transition-colors"
              ></textarea>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs text-gray-500 mb-1 uppercase">Labour Hours</label>
                  <input type="number" min="0" step="0.5" name="labourHours" value={formData.labourHours} onChange={handleInputChange} placeholder="Hours" className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-dark focus:border-red-500 outline-none transition-colors" />
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 uppercase">Hourly Rate ($)</label>
                    <input type="number" min="0" step="0.01" name="hourlyRate" value={formData.hourlyRate} onChange={handleInputChange} placeholder="Rate" className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-dark focus:border-red-500 outline-none transition-colors" />
                  </div>
                )}
              </div>
            </div>

            {/* 8. Services Provided */}
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
                    type="number" min="0.5" step="0.5" value={newServiceLine.quantity} onChange={(e) => setNewServiceLine({...newServiceLine, quantity: e.target.value})}
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

              {formData.servicesProvided?.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-6">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-4">Service</th>
                        <th className="py-2 px-4 w-24">Qty (Hrs)</th>
                        {isAdmin && <th className="py-2 px-4 w-32">Rate ($)</th>}
                        {isAdmin && <th className="py-2 px-4 w-32 text-right">Total ($)</th>}
                        <th className="py-2 px-4 w-16 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.servicesProvided.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={s.name}
                              onChange={(e) => updateServiceLine(s.id, 'name', e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm font-medium text-dark outline-none focus:border-red-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={s.quantity}
                              onChange={(e) => updateServiceLine(s.id, 'quantity', e.target.value)}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-sm font-mono text-gray-700 outline-none focus:border-red-500"
                            />
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={s.cost ?? 0}
                                onChange={(e) => updateServiceLine(s.id, 'cost', e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-sm font-mono text-gray-700 outline-none focus:border-red-500"
                              />
                            </td>
                          )}
                          {isAdmin && (
                            <td className="px-4 py-3 text-right font-mono text-gray-700">
                              ${((Number(s.quantity) || 0) * (Number(s.cost) || 0)).toFixed(2)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => removeServiceLine(s.id)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-wider">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic mb-6">No custom services added.</p>
              )}
            </div>

            {/* 9. Parts Used */}
            <div className="mb-10 bg-gray-50 p-6 rounded-xl border border-gray-100">
              <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-5 border-b border-gray-100 pb-2">Parts Used</h3>
              
              <div className="flex flex-col md:flex-row gap-3 mb-5">
                <div className="flex-grow">
                  <EntityAutocomplete
                    placeholder="Search Part from Inventory..."
                    fetchOptions={async (q) => {
                      const res = await fetch(`${import.meta.env.VITE_API_URL}/inventory?search=${encodeURIComponent(q)}&limit=10`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` } });
                      const data = await res.json();
                      if (data.success) {
                        let flat = [];
                        data.data.forEach(item => {
                          if (!item.variants || item.variants.length === 0) {
                            const priceSuffix = isAdmin ? ` - $${(item.unitPrice || 0).toFixed(2)}` : '';
                            flat.push({
                              ...item,
                              inventoryId: item._id,
                              valueId: item._id,
                              itemName: item.itemName || item.productName,
                              variantName: '',
                              label: `${item.itemName || item.productName}${priceSuffix}`
                            });
                          } else {
                            item.variants.forEach(v => {
                              if (v.isActive) {
                                const priceSuffix = isAdmin ? ` - $${(v.unitPrice || 0).toFixed(2)}` : '';
                                flat.push({
                                  ...v,
                                  inventoryId: item._id,
                                  variantId: v._id,
                                  valueId: `${item._id}_${v._id}`,
                                  itemName: item.itemName || item.productName,
                                  variantName: v.name || v.variantName || '',
                                  label: `${item.itemName || item.productName} (${v.name || v.variantName})${priceSuffix}`
                                });
                              }
                            });
                          }
                        });
                        return flat;
                      }
                      return [];
                    }}
                    getOptionLabel={(opt) => opt.label}
                    getOptionValue={(opt) => opt.valueId}
                    value={selectedInvPartObj}
                    resetOnSelect={true}
                    onSelect={(val) => {
                      if (val) {
                        addInventoryPartToJobCard(val, partQuantity);
                      } else {
                        setSelectedInvPartObj(null);
                      }
                    }}
                  />
                </div>

                <div className="w-32">
                  <input 
                    type="number" min="1" value={partQuantity} onChange={(e) => setPartQuantity(e.target.value)}
                    placeholder="Qty"
                    title="Default quantity to add on selection"
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-dark focus:border-red-500 outline-none transition-colors"
                  />
                </div>
                {selectedInvPartObj && (
                  <button 
                    type="button" 
                    onClick={handleAddPart}
                    disabled={partQuantity < 1}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Add Part
                  </button>
                )}
              </div>

              {formData.partsUsed?.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Part / Variant</th>
                        <th className="py-3 px-4">Qty</th>
                        {isAdmin && <th className="py-3 px-4">Unit Price ($)</th>}
                        {isAdmin && <th className="py-3 px-4 text-right">Total ($)</th>}
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.partsUsed?.map((part, index) => {
                        const displayName = part.variantName ? `${part.itemName || 'Part'} - ${part.variantName}` : (part.itemName || 'Part');
                        return (
                          <tr key={part.id || part._tempId || index} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-dark">{displayName}</td>
                            <td className="py-3 px-4 w-24">
                              <input 
                                type="number" min="1" value={part.quantity} onChange={(e) => updatePart(part.id || part._tempId, 'quantity', e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500"
                              />
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-4 w-32">
                                <input 
                                  type="number" min="0" step="0.01" value={part.unitPrice ?? 0} onChange={(e) => updatePart(part.id || part._tempId, 'unitPrice', e.target.value)}
                                  className="w-full border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-500"
                                />
                              </td>
                            )}
                            {isAdmin && (
                              <td className="py-3 px-4 text-right font-bold text-gray-700">
                                ${((Number(part.quantity) || 0) * (Number(part.unitPrice) || 0)).toFixed(2)}
                              </td>
                            )}
                            <td className="py-3 px-4 text-center">
                              <button type="button" onClick={() => handleRemovePart(part.id || part._tempId)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-wider">Remove</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic text-center py-4 bg-white rounded-lg border border-gray-100">No parts added to this job card yet.</p>
              )}
            </div>

            {/* 10. Administrative Pricing & Final Amount Finalization - Admin & Super Admin Only */}
            {isAdmin && (
              <div className="mb-10 bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5 border-b border-gray-200 pb-3">
                  <div>
                    <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm">
                      Administrative Pricing &amp; Final Amount Review
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Review item costs, service charges, labour, discounts, and finalize the Job Card amount before invoicing.
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider self-start sm:self-auto ${
                    formData.financialsFinalized
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}>
                    {formData.financialsFinalized ? 'Final Amount Confirmed' : 'Pending Finalization'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 mb-8">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Lubricants / Engine Oil</span>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input type="number" min="0" step="0.01" name="chargeLubricants" value={formData.chargeLubricants} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm font-mono text-dark focus:border-red-500 outline-none text-right transition-colors" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Transmission</span>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input type="number" min="0" step="0.01" name="chargeTransmission" value={formData.chargeTransmission} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm font-mono text-dark focus:border-red-500 outline-none text-right transition-colors" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Differential Oil</span>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input type="number" min="0" step="0.01" name="chargeDifferential" value={formData.chargeDifferential} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm font-mono text-dark focus:border-red-500 outline-none text-right transition-colors" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Brake Fluid</span>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input type="number" min="0" step="0.01" name="chargeBrake" value={formData.chargeBrake} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm font-mono text-dark focus:border-red-500 outline-none text-right transition-colors" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Miscellaneous</span>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input type="number" min="0" step="0.01" name="chargeMisc" value={formData.chargeMisc} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm font-mono text-dark focus:border-red-500 outline-none text-right transition-colors" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">Discount</span>
                    <div className="relative w-36">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input type="number" min="0" step="0.01" name="discountAmount" value={formData.discountAmount} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm font-mono text-dark focus:border-red-500 outline-none text-right transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Summary Math & Final Amount */}
                <div className="space-y-3 border-t border-gray-200 pt-5">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Inventory Parts Subtotal</span>
                    <span className="font-mono text-dark font-medium">${partsUsedTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Services Subtotal</span>
                    <span className="font-mono text-dark font-medium">${servicesTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Labour Total ({lHours} hrs @ ${hRate.toFixed(2)})</span>
                    <span className="font-mono text-dark font-medium">${labourTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Fluids &amp; Extra Charges</span>
                    <span className="font-mono text-dark font-medium">${fluidsTotal.toFixed(2)}</span>
                  </div>
                  {discountVal > 0 && (
                    <div className="flex justify-between text-sm text-emerald-700 font-medium">
                      <span>Less Discount</span>
                      <span className="font-mono">-${discountVal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-gray-700 border-t border-gray-200 pt-3 font-medium">
                    <span>Subtotal (Excl. GST)</span>
                    <span className="font-mono text-dark">${netSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>GST ({appliedGstRate}%)</span>
                    <span className="font-mono text-dark font-medium">${calculatedGstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 font-semibold">
                    <span>Calculated Total (Inc. GST)</span>
                    <span className="font-mono text-dark">${calculatedTotalIncGst.toFixed(2)}</span>
                  </div>

                  {/* Final Job Card Amount Override / Confirmation */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-300 pt-5 mt-3 bg-white p-4 rounded-xl border">
                    <div>
                      <span className="font-bold text-dark uppercase tracking-wider text-base block">
                        Final Job Card Amount (Inc. GST)
                      </span>
                      <span className="text-xs text-gray-500">
                        Leave blank to use calculated total (${calculatedTotalIncGst.toFixed(2)}), or enter the approved final amount.
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative w-44">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="finalAmount"
                          value={formData.finalAmount}
                          onChange={handleInputChange}
                          placeholder={calculatedTotalIncGst.toFixed(2)}
                          className="w-full bg-gray-50 border border-gray-300 rounded-lg pl-8 pr-3 py-2.5 text-lg font-bold font-mono text-red-600 focus:border-red-500 focus:bg-white outline-none text-right transition-colors"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={(e) => handleSaveJobCard(e, { finalizeFinancials: true, stayOnPage: true })}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm whitespace-nowrap flex items-center gap-2"
                      >
                        <CheckCircle size={15} />
                        Finalize Amount
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Status</label>
                <div className="flex flex-wrap gap-2">
                  {JOB_CARD_STATUSES.filter(s => s !== 'Completed').map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleInputChange({ target: { name: 'status', value: status } })}
                      className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                        formData.status === status
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.status !== 'Completed') {
                        if (!window.confirm("Are you sure you want to mark this Job Card as Completed? Parts/quantities will be deducted from inventory and Administrators will be notified to finalize the amount.")) {
                          return;
                        }
                      }
                      handleInputChange({ target: { name: 'status', value: 'Completed' } });
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                      formData.status === 'Completed'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              </div>

            {/* Customer Updates Section - Visually Distinct */}
            {id && isAdmin && (
              <div className="border-t border-gray-100 pt-6 mt-6">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare size={18} className="text-blue-600" />
                    <h3 className="font-bold text-blue-900 text-sm uppercase tracking-wider">Customer Updates</h3>
                  </div>
                  <p className="text-blue-700 text-xs mb-4">These messages are visible to the customer through the customer portal.</p>

                  {/* Existing updates */}
                  {customerUpdates.length > 0 ? (
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                      {customerUpdates.map(update => (
                        <div key={update._id} className="bg-white border border-blue-100 rounded-lg px-4 py-3 flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800">{update.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {update.createdBy?.name || 'Staff'} — {new Date(update.createdAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomerUpdate(update._id)}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 mt-1"
                            title="Remove this customer update"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-blue-500 italic mb-4">No customer updates yet.</p>
                  )}

                  {/* New update input */}
                  <div className="flex gap-2">
                    <textarea
                      value={newCustomerUpdate}
                      onChange={(e) => setNewCustomerUpdate(e.target.value)}
                      placeholder="Type a message for the customer..."
                      rows="2"
                      className="flex-1 bg-white border border-blue-200 rounded-lg px-4 py-3 text-sm text-dark focus:border-blue-500 outline-none resize-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleSendCustomerUpdate}
                      disabled={!newCustomerUpdate.trim() || customerUpdateLoading}
                      className="self-end px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
                      title="Send update to customer"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                  <p className="text-[10px] text-blue-600 mt-2 font-medium">⚠ This message will be visible to the customer.</p>
                </div>
              </div>
            )}

            {/* Internal Notes Label */}
            <div className="border-t border-gray-100 pt-6 mt-6">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Internal Notes</label>
              <p className="text-[10px] text-gray-400 mb-2">Visible only to staff. NOT shown to customers.</p>
              <textarea 
                name="notes" value={formData.notes} onChange={handleInputChange} rows="3"
                className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:border-red-500 outline-none resize-none transition-colors"
              ></textarea>
            </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-4 pb-20 border-t border-gray-100 pt-6 mt-6">
              <div className="w-full sm:w-auto">
                {formData.status === 'Completed' && (
                  existingInvoiceId ? (
                    <button type="button" onClick={() => navigate(`/admin/invoices?highlight=${existingInvoiceId}`)} className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-colors flex items-center gap-2">
                      <FileText size={16} />
                      View Invoice {existingInvoiceNumber ? `(${existingInvoiceNumber})` : ''}
                    </button>
                  ) : isAdmin && (
                    formData.financialsFinalized ? (
                      <button type="button" onClick={() => navigate(`/admin/invoices?action=new&jobCardId=${id}`)} className="w-full sm:w-auto justify-center bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-green-500/20 transition-colors flex items-center gap-2">
                        <FileText size={16} />
                        Generate Invoice
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Finalize the Job Card amount above before generating an invoice"
                        className="w-full sm:w-auto justify-center bg-gray-200 text-gray-500 px-6 py-3 rounded-lg font-bold cursor-not-allowed flex items-center gap-2 text-xs uppercase tracking-wider"
                      >
                        <Lock size={15} />
                        Finalize Amount Required Before Invoicing
                      </button>
                    )
                  )
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button type="button" onClick={() => navigate('/admin/job-cards')} className="w-full sm:w-auto justify-center bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto justify-center bg-gray-800 hover:bg-black disabled:opacity-50 text-white px-8 py-3 rounded-lg font-bold transition-colors">
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
                
                {/* Role Specific Workflow Buttons */}
                {isMechanic && formData.status !== 'Completed' && (
                  <button type="button" onClick={() => setShowMechanicModal(true)} className="w-full sm:w-auto justify-center bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-green-500/20 transition-colors">
                    Mark Job Completed
                  </button>
                )}
                {isAdmin && formData.status !== 'Completed' && (
                  <button type="button" onClick={() => setShowAdminModal(true)} className="w-full sm:w-auto justify-center bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-green-500/20 transition-colors">
                    Complete Job Card
                  </button>
                )}
              </div>
            </div>
            
          </form>
        </div>
      </div>

      {/* Mechanic Completion Confirmation Modal */}
      {showMechanicModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-green-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h3 className="text-2xl font-heading text-dark mb-2">Mark Job Card as Completed?</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Are you sure the mechanical work for this Job Card is complete?
              <br /><br />
              Marking this Job Card as <strong>Completed</strong> will deduct used inventory quantities and notify an Administrator to review the completed work and finalize the final amount before invoicing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => setShowMechanicModal(false)}
                className="flex-1 py-3 rounded-lg border border-gray-200 text-dark font-bold uppercase tracking-wider text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={(e) => {
                  setShowMechanicModal(false);
                  handleSaveJobCard(e, { overrideStatus: 'Completed' });
                }}
                className="flex-1 py-3 rounded-lg bg-green-600 text-white font-bold uppercase tracking-wider text-xs hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20"
              >
                Confirm Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Completion Confirmation Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-green-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={32} className="text-green-500" />
            </div>
            <h3 className="text-2xl font-heading text-dark mb-2">Complete Job Card?</h3>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Mark this Job Card as completed and deduct the used inventory parts?
              <br /><br />
              You can also finalize the final amount so the Job Card is immediately ready for invoice generation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowAdminModal(false)}
                className="flex-1 py-3 rounded-lg border border-gray-200 text-dark font-bold uppercase tracking-wider text-xs hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={(e) => {
                  setShowAdminModal(false);
                  handleSaveJobCard(e, { overrideStatus: 'Completed', finalizeFinancials: true, stayOnPage: true });
                }}
                className="flex-1 py-3 rounded-lg bg-green-600 text-white font-bold uppercase tracking-wider text-xs hover:bg-green-700 transition-colors shadow-lg shadow-green-500/20"
              >
                Complete &amp; Finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditJobCard;
