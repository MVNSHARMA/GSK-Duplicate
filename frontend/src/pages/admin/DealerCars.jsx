import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Car, Plus, Edit2, Trash2, X, CheckCircle, Store, DollarSign, Wrench, Receipt, Download, Search, ChevronLeft, ChevronRight, Upload, FileText, Eye, MapPin, CreditCard, ExternalLink, AlertCircle
} from 'lucide-react';

import { downloadCSV } from '../../utils/exportCsv';

const ALLOWED_LICENSE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_LICENSE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'Other'];

const emptyBuyerDetails = {
  buyerName: '',
  buyerPhone: '',
  buyerEmail: '',
  licenseNumber: '',
  licenseHolderName: '',
  licenseIssuingState: '',
  licenseExpiryDate: '',
  licenseClass: '',
  licenseDocumentUrl: '',
  licenseDocumentName: '',
  licenseDocumentMimeType: '',
  licenseDocumentSize: null,
  addressLine1: '',
  addressLine2: '',
  suburb: '',
  state: '',
  postcode: '',
  country: 'Australia'
};

const DealerCars = () => {
  const [cars, setCars] = useState([]);
  const [metrics, setMetrics] = useState({
    inStock: 0,
    sold: 0,
    costInStock: 0,
    actualProfit: 0
  });
  
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const abortControllerRef = useRef(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSoldModalOpen, setIsSoldModalOpen] = useState(false);
  const [viewingBuyerCar, setViewingBuyerCar] = useState(null);
  const [currentCarId, setCurrentCarId] = useState(null);
  const [editingCar, setEditingCar] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const defaultFormData = {
    make: '', model: '', year: '', registrationNumber: '', vin: '',
    mileage: '', colour: '', purchaseDate: new Date().toISOString().split('T')[0],
    dealerName: '', cost: '', sellPrice: '', notes: '',
    status: 'In Stock', soldDate: '', soldFor: '',
    ...emptyBuyerDetails
  };

  const [formData, setFormData] = useState(defaultFormData);
  const [editLicenseFile, setEditLicenseFile] = useState(null);
  const [editLicensePreview, setEditLicensePreview] = useState('');
  const [editRemoveLicenseDoc, setEditRemoveLicenseDoc] = useState(false);
  const [editFileError, setEditFileError] = useState('');

  // Mark as Sold modal state
  const [soldForAmount, setSoldForAmount] = useState('');
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split('T')[0]);
  const [soldBuyerData, setSoldBuyerData] = useState(emptyBuyerDetails);
  const [soldLicenseFile, setSoldLicenseFile] = useState(null);
  const [soldLicensePreview, setSoldLicensePreview] = useState('');
  const [soldRemoveLicenseDoc, setSoldRemoveLicenseDoc] = useState(false);
  const [soldFileError, setSoldFileError] = useState('');

  const fetchCars = useCallback(async (page = 1) => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const token = localStorage.getItem('gsk_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      params.append('page', page);
      params.append('limit', 50);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/dealer-cars?${params}`, { 
        headers, 
        signal: abortControllerRef.current.signal 
      });
      const data = await res.json();
      
      if (data.success) {
        setCars(data.data);
        setMetrics(data.metrics);
        setPagination(data.pagination);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch cars:", error);
      }
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchCars(1);
  }, [fetchCars]);

  const fetchData = () => fetchCars(pagination.page);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSoldBuyerChange = (e) => {
    setSoldBuyerData({ ...soldBuyerData, [e.target.name]: e.target.value });
  };

  const validateAndSelectFile = (file, setFile, setPreview, setError, setRemoveFlag) => {
    setError('');
    if (!file) return;

    if (!ALLOWED_LICENSE_TYPES.includes(file.type)) {
      setError('Unsupported file format. Please upload a JPG, JPEG, PNG, WEBP image or PDF document.');
      return;
    }

    if (file.size > MAX_LICENSE_FILE_SIZE) {
      setError('File size exceeds the 10MB maximum limit.');
      return;
    }

    setFile(file);
    if (setRemoveFlag) setRemoveFlag(false);

    if (file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
    } else {
      setPreview('');
    }
  };

  const extractBuyerDetailsFromCar = (car) => ({
    buyerName: car.buyerName || car.buyerId?.name || '',
    buyerPhone: car.buyerPhone || '',
    buyerEmail: car.buyerEmail || car.buyerId?.email || '',
    licenseNumber: car.buyerLicense?.licenseNumber || '',
    licenseHolderName: car.buyerLicense?.holderName || '',
    licenseIssuingState: car.buyerLicense?.issuingState || '',
    licenseExpiryDate: car.buyerLicense?.expiryDate ? new Date(car.buyerLicense.expiryDate).toISOString().split('T')[0] : '',
    licenseClass: car.buyerLicense?.licenseClass || '',
    licenseDocumentUrl: car.buyerLicense?.documentUrl || '',
    licenseDocumentName: car.buyerLicense?.documentName || '',
    licenseDocumentMimeType: car.buyerLicense?.documentMimeType || '',
    licenseDocumentSize: car.buyerLicense?.documentSize || null,
    addressLine1: car.buyerAddress?.addressLine1 || '',
    addressLine2: car.buyerAddress?.addressLine2 || '',
    suburb: car.buyerAddress?.suburb || '',
    state: car.buyerAddress?.state || '',
    postcode: car.buyerAddress?.postcode || '',
    country: car.buyerAddress?.country || 'Australia'
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCar(null);
    setFormData(defaultFormData);
    setEditLicenseFile(null);
    setEditLicensePreview('');
    setEditRemoveLicenseDoc(false);
    setEditFileError('');
  };

  const handleCloseSoldModal = () => {
    setIsSoldModalOpen(false);
    setCurrentCarId(null);
    setSoldForAmount('');
    setSoldDate(new Date().toISOString().split('T')[0]);
    setSoldBuyerData(emptyBuyerDetails);
    setSoldLicenseFile(null);
    setSoldLicensePreview('');
    setSoldRemoveLicenseDoc(false);
    setSoldFileError('');
  };

  const handleOpenSoldModal = (car) => {
    setCurrentCarId(car._id);
    setSoldForAmount(car.soldFor || car.sellPrice || '');
    setSoldDate(car.soldDate ? new Date(car.soldDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setSoldBuyerData(extractBuyerDetailsFromCar(car));
    setSoldLicenseFile(null);
    setSoldLicensePreview('');
    setSoldRemoveLicenseDoc(false);
    setSoldFileError('');
    setIsSoldModalOpen(true);
  };

  const buildBuyerPayloadObject = (source, removeDocFlag) => ({
    buyerName: source.buyerName || '',
    buyerPhone: source.buyerPhone || '',
    buyerEmail: source.buyerEmail || '',
    removeLicenseDocument: removeDocFlag,
    buyerLicense: {
      licenseNumber: source.licenseNumber || '',
      holderName: source.licenseHolderName || '',
      issuingState: source.licenseIssuingState || '',
      expiryDate: source.licenseExpiryDate || null,
      licenseClass: source.licenseClass || ''
    },
    buyerAddress: {
      addressLine1: source.addressLine1 || '',
      addressLine2: source.addressLine2 || '',
      suburb: source.suburb || '',
      state: source.state || '',
      postcode: source.postcode || '',
      country: source.country || 'Australia'
    }
  });

  const sendDealerCarRequest = async ({ url, method, payload, licenseFile }) => {
    const token = localStorage.getItem('gsk_token');

    if (licenseFile) {
      const multipartData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (typeof value === 'object') {
          multipartData.append(key, JSON.stringify(value));
        } else {
          multipartData.append(key, String(value));
        }
      });
      multipartData.append('licenseDocument', licenseFile);

      return fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: multipartData
      });
    }

    return fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  };

  const handleAddCar = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const method = editingCar ? 'PUT' : 'POST';
      const url = editingCar 
        ? `${import.meta.env.VITE_API_URL}/dealer-cars/${editingCar._id}`
        : `${import.meta.env.VITE_API_URL}/dealer-cars`;

      const buyerPayload = buildBuyerPayloadObject(formData, editRemoveLicenseDoc);
      const payload = {
        make: formData.make,
        model: formData.model,
        year: formData.year,
        registrationNumber: formData.registrationNumber,
        vin: formData.vin,
        mileage: formData.mileage,
        colour: formData.colour,
        purchaseDate: formData.purchaseDate,
        dealerName: formData.dealerName,
        cost: Number(formData.cost),
        sellPrice: Number(formData.sellPrice),
        notes: formData.notes,
        status: formData.status,
        soldDate: formData.soldDate || undefined,
        soldFor: formData.soldFor ? Number(formData.soldFor) : undefined,
        ...buyerPayload
      };

      const response = await sendDealerCarRequest({
        url,
        method,
        payload,
        licenseFile: editLicenseFile
      });
      const data = await response.json();
      if (data.success) {
        handleCloseModal();
        fetchData();
      } else {
        alert(data.error || 'Failed to save dealer car.');
      }
    } catch (error) {
      console.error("Failed to save car:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (car) => {
    setEditingCar(car);
    setEditLicenseFile(null);
    setEditLicensePreview('');
    setEditRemoveLicenseDoc(false);
    setEditFileError('');
    setFormData({
      make: car.make || car.vehicleId?.brand || '',
      model: car.model || car.vehicleId?.model || '',
      year: car.year || car.vehicleId?.year || '',
      registrationNumber: car.registrationNumber || car.vehicleId?.registrationNumber || '',
      vin: car.vin || '',
      mileage: car.mileage || '',
      colour: car.colour || '',
      purchaseDate: car.purchaseDate ? new Date(car.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dealerName: car.dealerName || '',
      cost: car.cost || '',
      sellPrice: car.sellPrice || '',
      notes: car.notes || '',
      status: car.status || 'In Stock',
      soldDate: car.soldDate ? new Date(car.soldDate).toISOString().split('T')[0] : '',
      soldFor: car.soldFor || '',
      ...extractBuyerDetailsFromCar(car)
    });
    setIsModalOpen(true);
  };

  const handleMarkSold = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const buyerPayload = buildBuyerPayloadObject(soldBuyerData, soldRemoveLicenseDoc);
      const payload = {
        status: 'Sold',
        soldFor: Number(soldForAmount),
        soldDate: soldDate,
        ...buyerPayload
      };

      const response = await sendDealerCarRequest({
        url: `${import.meta.env.VITE_API_URL}/dealer-cars/${currentCarId}`,
        method: 'PUT',
        payload,
        licenseFile: soldLicenseFile
      });

      const data = await response.json();
      if (data.success) {
        handleCloseSoldModal();
        fetchData();
      } else {
        alert(data.error || 'Failed to mark car as sold.');
      }
    } catch (error) {
      console.error("Failed to mark as sold:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCar = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      const token = localStorage.getItem('gsk_token');
      await fetch(`${import.meta.env.VITE_API_URL}/dealer-cars/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error("Failed to delete car:", error);
    }
  };

  const formatBuyerAddress = (addr) => {
    if (!addr) return '';
    const parts = [
      addr.addressLine1,
      addr.addressLine2,
      addr.suburb,
      addr.state,
      addr.postcode,
      addr.country && addr.country !== 'Australia' ? addr.country : ''
    ].filter(Boolean);
    return parts.join(', ');
  };

  const hasAnyBuyerInfo = (car) => {
    return Boolean(
      car.buyerName ||
      car.buyerPhone ||
      car.buyerEmail ||
      car.buyerId ||
      car.buyerLicense?.licenseNumber ||
      car.buyerLicense?.holderName ||
      car.buyerLicense?.documentUrl ||
      car.buyerAddress?.addressLine1 ||
      car.buyerAddress?.suburb
    );
  };

  const handleExportCSV = () => {
    const headers = [
      { label: 'Vehicle', key: 'vehicleId' },
      { label: 'Dealer', key: 'dealerName' },
      { label: 'Status', key: 'status' },
      { label: 'Cost', key: 'cost' },
      { label: 'Sell Price', key: 'sellPrice' },
      { label: 'Sold For', key: 'soldFor' },
      { label: 'Sold Date', key: 'soldDate' },
      { label: 'Buyer Name', key: 'buyerName' },
      { label: 'Buyer Phone', key: 'buyerPhone' },
      { label: 'Buyer Licence No', key: 'licenseNumber' },
      { label: 'Buyer Address', key: 'buyerAddress' }
    ];
    
    const formattedData = cars.map(car => ({
      vehicleId: car.make ? `${car.make} ${car.model} (${car.registrationNumber})` : (car.vehicleId ? `${car.vehicleId.brand} ${car.vehicleId.model} (${car.vehicleId.registrationNumber})` : 'N/A'),
      dealerName: car.dealerName || 'N/A',
      status: car.status,
      cost: car.cost,
      sellPrice: car.sellPrice,
      soldFor: car.soldFor || 'N/A',
      soldDate: car.soldDate ? new Date(car.soldDate).toLocaleDateString() : 'N/A',
      buyerName: car.buyerName || car.buyerId?.name || 'N/A',
      buyerPhone: car.buyerPhone || 'N/A',
      licenseNumber: car.buyerLicense?.licenseNumber || 'N/A',
      buyerAddress: formatBuyerAddress(car.buyerAddress) || 'N/A'
    }));

    downloadCSV(formattedData, 'DealerCars_Export', headers);
  };

  const renderBuyerDetailsFields = ({
    data,
    onChange,
    selectedFile,
    filePreview,
    removeDocFlag,
    fileError,
    onFileSelect,
    onClearFile,
    onRemoveExistingDoc
  }) => {
    const hasExistingDoc = Boolean(data.licenseDocumentUrl && !removeDocFlag && !selectedFile);
    const isExistingPdf = data.licenseDocumentMimeType === 'application/pdf' || data.licenseDocumentUrl?.toLowerCase().endsWith('.pdf');

    return (
      <div className="space-y-5">
        {/* Basic Buyer Contact Info */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
            Buyer Contact Information <span className="text-gray-400 font-normal">(Optional)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Buyer Name</label>
              <input 
                type="text" name="buyerName" value={data.buyerName} onChange={onChange} placeholder="John Doe"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Buyer Phone</label>
              <input 
                type="tel" name="buyerPhone" value={data.buyerPhone} onChange={onChange} placeholder="0412 345 678"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Buyer Email</label>
              <input 
                type="email" name="buyerEmail" value={data.buyerEmail} onChange={onChange} placeholder="john@example.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Driving Licence Details */}
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CreditCard size={14} className="text-primary" />
            Driving Licence Details <span className="text-gray-400 font-normal">(Optional)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Licence Number</label>
              <input 
                type="text" name="licenseNumber" value={data.licenseNumber} onChange={onChange} placeholder="e.g. 12345678"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Licence Holder&apos;s Full Name</label>
              <input 
                type="text" name="licenseHolderName" value={data.licenseHolderName} onChange={onChange} placeholder="Full name as on licence"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Issuing State / Territory</label>
              <select
                name="licenseIssuingState"
                value={data.licenseIssuingState}
                onChange={onChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="">Select State</option>
                {AU_STATES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Licence Expiry Date</label>
              <input 
                type="date" name="licenseExpiryDate" value={data.licenseExpiryDate} onChange={onChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Licence Type / Class</label>
              <input 
                type="text" name="licenseClass" value={data.licenseClass} onChange={onChange} placeholder="e.g. C, P1, P2, R, HR"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* Driving Licence Document Upload */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">
              Driving Licence Document / Image Upload <span className="text-gray-400 font-normal">(JPG, PNG, WEBP, PDF — Max 10MB, Optional)</span>
            </label>

            {fileError && (
              <div className="mb-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {hasExistingDoc && (
              <div className="mb-2 p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {!isExistingPdf ? (
                    <img
                      src={data.licenseDocumentUrl}
                      alt="Buyer Licence"
                      className="w-12 h-12 rounded object-cover border border-gray-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                      <FileText size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-dark truncate">
                      {data.licenseDocumentName || 'Uploaded Driving Licence'}
                    </p>
                    <a
                      href={data.licenseDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      View Document <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRemoveExistingDoc}
                  className="text-xs text-red-600 hover:text-red-700 font-medium px-2.5 py-1.5 rounded bg-red-50 hover:bg-red-100 transition-colors shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            {selectedFile && (
              <div className="mb-2 p-3 rounded-lg bg-blue-50/50 border border-blue-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Licence Preview"
                      className="w-12 h-12 rounded object-cover border border-blue-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-dark truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB — Ready to upload
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearFile}
                  className="text-xs text-gray-600 hover:text-red-600 font-medium px-2.5 py-1.5 rounded bg-white border border-gray-200 hover:border-red-200 transition-colors shrink-0"
                >
                  Clear
                </button>
              </div>
            )}

            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-200 hover:border-primary/50 rounded-lg bg-gray-50/60 hover:bg-gray-50 cursor-pointer transition-colors text-xs text-gray-600 font-medium">
              <Upload size={16} className="text-gray-400" />
              <span>{selectedFile || hasExistingDoc ? 'Replace Driving Licence File' : 'Upload Driving Licence Image or PDF'}</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelect(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Residential Address */}
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MapPin size={14} className="text-primary" />
            Buyer Residential Address <span className="text-gray-400 font-normal">(Optional)</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Address Line 1</label>
              <input 
                type="text" name="addressLine1" value={data.addressLine1} onChange={onChange} placeholder="Street address, P.O. box"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Address Line 2 (Optional)</label>
              <input 
                type="text" name="addressLine2" value={data.addressLine2} onChange={onChange} placeholder="Apartment, suite, unit, building"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Suburb / City</label>
              <input 
                type="text" name="suburb" value={data.suburb} onChange={onChange} placeholder="e.g. Parramatta"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">State / Territory</label>
              <select
                name="state"
                value={data.state}
                onChange={onChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="">Select</option>
                {AU_STATES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Postcode</label>
              <input 
                type="text" name="postcode" value={data.postcode} onChange={onChange} placeholder="e.g. 2150"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Country</label>
              <input 
                type="text" name="country" value={data.country} onChange={onChange} placeholder="Australia"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <Car size={24} className="text-red-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">Dealer Cars</h1>
            <p className="text-gray-500 text-sm">Track Cars purchased from dealers - cost vs sell price</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button 
            onClick={handleExportCSV}
            className="w-full sm:w-auto justify-center bg-white border border-gray-200 hover:border-gray-300 text-dark font-bold px-4 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download size={18} /> Export
          </button>
          <button 
            onClick={() => {
              setEditingCar(null);
              setFormData(defaultFormData);
              setEditLicenseFile(null);
              setEditLicensePreview('');
              setEditRemoveLicenseDoc(false);
              setEditFileError('');
              setIsModalOpen(true);
            }}
            className="w-full sm:w-auto justify-center bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20"
          >
            <Plus size={18} /> Add Car
          </button>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
          {['All', 'In Stock', 'Sold'].map(tab => (
            <button
              key={tab}
              onClick={() => { setStatusFilter(tab); fetchCars(1); }}
              className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all ${
                statusFilter === tab ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-dark'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search dealer, vehicle, or buyer..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-primary outline-none"
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4 hover:border-red-500/30 transition-colors">
          <div className="w-12 h-12 bg-red-500/10 flex items-center justify-center rounded-lg">
            <Car size={24} className="text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.inStock}</p>
            <p className="text-xs text-gray-500 font-medium">In Stock</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4 hover:border-green-500/30 transition-colors">
          <div className="w-12 h-12 bg-green-500/10 flex items-center justify-center rounded-lg">
            <CheckCircle size={24} className="text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.sold}</p>
            <p className="text-xs text-gray-500 font-medium">Sold</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4 hover:border-blue-500/30 transition-colors">
          <div className="w-12 h-12 bg-blue-500/10 flex items-center justify-center rounded-lg">
            <Wrench size={24} className="text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">{metrics.costInStock}</p>
            <p className="text-xs text-gray-500 font-medium">Cost in stock</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 p-5 rounded-xl flex items-center gap-4 hover:border-yellow-500/30 transition-colors">
          <div className="w-12 h-12 bg-yellow-500/10 flex items-center justify-center rounded-lg">
            <DollarSign size={24} className="text-yellow-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading">${(metrics?.actualProfit || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 font-medium">Actual Profit</p>
          </div>
        </div>
      </div>

      {/* In Stock Grid */}
      {(statusFilter === 'All' || statusFilter === 'In Stock') && (
        <div className="mb-12">
          <h2 className="text-2xl font-heading font-bold mb-6 uppercase tracking-wider">IN STOCK</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cars.filter(c => c.status === 'In Stock').length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white border border-gray-100 rounded-xl">
                <Car size={48} className="mx-auto text-gray-600 mb-4 opacity-50" />
                <p className="text-gray-500 font-medium">No cars currently in stock.</p>
              </div>
            ) : (
              cars.filter(c => c.status === 'In Stock').map(car => (
                <div key={car._id} className="bg-white border border-gray-100 rounded-xl p-5 hover:border-primary/50 transition-colors flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg leading-tight uppercase">
                      {car.year || car.vehicleId?.year} {car.make || car.vehicleId?.brand} {car.model || car.vehicleId?.model}
                    </h3>
                    <span className="bg-gray-50 text-gray-700 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">IN STOCK</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-6 flex items-center gap-1"><Store size={12}/> Dealer: {car.dealerName} | Rego No: {car.registrationNumber || car.vehicleId?.registrationNumber || 'N/A'}</p>
                  
                  <div className="space-y-2 mb-6 flex-grow">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Cost Spent:</span>
                      <span className="font-mono">${(car.cost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Sell Price:</span>
                      <span className="font-mono">${(car.sellPrice || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                      <span className="text-gray-700">Projected Profit:</span>
                      <span className="text-green-500 font-mono">${((car.sellPrice || 0) - (car.cost || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="flex w-full gap-2 mt-auto">
                    <button onClick={() => handleOpenSoldModal(car)} className="flex-1 flex justify-center items-center p-2.5 bg-[#222] hover:bg-gray-50 rounded text-gray-500 hover:text-green-500 transition-colors" title="Mark as Sold">
                      <CheckCircle size={16} />
                    </button>
                    <button onClick={() => handleEdit(car)} className="flex-1 flex justify-center items-center p-2.5 bg-[#222] hover:bg-gray-50 rounded text-gray-500 hover:text-blue-500 transition-colors" title="Edit Car">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => deleteCar(car._id)} className="flex-1 flex justify-center items-center p-2.5 bg-[#222] hover:bg-gray-50 rounded text-gray-500 hover:text-red-500 transition-colors" title="Delete Car">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sold Cars Table */}
      {(statusFilter === 'All' || statusFilter === 'Sold') && (
        <div>
          <h2 className="text-2xl font-heading font-bold mb-6 uppercase tracking-wider">SOLD CARS</h2>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Dealer & Buyer Details</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Sold For</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Profit</th>
                    <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cars.filter(c => c.status === 'Sold').length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-24 text-center">
                        <Receipt size={48} className="mx-auto text-gray-600 mb-4 opacity-50" />
                        <p className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-2">No sales record for this data</p>
                        <p className="text-gray-500 text-xs mb-6">Add a new sale to get started</p>
                        <button onClick={() => setIsModalOpen(true)} className="bg-primary hover:bg-primary-dark text-white font-bold px-6 py-2 rounded text-sm transition-colors">
                          + Add Sale
                        </button>
                      </td>
                    </tr>
                  ) : (
                    cars.filter(c => c.status === 'Sold').map(car => {
                      const formattedAddr = formatBuyerAddress(car.buyerAddress);
                      const hasBuyer = hasAnyBuyerInfo(car);
                      return (
                        <tr key={car._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6">
                            <p className="font-bold text-sm text-gray-800">
                              {car.year || car.vehicleId?.year} {car.make || car.vehicleId?.brand} {car.model || car.vehicleId?.model}
                            </p>
                            <p className="text-xs text-gray-500">{car.registrationNumber || car.vehicleId?.registrationNumber}</p>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-500">
                            <div className="font-medium text-dark">{car.dealerName}</div>
                            {car.soldDate && <div className="text-xs">Sold on: {new Date(car.soldDate).toLocaleDateString()}</div>}
                            {hasBuyer && (
                              <div className="text-xs mt-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-gray-700">Buyer Details</span>
                                  <button
                                    type="button"
                                    onClick={() => setViewingBuyerCar(car)}
                                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    <Eye size={12} /> View Full Details
                                  </button>
                                </div>
                                {(car.buyerName || car.buyerId?.name) && (
                                  <div className="text-gray-700 font-medium">{car.buyerName || car.buyerId?.name}</div>
                                )}
                                {(car.buyerPhone || car.buyerEmail) && (
                                  <div className="text-gray-500">
                                    {[car.buyerPhone, car.buyerEmail].filter(Boolean).join(' • ')}
                                  </div>
                                )}
                                {car.buyerLicense?.licenseNumber && (
                                  <div className="text-gray-600">
                                    Licence: <span className="font-mono font-medium">{car.buyerLicense.licenseNumber}</span>
                                    {car.buyerLicense.issuingState ? ` (${car.buyerLicense.issuingState})` : ''}
                                    {car.buyerLicense.licenseClass ? ` • Class ${car.buyerLicense.licenseClass}` : ''}
                                  </div>
                                )}
                                {formattedAddr && (
                                  <div className="text-gray-500 truncate max-w-xs" title={formattedAddr}>
                                    Address: {formattedAddr}
                                  </div>
                                )}
                                {car.buyerLicense?.documentUrl && (
                                  <div>
                                    <a
                                      href={car.buyerLicense.documentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                                    >
                                      <FileText size={11} /> View Licence Document
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm font-mono text-gray-500">
                            ${(car.cost || 0).toFixed(2)}
                          </td>
                          <td className="py-4 px-6 text-sm font-mono font-bold text-dark">
                            ${(car.soldFor || 0).toFixed(2)}
                          </td>
                          <td className="py-4 px-6 text-sm font-mono font-bold text-green-500">
                            +${((car.soldFor || 0) - (car.cost || 0)).toFixed(2)}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {hasBuyer && (
                                <button
                                  onClick={() => setViewingBuyerCar(car)}
                                  className="text-gray-500 hover:text-primary transition-colors"
                                  title="View Buyer Details"
                                >
                                  <Eye size={16} />
                                </button>
                              )}
                              <button onClick={() => handleEdit(car)} className="text-gray-500 hover:text-blue-500 transition-colors" title="Edit Car & Buyer Details">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => deleteCar(car._id)} className="text-gray-500 hover:text-red-500 transition-colors" title="Delete Record">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm text-gray-500">
          <span>Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
          <div className="flex gap-2">
            <button disabled={pagination.page <= 1} onClick={() => fetchCars(pagination.page - 1)} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 text-dark"><ChevronLeft size={16} /></button>
            <button disabled={pagination.page >= pagination.pages} onClick={() => fetchCars(pagination.page + 1)} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 text-dark"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Add/Edit Car Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold">{editingCar ? 'Edit Car' : 'Add New Car'}</h2>
              <button type="button" onClick={handleCloseModal} className="text-gray-500 hover:text-dark transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddCar} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Make / Brand</label>
                    <input 
                      type="text" required name="make" value={formData.make} onChange={handleInputChange} placeholder="e.g. Toyota"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Model</label>
                    <input 
                      type="text" required name="model" value={formData.model} onChange={handleInputChange} placeholder="e.g. Camry"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Year</label>
                    <input 
                      type="number" required name="year" value={formData.year} onChange={handleInputChange} placeholder="2020"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Rego No</label>
                    <input 
                      type="text" name="registrationNumber" value={formData.registrationNumber} onChange={handleInputChange} placeholder="ABC123"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">VIN</label>
                    <input 
                      type="text" name="vin" value={formData.vin} onChange={handleInputChange} placeholder="17-Digit VIN"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Mileage / Odo</label>
                    <input 
                      type="number" name="mileage" value={formData.mileage} onChange={handleInputChange} placeholder="0"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <hr className="my-4 border-gray-100" />
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Purchase Date</label>
                    <input 
                      type="date" required name="purchaseDate" value={formData.purchaseDate} onChange={handleInputChange}
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Dealer Name</label>
                    <input 
                      type="text" required name="dealerName" value={formData.dealerName} onChange={handleInputChange} placeholder="e.g. Pickles Auction"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Cost We Spent($)</label>
                    <input 
                      type="number" required name="cost" value={formData.cost} onChange={handleInputChange} placeholder="0.00"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Sell Price ($)</label>
                    <input 
                      type="number" required name="sellPrice" value={formData.sellPrice} onChange={handleInputChange} placeholder="0.00"
                      className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                {editingCar && editingCar.status === 'Sold' && (
                  <>
                    <hr className="my-5 border-gray-100" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase mb-4">Sale & Buyer Details</h3>
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Final Sold Amount ($)</label>
                        <input 
                          type="number" name="soldFor" value={formData.soldFor} onChange={handleInputChange} placeholder="0.00"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Sold Date</label>
                        <input 
                          type="date" name="soldDate" value={formData.soldDate} onChange={handleInputChange}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50/50 border border-gray-100 mb-5">
                      {renderBuyerDetailsFields({
                        data: formData,
                        onChange: handleInputChange,
                        selectedFile: editLicenseFile,
                        filePreview: editLicensePreview,
                        removeDocFlag: editRemoveLicenseDoc,
                        fileError: editFileError,
                        onFileSelect: (file) => validateAndSelectFile(file, setEditLicenseFile, setEditLicensePreview, setEditFileError, setEditRemoveLicenseDoc),
                        onClearFile: () => {
                          setEditLicenseFile(null);
                          setEditLicensePreview('');
                          setEditFileError('');
                        },
                        onRemoveExistingDoc: () => setEditRemoveLicenseDoc(true)
                      })}
                    </div>
                  </>
                )}

                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Notes</label>
                  <textarea 
                    name="notes" value={formData.notes} onChange={handleInputChange} rows="2"
                    className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-6 border-t border-gray-100 shrink-0 bg-white">
                <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-lg shadow-primary/20">
                  {isSubmitting ? 'Saving...' : (editingCar ? 'Save Changes' : 'Add Car')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Sold Modal */}
      {isSoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold">Mark Car as Sold</h2>
              <button type="button" onClick={handleCloseSoldModal} className="text-gray-500 hover:text-dark transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleMarkSold} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Final Sold Amount ($)</label>
                    <input 
                      type="number" required value={soldForAmount} onChange={(e) => setSoldForAmount(e.target.value)} placeholder="0.00"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xl font-bold text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Sold Date</label>
                    <input 
                      type="date" required value={soldDate} onChange={(e) => setSoldDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3.5 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-bold text-gray-800 uppercase mb-4">
                    Buyer Details <span className="text-xs font-normal text-gray-400">(All fields below are optional)</span>
                  </h3>
                  {renderBuyerDetailsFields({
                    data: soldBuyerData,
                    onChange: handleSoldBuyerChange,
                    selectedFile: soldLicenseFile,
                    filePreview: soldLicensePreview,
                    removeDocFlag: soldRemoveLicenseDoc,
                    fileError: soldFileError,
                    onFileSelect: (file) => validateAndSelectFile(file, setSoldLicenseFile, setSoldLicensePreview, setSoldFileError, setSoldRemoveLicenseDoc),
                    onClearFile: () => {
                      setSoldLicenseFile(null);
                      setSoldLicensePreview('');
                      setSoldFileError('');
                    },
                    onRemoveExistingDoc: () => setSoldRemoveLicenseDoc(true)
                  })}
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-6 border-t border-gray-100 shrink-0 bg-white">
                <button type="button" onClick={handleCloseSoldModal} className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors w-full sm:w-auto justify-center">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors w-full sm:w-auto justify-center">
                  {isSubmitting ? 'Saving Sale...' : 'Confirm Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Buyer Details Modal */}
      {viewingBuyerCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-xl font-bold">Buyer & Sale Information</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {viewingBuyerCar.year || viewingBuyerCar.vehicleId?.year} {viewingBuyerCar.make || viewingBuyerCar.vehicleId?.brand} {viewingBuyerCar.model || viewingBuyerCar.vehicleId?.model} ({viewingBuyerCar.registrationNumber || viewingBuyerCar.vehicleId?.registrationNumber || 'N/A'})
                </p>
              </div>
              <button type="button" onClick={() => setViewingBuyerCar(null)} className="text-gray-500 hover:text-dark transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
              {/* Contact */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Buyer Contact</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-gray-400 block">Name</span>
                    <span className="font-semibold text-dark">{viewingBuyerCar.buyerName || viewingBuyerCar.buyerId?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Phone</span>
                    <span className="font-medium text-dark">{viewingBuyerCar.buyerPhone || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 block">Email</span>
                    <span className="font-medium text-dark">{viewingBuyerCar.buyerEmail || viewingBuyerCar.buyerId?.email || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Driving Licence */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={14} className="text-primary" /> Driving Licence Details
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-gray-400 block">Licence Number</span>
                    <span className="font-mono font-semibold text-dark">{viewingBuyerCar.buyerLicense?.licenseNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Holder Full Name</span>
                    <span className="font-medium text-dark">{viewingBuyerCar.buyerLicense?.holderName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Issuing State</span>
                    <span className="font-medium text-dark">{viewingBuyerCar.buyerLicense?.issuingState || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Licence Class</span>
                    <span className="font-medium text-dark">{viewingBuyerCar.buyerLicense?.licenseClass || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 block">Expiry Date</span>
                    <span className="font-medium text-dark">
                      {viewingBuyerCar.buyerLicense?.expiryDate
                        ? new Date(viewingBuyerCar.buyerLicense.expiryDate).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                </div>

                {viewingBuyerCar.buyerLicense?.documentUrl && (
                  <div className="pt-3 mt-2 border-t border-gray-200">
                    <span className="text-xs text-gray-400 block mb-2">Uploaded Licence Document</span>
                    {viewingBuyerCar.buyerLicense.documentMimeType?.startsWith('image/') ||
                    (!viewingBuyerCar.buyerLicense.documentUrl.toLowerCase().endsWith('.pdf') &&
                      viewingBuyerCar.buyerLicense.documentMimeType !== 'application/pdf') ? (
                      <div className="space-y-2">
                        <img
                          src={viewingBuyerCar.buyerLicense.documentUrl}
                          alt="Buyer Driving Licence"
                          className="max-h-48 rounded-lg border border-gray-200 object-contain bg-white"
                        />
                        <a
                          href={viewingBuyerCar.buyerLicense.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1"
                        >
                          Open Full Image <ExternalLink size={12} />
                        </a>
                      </div>
                    ) : (
                      <a
                        href={viewingBuyerCar.buyerLicense.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-primary font-semibold text-xs hover:bg-gray-50"
                      >
                        <FileText size={16} />
                        <span>{viewingBuyerCar.buyerLicense.documentName || 'View Licence PDF Document'}</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Residential Address */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={14} className="text-primary" /> Residential Address
                </h4>
                <p className="font-medium text-dark">
                  {formatBuyerAddress(viewingBuyerCar.buyerAddress) || 'No address recorded'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-white">
              <button
                type="button"
                onClick={() => {
                  const carToEdit = viewingBuyerCar;
                  setViewingBuyerCar(null);
                  handleEdit(carToEdit);
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-primary bg-red-50 hover:bg-red-100 transition-colors"
              >
                Edit Details
              </button>
              <button
                type="button"
                onClick={() => setViewingBuyerCar(null)}
                className="px-5 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealerCars;
