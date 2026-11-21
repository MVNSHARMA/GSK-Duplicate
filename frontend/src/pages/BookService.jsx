import React, { useState, useEffect, useMemo } from 'react';
import { Settings, ShieldCheck, PenTool, Calendar as CalendarIcon, Clock, Upload, Edit3, User, CheckCircle, X, FileCheck } from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useToast } from '../components/ui/ToastContext';
import { 
  getSydneyNow, 
  getTodaySydneyDateString, 
  formatSydneyDateString, 
  isSlotPastInSydney, 
  isDayInPastInSydney, 
  MONTH_NAMES, 
  DAY_NAMES 
} from '../utils/sydneyTime';

// Service ids that can be preselected via /book-service?service=<id> (must match the ids in servicesList and the backend).
const PREFILL_SERVICES = ['Pink Slip', 'Blue Slip', 'Import Compliance'];
const IMPORT_COMPLIANCE = 'Import Compliance';
const IMPORT_APPROVAL_STATUSES = ['Approved', 'Application in Progress', 'Not Yet Applied', 'Not Sure'];

const defaultImportInfo = { vin: '', countryOfOrigin: '', approvalStatus: '', additionalInfo: '' };
const hasImportCompliance = (vehicle) => vehicle.selectedServices.includes(IMPORT_COMPLIANCE);

const BookService = () => {
  const toast = useToast();
  const monthNames = MONTH_NAMES;
  const dayNames = DAY_NAMES;
  
  const initialSydney = getSydneyNow();
  const initialFormatted = getTodaySydneyDateString();

  const defaultVehicle = {
    make: '', model: '', year: '', regNo: '', kilometers: '', transmission: 'automatic', fuelType: '', engineSize: '', selectedServices: [],
    // Kept in state even while Import Compliance is deselected so entries are not lost when toggling services.
    importInfo: { ...defaultImportInfo }
  };

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', phone: '', email: '', contactMethod: 'email',
    vehicles: [{ ...defaultVehicle }],
    date: initialFormatted, time: '',
    additionalInfo: ''
  });

  const [selectedFiles, setSelectedFiles] = useState([]);

  const { token } = useAuth();

  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const serviceParam = searchParams.get('service');
    if (PREFILL_SERVICES.includes(serviceParam)) {
      setFormData(prev => {
        const newVehicles = [...prev.vehicles];
        newVehicles[0] = { ...newVehicles[0], selectedServices: [serviceParam] };
        return { ...prev, vehicles: newVehicles };
      });
    }
  }, [location.search]);

  const handleFileChange = (e) => {
    let files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length + selectedFiles.length > 5) {
      alert('You can upload a maximum of 5 images.');
      return;
    }
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const servicesList = [
    { id: 'mechanical', label: 'All Mechanical Repairs', icon: Settings },
    { id: 'engine', label: 'Engine Transmission', icon: Settings },
    { id: 'inspection', label: 'Pre Purchase Inspection', icon: ShieldCheck },
    { id: 'batteries', label: 'Batteries and Starters', icon: PenTool },
    { id: 'belts', label: 'Belts & Hoses', icon: Settings },
    { id: 'oil', label: 'Basic oil service', icon: PenTool },
    { id: 'ac', label: 'Air Conditioning', icon: ShieldCheck },
    { id: 'brakes', label: 'Brakes & Clutches', icon: Settings },
    { id: 'Pink Slip', label: 'Pink Slip Inspection', icon: CheckCircle },
    { id: 'Blue Slip', label: 'Blue Slip Inspection', icon: ShieldCheck },
    { id: IMPORT_COMPLIANCE, label: 'Import Compliance', icon: FileCheck },
  ];
  
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Timezone-aware live ticking to dynamically expire slots as time advances
  const [nowSydneyTick, setNowSydneyTick] = useState(() => new Date());

  useEffect(() => {
    const updateTick = () => {
      setNowSydneyTick(new Date());
    };

    // Periodic check every 10s to dynamically remove past slots
    const intervalId = setInterval(updateTick, 10000);

    // Refresh immediately when returning to tab/window
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateTick();
        setRefreshTrigger(prev => prev + 1);
      }
    };

    const handleFocus = () => {
      updateTick();
      setRefreshTrigger(prev => prev + 1);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!formData.date) return;
    
    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/slots?date=${encodeURIComponent(formData.date)}`);
        const data = await res.json();
        if (data.success) {
          setSlots(data.data);
        }
      } catch (err) {
        console.error(err);
      }
      setSlotsLoading(false);
    };
    
    fetchSlots();
  }, [formData.date, refreshTrigger]);

  // Dynamically filter out past slots in Australia/Sydney timezone
  const visibleSlots = useMemo(() => {
    return slots.filter(slot => {
      if (slot.isPast || slot.status === 'Past') return false;
      if (isSlotPastInSydney(formData.date, slot.time, nowSydneyTick)) return false;
      return true;
    });
  }, [slots, formData.date, nowSydneyTick]);

  // Re-evaluate selected time whenever visible slots or vehicle count changes
  useEffect(() => {
    if (!formData.date) return;
    const neededCapacity = formData.vehicles.length;

    if (!formData.time) {
      const firstAvailable = visibleSlots.find(s => s.status === 'Available' && s.remaining >= neededCapacity);
      if (firstAvailable) {
        setFormData(prev => ({ ...prev, time: firstAvailable.time }));
      }
      return;
    }

    const currentSlot = visibleSlots.find(s => s.time === formData.time);
    if (!currentSlot || currentSlot.status !== 'Available' || currentSlot.remaining < neededCapacity) {
      const firstAvailable = visibleSlots.find(s => s.status === 'Available' && s.remaining >= neededCapacity);
      setFormData(prev => ({ ...prev, time: firstAvailable ? firstAvailable.time : '' }));
    }
  }, [visibleSlots, formData.time, formData.vehicles.length, formData.date]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleVehicleChange = (index, e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newVehicles = [...prev.vehicles];
      newVehicles[index] = { ...newVehicles[index], [name]: value };
      return { ...prev, vehicles: newVehicles };
    });
  };

  const handleVehicleImportChange = (index, e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newVehicles = [...prev.vehicles];
      newVehicles[index] = {
        ...newVehicles[index],
        importInfo: { ...(newVehicles[index].importInfo || defaultImportInfo), [name]: value }
      };
      return { ...prev, vehicles: newVehicles };
    });
  };

  const toggleService = (index, id) => {
    setFormData(prev => {
      const newVehicles = [...prev.vehicles];
      const vehicle = newVehicles[index];
      const isSelected = vehicle.selectedServices.includes(id);
      newVehicles[index] = {
        ...vehicle,
        selectedServices: isSelected
          ? vehicle.selectedServices.filter(s => s !== id)
          : [...vehicle.selectedServices, id]
      };
      return { ...prev, vehicles: newVehicles };
    });
  };

  const addVehicle = () => {
    if (formData.vehicles.length >= 3) return;
    setFormData(prev => ({
      ...prev,
      vehicles: [...prev.vehicles, { ...defaultVehicle }]
    }));
  };

  const removeVehicle = (index) => {
    setFormData(prev => {
      const newVehicles = prev.vehicles.filter((_, i) => i !== index);
      return { ...prev, vehicles: newVehicles };
    });
  };

  const [status, setStatus] = useState({ loading: false, success: false, message: '' });

  const [calendarView, setCalendarView] = useState({
    year: initialSydney.year,
    month: initialSydney.monthIndex
  });
  const year = calendarView.year;
  const month = calendarView.month;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const startDay = (firstDay + 6) % 7;
  const prevMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const handlePrevMonth = () => {
    setCalendarView(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCalendarView(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const handleDateSelect = (day) => {
    if (isDayInPastInSydney(year, month, day, nowSydneyTick)) {
      return;
    }
    const formattedDate = formatSydneyDateString(year, month, day);
    setFormData(prev => ({ ...prev, date: formattedDate }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.time) {
       setStatus({ loading: false, success: false, message: 'Please select a valid time slot that has enough capacity for your vehicles.' });
       return;
    }

    // Import Compliance: required imported-vehicle fields (make/model are already required by the form).
    const maxYear = new Date().getFullYear() + 1;
    for (let i = 0; i < formData.vehicles.length; i++) {
      const v = formData.vehicles[i];
      if (!v.selectedServices.includes(IMPORT_COMPLIANCE)) continue;
      const info = v.importInfo || defaultImportInfo;
      const prefix = formData.vehicles.length > 1 ? `Vehicle ${i + 1}: ` : '';
      const yearNum = parseInt(v.year, 10);
      let problem = '';
      if (!v.make.trim() || !v.model.trim()) problem = 'Vehicle make and model are required for Import Compliance.';
      else if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > maxYear) problem = `Please enter a valid manufacturing year (1900 - ${maxYear}) for Import Compliance.`;
      else if (!info.vin.trim()) problem = 'VIN / Chassis number is required for Import Compliance.';
      else if (!info.countryOfOrigin.trim()) problem = 'Country of origin is required for Import Compliance.';
      else if (!IMPORT_APPROVAL_STATUSES.includes(info.approvalStatus)) problem = 'Please select an import approval status.';
      if (problem) {
        setStatus({ loading: false, success: false, message: prefix + problem });
        document.getElementById(`import-info-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setStatus({ loading: true, success: false, message: '' });

    const [fName, ...lNameParts] = (formData.firstName || '').trim().split(' ');
    const lName = lNameParts.length > 0 ? lNameParts.join(' ') : '-';

    const body = new FormData();
    body.append('customerInfo', JSON.stringify({
      firstName: fName || 'Unknown',
      lastName: lName,
      phone: formData.phone,
      email: formData.email,
      contactMethod: formData.contactMethod
    }));
    
    const vehiclesPayload = formData.vehicles.map(v => ({
       vehicleInfo: {
          make: v.make, model: v.model, year: parseInt(v.year) || null,
          regNo: v.regNo, kilometers: parseInt(v.kilometers) || null,
          transmission: v.transmission, fuelType: v.fuelType, engineSize: v.engineSize
       },
       services: v.selectedServices,
       // Only sent when Import Compliance is selected; hidden-but-retained entries are never submitted.
       ...(v.selectedServices.includes(IMPORT_COMPLIANCE) ? {
         importVehicleInfo: {
           vin: v.importInfo.vin.trim(),
           countryOfOrigin: v.importInfo.countryOfOrigin.trim(),
           approvalStatus: v.importInfo.approvalStatus,
           additionalInfo: v.importInfo.additionalInfo.trim()
         }
       } : {})
    }));
    
    body.append('vehicles', JSON.stringify(vehiclesPayload));
    
    body.append('appointment', JSON.stringify({
      date: formData.date,
      time: formData.time
    }));
    body.append('additionalInfo', formData.additionalInfo);

    selectedFiles.forEach(file => body.append('images', file));

    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${import.meta.env.VITE_API_URL}/intake/book`, {
        method: 'POST',
        headers,
        body
      });
      const data = await response.json();
      if (response.ok) {
        const refMsg = data.bookingReference ? ` Reference: ${data.bookingReference}.` : '';
        setStatus({ 
          loading: false, 
          success: true, 
          message: `Booking request submitted successfully!${refMsg} A confirmation email with your booking details has been sent to your inbox.` 
        });
        setTimeout(() => {
          setFormData({ firstName: '', lastName: '', phone: '', email: '', contactMethod: 'email', vehicles: [{...defaultVehicle}], date: getTodaySydneyDateString(), time: '', additionalInfo: '' });
          setSelectedFiles([]);
        }, 6000);
      } else {
        setStatus({ loading: false, success: false, message: data.error || 'Failed to submit.' });
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      setStatus({ loading: false, success: false, message: '' });
      toast.error('Server error. Please try again later.');
    }
  };

  return (
    <PageWrapper className="bg-lightBg min-h-screen pt-[120px] pb-20">
      <div className="text-center mb-10">
        <h1 className="font-bold text-3xl text-dark mb-2">Book Your Service</h1>
        <p className="text-gray-500 text-sm">Fast, easy and secure online booking</p>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col lg:flex-row gap-8 lg:gap-16">
        <div className="lg:w-[65%]">
          <form onSubmit={handleSubmit}>
            
            {status.message && (
              <div className={`p-4 rounded-lg mb-6 border ${status.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {status.message}
              </div>
            )}

            {/* Step 1: Your Details */}
            <div className="mb-12" id="step-1">
              <div className="flex items-center gap-4 mb-6">
                <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</span>
                <h3 className="font-bold text-lg text-dark">Your Details</h3>
                <div className="flex-1 h-[1px] bg-gray-200 ml-4"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Full Name</label>
                  <input required type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Phone No.</label>
                  <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Email Address</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Preferred Contact Method</label>
                  <div className="flex gap-6 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
                      <input type="radio" name="contactMethod" value="call" checked={formData.contactMethod === 'call'} onChange={handleChange} className="accent-primary w-4 h-4" /> Call
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
                      <input type="radio" name="contactMethod" value="email" checked={formData.contactMethod === 'email'} onChange={handleChange} className="accent-primary w-4 h-4" /> Email
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Vehicles Section */}
            {formData.vehicles.map((vehicle, index) => (
              <div key={index} className="mb-12" id={`step-vehicle-${index}`}>
                <div className="flex items-center gap-4 mb-6">
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">{index + 2}</span>
                  <h3 className="font-bold text-lg text-dark">Vehicle {index + 1} Details & Services</h3>
                  <div className="flex-1 h-[1px] bg-gray-200 ml-4"></div>
                  {formData.vehicles.length > 1 && (
                    <button type="button" onClick={() => removeVehicle(index)} className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1 transition-colors">
                      <X size={16} /> Remove
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Vehicle Make</label>
                    <input required type="text" name="make" value={vehicle.make} onChange={(e) => handleVehicleChange(index, e)} placeholder="e.g. Toyota" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Vehicle Model</label>
                    <input required type="text" name="model" value={vehicle.model} onChange={(e) => handleVehicleChange(index, e)} placeholder="e.g. Camry" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Year{hasImportCompliance(vehicle) && <span className="text-primary"> *</span>}</label>
                    <input type="text" name="year" value={vehicle.year} onChange={(e) => handleVehicleChange(index, e)} placeholder={hasImportCompliance(vehicle) ? 'Manufacturing year, e.g. 2018' : 'e.g. 2018'} required={hasImportCompliance(vehicle)} pattern={hasImportCompliance(vehicle) ? '(19|20)[0-9]{2}' : undefined} title={hasImportCompliance(vehicle) ? 'Enter a 4-digit year, e.g. 2018' : undefined} className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Rego No</label>
                    <input required type="text" name="regNo" value={vehicle.regNo} onChange={(e) => handleVehicleChange(index, e)} placeholder="eg ABC 123" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Current Kilometers</label>
                    <input type="text" name="kilometers" value={vehicle.kilometers} onChange={(e) => handleVehicleChange(index, e)} placeholder="eg 70000kms" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Transmission</label>
                    <div className="flex gap-4 mt-3">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
                        <input type="radio" name="transmission" value="automatic" checked={vehicle.transmission === 'automatic'} onChange={(e) => handleVehicleChange(index, e)} className="accent-primary w-4 h-4" /> Auto
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
                        <input type="radio" name="transmission" value="manual" checked={vehicle.transmission === 'manual'} onChange={(e) => handleVehicleChange(index, e)} className="accent-primary w-4 h-4" /> Manual
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Fuel Type</label>
                    <input required type="text" name="fuelType" value={vehicle.fuelType} onChange={(e) => handleVehicleChange(index, e)} placeholder="e.g. Petrol" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Engine Size (Optional)</label>
                    <input type="text" name="engineSize" value={vehicle.engineSize} onChange={(e) => handleVehicleChange(index, e)} placeholder="eg 2000cc" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                  </div>
                </div>

                <h4 className="font-bold text-sm text-dark mb-4">Select Services for Vehicle {index + 1}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {servicesList.map((srv) => (
                    <div 
                      key={srv.id} 
                      onClick={() => toggleService(index, srv.id)}
                      className={`relative border rounded-lg p-4 cursor-pointer transition-all bg-white ${
                        vehicle.selectedServices.includes(srv.id) ? 'border-primary bg-red-50/10' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="absolute top-3 right-3">
                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                          vehicle.selectedServices.includes(srv.id) ? 'bg-primary border-primary text-white' : 'border-gray-300 bg-white'
                        }`}>
                          {vehicle.selectedServices.includes(srv.id) && <span className="text-[10px]">✓</span>}
                        </div>
                      </div>
                      <h4 className="font-bold text-dark text-xs mb-4 pr-6 leading-tight h-8">{srv.label}</h4>
                      <div className="flex justify-end">
                        <srv.icon className="text-primary stroke-[1.5]" size={24} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Conditional: imported vehicle details (only while Import Compliance is selected) */}
                {hasImportCompliance(vehicle) && (
                  <div id={`import-info-${index}`} className="mt-8 border border-gray-200 rounded-xl p-5 md:p-6 bg-white">
                    <h4 className="font-bold text-sm text-dark mb-1 flex items-center gap-2">
                      <FileCheck size={16} className="text-primary" /> Imported Vehicle Information
                    </h4>
                    <p className="text-xs text-gray-500 mb-5">
                      Vehicle make, model and manufacturing year are taken from the vehicle details above. Please tell us a little more about the imported vehicle.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">VIN / Chassis Number <span className="text-primary">*</span></label>
                        <input required type="text" name="vin" maxLength={50} value={vehicle.importInfo?.vin || ''} onChange={(e) => handleVehicleImportChange(index, e)} placeholder="e.g. JZX100-0012345" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary uppercase" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">Country of Origin <span className="text-primary">*</span></label>
                        <input required type="text" name="countryOfOrigin" maxLength={80} value={vehicle.importInfo?.countryOfOrigin || ''} onChange={(e) => handleVehicleImportChange(index, e)} placeholder="e.g. Japan" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-2">Import Approval Status <span className="text-primary">*</span></label>
                        <select required name="approvalStatus" value={vehicle.importInfo?.approvalStatus || ''} onChange={(e) => handleVehicleImportChange(index, e)} className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary">
                          <option value="" disabled>Select status</option>
                          {IMPORT_APPROVAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">Additional Information (Optional)</label>
                      <textarea name="additionalInfo" maxLength={1000} rows="3" value={vehicle.importInfo?.additionalInfo || ''} onChange={(e) => handleVehicleImportChange(index, e)} placeholder="Anything else we should know about the import, e.g. documents you already have" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary resize-none"></textarea>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Another Vehicle Button */}
            {formData.vehicles.length < 3 && (
              <div className="mb-12 flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <button type="button" onClick={addVehicle} className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 text-dark font-bold rounded-lg hover:border-primary hover:text-primary transition-all shadow-sm">
                  + Add Another Vehicle
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">Need to service multiple cars? Add up to 3 vehicles in a single booking!</p>
              </div>
            )}

            {/* Choose Date & Time */}
            <div className="mb-10" id="step-datetime">
              <div className="flex items-center gap-4 mb-6">
                <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">{formData.vehicles.length + 2}</span>
                <h3 className="font-bold text-lg text-dark">Choose Date & Time</h3>
                <div className="flex-1 h-[1px] bg-gray-200 ml-4"></div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col items-center select-none">
                  <div className="flex justify-between w-full mb-4 font-bold text-dark">
                    <span className="text-primary cursor-pointer px-2 hover:scale-125 transition-transform" onClick={handlePrevMonth}>&lt;</span>
                    <span>{monthNames[month]} {year}</span>
                    <span className="text-primary cursor-pointer px-2 hover:scale-125 transition-transform" onClick={handleNextMonth}>&gt;</span>
                  </div>
                  <div className="grid grid-cols-7 w-full text-center text-xs text-gray-400 font-bold mb-2">
                    <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
                  </div>
                  <div className="grid grid-cols-7 w-full text-center text-sm font-bold gap-y-4 text-dark items-center">
                    {[...Array(startDay)].map((_, i) => (
                      <span key={`prev-${i}`} className="text-gray-300">{prevMonthDays - startDay + i + 1}</span>
                    ))}
                    {[...Array(daysInMonth)].map((_, i) => {
                      const day = i + 1;
                      const formattedDate = formatSydneyDateString(year, month, day);
                      const isSelected = formData.date === formattedDate;
                      const isPastDay = isDayInPastInSydney(year, month, day, nowSydneyTick);
                      return (
                        <span 
                          key={day} 
                          onClick={() => { if (!isPastDay) handleDateSelect(day); }}
                          className={`w-7 h-7 mx-auto flex items-center justify-center rounded-full transition-colors ${
                            isPastDay 
                              ? 'text-gray-300 cursor-not-allowed select-none' 
                              : isSelected 
                                ? 'bg-primary text-white cursor-pointer' 
                                : 'hover:text-primary cursor-pointer'
                          }`}
                        >
                          {day}
                        </span>
                      );
                    })}
                    {[...Array(Math.max(0, 42 - daysInMonth - startDay))].map((_, i) => (
                      <span key={`next-${i}`} className="text-gray-300">{i + 1}</span>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <p className="text-xs text-gray-500 mb-1">Available Times for</p>
                  <p className="text-sm font-bold text-primary mb-4">{formData.date}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {slotsLoading ? (
                      <div className="col-span-full text-center text-xs text-gray-400 py-4">Loading slots...</div>
                    ) : visibleSlots.length > 0 ? visibleSlots.map((slot, idx) => {
                      const capacityNeeded = formData.vehicles.length;
                      const isAvailable = slot.status === 'Available' && slot.remaining >= capacityNeeded;
                      const isSelected = formData.time === slot.time;
                      return (
                        <div 
                          key={idx} 
                          onClick={() => { if (isAvailable) setFormData({...formData, time: slot.time}) }}
                          className={`py-2 px-1 text-center text-xs font-bold rounded border transition-colors ${
                            isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                          } ${
                            isSelected && isAvailable ? 'bg-primary border-primary text-white' : 
                            isAvailable ? 'border-red-200 text-primary hover:bg-red-50' :
                            'border-gray-200 text-gray-400 bg-gray-50'
                          }`}
                        >
                          {slot.time}
                          {!isAvailable && <span className="block text-[9px] font-normal mt-0.5">{slot.remaining < capacityNeeded && slot.remaining > 0 ? `Need ${capacityNeeded} spaces` : slot.status}</span>}
                          {isAvailable && slot.remaining <= 3 && <span className="block text-[9px] font-normal mt-0.5 text-orange-500">{slot.remaining} left</span>}
                        </div>
                      )
                    }) : (
                      <div className="col-span-full text-center text-xs text-gray-400 py-4">No slots available for this date.</div>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-gray-400 text-xs">
                    <Clock size={14} className="shrink-0 mt-0.5" />
                    <p>Time slots require enough capacity for all {formData.vehicles.length} vehicle(s).</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Additional Information</label>
                  <textarea name="additionalInfo" value={formData.additionalInfo} onChange={handleChange} placeholder="Tell us about any issue with your vehicle" rows="3" className="w-full bg-white border border-gray-200 rounded p-3 text-sm outline-none focus:border-primary resize-none"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Upload some pictures <span className="text-gray-400 font-normal">(max 5)</span></label>
                  <label className="w-full bg-white border border-dashed border-gray-300 rounded p-6 flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 hover:border-primary transition-colors h-[86px]">
                    <Upload className="text-primary" size={18} />
                    <span className="text-xs font-bold text-dark">{selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'Choose files'}</span>
                    <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                  </label>
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-3">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="relative group">
                          <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                          <button type="button" onClick={() => removeFile(idx)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button disabled={status.loading || !formData.time} className="w-full bg-primary text-white font-bold text-lg py-4 rounded-lg hover:bg-primary-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                {status.loading ? 'Submitting...' : 'Submit Booking'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Sticky Sidebar - Booking Summary */}
        <div className="lg:w-[35%] relative">
          <div className="sticky top-32 bg-white rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-gray-100">
            <h3 className="font-bold text-xl text-dark mb-6 flex items-center gap-2">Your Booking Summary <span className="text-xs bg-red-100 text-primary px-2 py-1 rounded-full">{formData.vehicles.length} Vehicle(s)</span></h3>

            {/* Customer Summary */}
            <div className="mb-6 relative">
              <div className="flex items-center gap-3 mb-2">
                <User size={18} className="text-dark" />
                <h4 className="font-bold text-dark text-sm">Customer</h4>
                <button type="button" onClick={() => document.getElementById('step-1')?.scrollIntoView({ behavior: 'smooth' })} className="absolute right-0 top-0 text-primary text-xs hover:text-primary-dark font-bold uppercase tracking-wider cursor-pointer transition-colors">Edit</button>
              </div>
              <div className="text-sm text-gray-600 space-y-1.5 pl-8">
                <p>{formData.firstName || 'First Name'} {formData.lastName}</p>
                <p>{formData.phone || 'Phone Number'}</p>
                <p>{formData.email || 'Email Address'}</p>
                <p>Contact: {formData.contactMethod}</p>
              </div>
              <div className="h-[1px] bg-gray-100 mt-4 ml-8"></div>
            </div>

            {/* Vehicles Summary */}
            {formData.vehicles.map((v, index) => (
              <div key={index} className="mb-6 relative">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck size={18} className="text-dark" />
                  <h4 className="font-bold text-dark text-sm">Vehicle {index + 1}</h4>
                  <button type="button" onClick={() => document.getElementById(`step-vehicle-${index}`)?.scrollIntoView({ behavior: 'smooth' })} className="absolute right-0 top-0 text-primary text-xs hover:text-primary-dark font-bold uppercase tracking-wider cursor-pointer transition-colors">Edit</button>
                </div>
                <div className="text-sm text-gray-600 space-y-1.5 pl-8">
                  <p className="font-bold text-dark">{v.regNo || 'Rego Pending'}</p>
                  <p>{v.make || 'Make'} {v.model || 'Model'} {v.year || ''}</p>
                  
                  <div className="mt-3 bg-gray-50 p-2 rounded border border-gray-100">
                    <p className="text-xs font-bold text-gray-800 mb-1 flex items-center gap-1"><Settings size={12}/> Requested Services:</p>
                    <ul className="text-xs text-gray-600 space-y-1 pl-4 list-disc list-inside">
                      {v.selectedServices.length > 0 ? (
                        v.selectedServices.map(id => (
                          <li key={id}>{servicesList.find(s => s.id === id)?.label}</li>
                        ))
                      ) : (
                        <li>General Inspection (Default)</li>
                      )}
                    </ul>
                    {hasImportCompliance(v) && (v.importInfo?.vin || v.importInfo?.countryOfOrigin) && (
                      <p className="text-xs text-gray-500 mt-2 pl-1">
                        {[v.importInfo.vin && `VIN/Chassis: ${v.importInfo.vin.toUpperCase()}`, v.importInfo.countryOfOrigin && `Origin: ${v.importInfo.countryOfOrigin}`].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-[1px] bg-gray-100 mt-4 ml-8"></div>
              </div>
            ))}

            {/* Date & Time Summary */}
            <div className="mb-6 relative">
              <div className="flex items-center gap-3 mb-2">
                <CalendarIcon size={18} className="text-dark" />
                <h4 className="font-bold text-dark text-sm">Date & Time</h4>
                <button type="button" onClick={() => document.getElementById('step-datetime')?.scrollIntoView({ behavior: 'smooth' })} className="absolute right-0 top-0 text-primary text-xs hover:text-primary-dark font-bold uppercase tracking-wider cursor-pointer transition-colors">Edit</button>
              </div>
              <div className="text-sm text-gray-600 space-y-2 pl-8">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={12} />
                  <span className={!formData.date ? 'text-red-400' : ''}>{formData.date || 'Select a date'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={12} />
                  <span className={!formData.time ? 'text-red-400 font-bold' : ''}>{formData.time || 'Select a time slot'}</span>
                </div>
              </div>
              <div className="h-[1px] bg-gray-100 mt-4 ml-8"></div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default BookService;
