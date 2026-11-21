import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  FileText, Plus, CheckCircle, Trash2, X, Download, Printer, Mail, AlertCircle,
  Send, Users, CheckSquare, Square, Clock, Paperclip, Eye, ShieldAlert, RefreshCw,
  Archive, Lock, Ban, ShieldCheck, Database
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useSearchParams } from 'react-router-dom';
import PrintableInvoice from '../../components/admin/PrintableInvoice';
import {
  CancelVoidInvoiceModal,
  OldQuotesReviewPanel,
  RetentionAndBackupManagementPanel
} from '../../components/admin/InvoiceRetentionPanel';
import { downloadCSV } from '../../utils/exportCsv';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';
import { useToast } from '../../components/ui/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';

const INVOICE_TYPES = ['Service Invoice', 'General Invoice', 'Rental Invoice', 'Custom Invoice'];

const CHECKLIST_PRESETS = [
  "Drained and replaced engine oil with premium grade oil",
  "Replaced Oil Filters",
  "Checked and topped essential fluids",
  "Checked suspension and steering components",
  "Inspected brake pads and rotors",
  "Checked tire pressure and tread depth"
];

const CustomerTypeBadge = ({ type }) => {
  if (type === 'import_company') return <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">Import</span>;
  if (type === 'rental_company') return <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">Rental</span>;
  return null;
};

// ============================================
// MARK PAID MODAL
// ============================================
const MarkPaidModal = ({ invoice, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!invoice) return null;

  const isPaid = invoice.status === 'Paid';
  const total = invoice.totalAmount !== undefined ? invoice.totalAmount : 0;

  const handleMarkAsPaid = async () => {
    if (loading || isPaid) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${invoice._id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'Paid' })
      });
      const data = await res.json();
      
      if (data.success) {
        setResult({ success: true, message: 'Invoice successfully marked as Paid.' });
      } else {
        setResult({ success: false, message: data.error || 'Failed to update invoice.' });
      }
    } catch (error) {
      console.error('Mark as paid error:', error);
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    if (result?.success) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up my-8">
        <div className="p-6 bg-[#222] flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle size={20} className="text-green-400" />
            Invoice Status - {invoice.invoiceNo}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {!result ? (
            <>
              <div className="mb-6 space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 font-medium">Customer</span>
                  <span className="text-sm font-bold text-gray-800">{invoice.customerId?.name || 'Unknown'}</span>
                </div>
                {invoice.vehicleId && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 font-medium">Vehicle</span>
                    <span className="text-sm font-bold text-gray-800">{invoice.vehicleId.registrationNumber || 'Unknown'}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 font-medium">Current Status</span>
                  <span className={`text-sm font-bold uppercase tracking-wide px-2 py-0.5 rounded ${isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{invoice.status}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span className="text-sm text-gray-500 font-medium">Total Amount</span>
                  <span className="text-lg font-mono font-bold text-dark">${total.toFixed(2)}</span>
                </div>
              </div>

              {isPaid ? (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 font-bold text-center mb-6">
                  This invoice has already been marked as Paid.
                </div>
              ) : (
                <div className="mb-6">
                  <p className="text-sm text-gray-600 text-center mb-4">
                    Are you sure you want to mark this invoice as Paid? This will update the status to Paid and set the paid amount to the total amount.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={onClose} 
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  {isPaid ? 'Close' : 'Cancel'}
                </button>
                {!isPaid && (
                  <button 
                    type="button"
                    onClick={handleMarkAsPaid}
                    disabled={loading}
                    className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? 'Processing...' : 'Mark as Paid'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={`p-4 mb-6 rounded-lg flex items-start gap-3 border ${
                result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                {result.success ? (
                  <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.message}
                </p>
              </div>
              <button 
                onClick={handleDone}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-[#222] hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


// ============================================
// MAIN INVOICES COMPONENT
// ============================================
const Invoices = () => {
  const { user } = useAuth();
  const { startTour } = useTour();
  const toast = useToast();
  
  const [invoices, setInvoices] = useState([]);
  
  const [metrics, setMetrics] = useState({
    unpaidCount: 0,
    paidCount: 0,
    unpaidTotal: 0,
    paidTotal: 0
  });
  
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAction = searchParams.get('action');
  const initialJobCardId = searchParams.get('jobCardId');
  const [isModalOpen, setIsModalOpen] = useState(initialAction === 'new');
  
  // Printing & PDF
  const printRef = useRef(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);
  const [settings, setSettings] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(null); // invoice ID being generated
  
  // Mark Paid Modal & Cancel/Void Modal
  const [markPaidInvoice, setMarkPaidInvoice] = useState(null);
  const [cancelVoidInvoice, setCancelVoidInvoice] = useState(null);
  const [viewMode, setViewMode] = useState('active');
  const [includeAllDrafts, setIncludeAllDrafts] = useState(false);

  // Consolidated email: selections persist across filters/pages (keyed by invoice id)
  const [selectedInvoices, setSelectedInvoices] = useState({});
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [resendConfirmed, setResendConfirmed] = useState(false);
  const emailIdempotencyKey = useRef(null);
  const emailInFlight = useRef(false);

  const selectedList = useMemo(() => Object.values(selectedInvoices), [selectedInvoices]);
  const selectedCount = selectedList.length;
  const customerGroups = useMemo(() => {
    const groups = new Map();
    selectedList.forEach(inv => {
      const cid = String(inv.customerId?._id || inv.customerId || '');
      if (!groups.has(cid)) groups.set(cid, { id: cid, name: inv.customerId?.name || 'Unknown', email: inv.customerId?.email || '', invoices: [] });
      groups.get(cid).invoices.push(inv);
    });
    return Array.from(groups.values());
  }, [selectedList]);
  const hasMixedCustomers = customerGroups.length > 1;
  const selectedCustomer = customerGroups.length === 1 ? customerGroups[0] : null;
  const selectedTotal = selectedList.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
  const alreadyEmailedSelected = selectedList.filter(i => i.invoiceEmailSent);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const customerEmailValid = Boolean(selectedCustomer && EMAIL_RE.test(selectedCustomer.email || ''));

  const isEligible = (inv) => inv.isActive !== false && ['Unpaid', 'Partially Paid', 'Paid'].includes(inv.status);
  const toggleInvoice = (inv) => {
    if (!isEligible(inv)) return;
    setSelectedInvoices(prev => {
      const next = { ...prev };
      if (next[inv._id]) delete next[inv._id]; else next[inv._id] = inv;
      return next;
    });
  };
  const eligibleVisible = invoices.filter(isEligible);
  const allVisibleSelected = eligibleVisible.length > 0 && eligibleVisible.every(i => selectedInvoices[i._id]);
  const toggleSelectAllVisible = () => {
    setSelectedInvoices(prev => {
      const next = { ...prev };
      if (allVisibleSelected) eligibleVisible.forEach(i => { delete next[i._id]; });
      else eligibleVisible.forEach(i => { next[i._id] = i; });
      return next;
    });
  };
  const clearSelection = () => { setSelectedInvoices({}); setEmailError(null); };

  const openEmailModal = () => {
    setEmailError(null);
    setResendConfirmed(false);
    emailIdempotencyKey.current = `inv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setIsEmailModalOpen(true);
  };

  const handleSendConsolidated = async () => {
    if (emailInFlight.current || emailSending) return;
    if (hasMixedCustomers || !selectedCustomer || !customerEmailValid) return;
    if (alreadyEmailedSelected.length > 0 && !resendConfirmed) {
      setEmailError({ title: 'Confirmation required', message: 'Some selected invoices were already emailed. Tick the resend confirmation to proceed.' });
      return;
    }
    emailInFlight.current = true;
    setEmailSending(true);
    setEmailError(null);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/send-consolidated-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: selectedList.map(i => i._id),
          customerId: selectedCustomer.id,
          resendConfirmed,
          idempotencyKey: emailIdempotencyKey.current
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Email accepted by Brevo.');
        setIsEmailModalOpen(false);
        setSelectedInvoices({});
        refreshInvoices();
      } else if (data.partialFailure) {
        setEmailError({ title: 'Email accepted, log not saved', message: data.error });
        toast.error(data.error);
      } else {
        setEmailError({ title: data.title || 'Unable to send', message: data.error || 'Failed to send email.' });
      }
    } catch (err) {
      setEmailError({ title: 'Network error', message: 'Could not reach the server. Please try again.' });
    } finally {
      emailInFlight.current = false;
      setEmailSending(false);
    }
  };
  
  // Form State
  const [formData, setFormData] = useState({
    type: 'Service Invoice',
    customerObj: null, vehicleObj: null, jobCardObj: null, rentalObj: null,
    partsAndLabour: [],
    checklist: [],
    recommendations: [],
    notes: ''
  });

  // Internal Modal Tab State
  const [activeTab, setActiveTab] = useState('Parts, Labour & Service Charges');

  // Input states for dynamic arrays
  const [plDesc, setPlDesc] = useState('');
  const [plQty, setPlQty] = useState('');
  const [plPrice, setPlPrice] = useState('');
  
  const [customChecklist, setCustomChecklist] = useState('');
  const [recommendation, setRecommendation] = useState('');

  // Server-side search & pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, pages: 0 });
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef(null);
  const abortControllerRef = useRef(null);
  const latestRequestId = useRef(0);

  const fetchInvoices = useCallback(async (search = '', status = '', page = 1, dPreset = 'all', fromDate = '', toDate = '', mode = viewMode, allDrafts = includeAllDrafts) => {
    if (mode === 'quotes_review' || mode === 'retention_policy') {
      return;
    }
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++latestRequestId.current;

    setLoading(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      params.set('viewMode', mode || 'active');
      if (mode === 'draft_review' && allDrafts) {
        params.set('includeAllDrafts', 'true');
      }
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (dPreset !== 'all') params.set('datePreset', dPreset);
      if (dPreset === 'custom') {
        if (fromDate) params.set('customFromDate', fromDate);
        if (toDate) params.set('customToDate', toDate);
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      const data = await res.json();

      // Prevent stale responses
      if (requestId !== latestRequestId.current) return;

      if (data.success) {
        setInvoices(data.data);
        setPagination(data.pagination);
        setMetrics(data.metrics);
      }
    } catch (error) {
      if (error.name === 'AbortError') return; // Intentional cancellation
      console.error("Failed to fetch invoices:", error);
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [viewMode, includeAllDrafts]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('gsk_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const setRes = await fetch(`${import.meta.env.VITE_API_URL}/settings`, { headers });
      const setData = await setRes.json();
      if (setData.success) setSettings(setData.data);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchInvoices('', '', 1, datePreset, customFromDate, customToDate);
  }, []);

  // Debounced search
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1);
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchInvoices(value, statusFilter, 1, datePreset, customFromDate, customToDate);
    }, 300);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
    fetchInvoices('', statusFilter, 1, datePreset, customFromDate, customToDate);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
    fetchInvoices(searchTerm, status, 1, datePreset, customFromDate, customToDate, viewMode, includeAllDrafts);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setStatusFilter('');
    setCurrentPage(1);
    if (mode !== 'quotes_review' && mode !== 'retention_policy') {
      fetchInvoices(searchTerm, '', 1, datePreset, customFromDate, customToDate, mode, includeAllDrafts);
    }
  };
  
  const applyDateFilter = (preset, fromDate = '', toDate = '') => {
    setDatePreset(preset);
    setCustomFromDate(fromDate);
    setCustomToDate(toDate);
    setCurrentPage(1);
    fetchInvoices(searchTerm, statusFilter, 1, preset, fromDate, toDate, viewMode, includeAllDrafts);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    fetchInvoices(searchTerm, statusFilter, newPage, datePreset, customFromDate, customToDate, viewMode, includeAllDrafts);
  };

  // Refresh helper for after actions (mark paid, delete, create)
  const refreshInvoices = () => {
    fetchInvoices(searchTerm, statusFilter, currentPage, datePreset, customFromDate, customToDate, viewMode, includeAllDrafts);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSelectJobCard = async (selectedJob) => {
    if (selectedJob) {
      try {
        const token = localStorage.getItem('gsk_token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${selectedJob._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success && data.data) {
          const fullJob = data.data;
          if (fullJob.status !== 'Completed' || !fullJob.financialsFinalized) {
            toast.error('Job Card financial amount must be reviewed and finalized by an Administrator before generating an invoice.');
            return;
          }
          const parts = [];
          
          if (fullJob.partsUsed && fullJob.partsUsed.length > 0) {
            fullJob.partsUsed.forEach(p => {
              const itemName = p.inventoryId?.itemName || 'Part';
              parts.push({ 
                inventoryId: p.inventoryId?._id || p.inventoryId, 
                variantId: p.variantId, 
                description: p.variantName ? `${itemName} - ${p.variantName}` : itemName, 
                qty: p.quantity, 
                price: p.unitPrice 
              });
            });
          }
          if (fullJob.servicesProvided && fullJob.servicesProvided.length > 0) {
            fullJob.servicesProvided.forEach(s => {
              parts.push({ description: s.name, qty: s.quantity, price: s.cost });
            });
          }
          if (fullJob.labourHours && fullJob.hourlyRate) {
            parts.push({ description: 'Labour', qty: fullJob.labourHours, price: fullJob.hourlyRate });
          }
          if (fullJob.charges?.lubricantsOil) parts.push({ description: 'Lubricants/ Engine Oil', qty: 1, price: fullJob.charges.lubricantsOil });
          if (fullJob.charges?.transmission) parts.push({ description: 'Transmission', qty: 1, price: fullJob.charges.transmission });
          if (fullJob.charges?.differentialOil) parts.push({ description: 'Differential Oil', qty: 1, price: fullJob.charges.differentialOil });
          if (fullJob.charges?.brakeFluid) parts.push({ description: 'Brake Fluid', qty: 1, price: fullJob.charges.brakeFluid });
          if (fullJob.charges?.miscellaneous) parts.push({ description: 'Miscellaneous', qty: 1, price: fullJob.charges.miscellaneous });

          setFormData(prev => ({ 
            ...prev, 
            jobCardObj: fullJob,
            vehicleObj: fullJob.vehicleId || fullJob.trackerCarId || prev.vehicleObj,
            customerObj: fullJob.customerId || prev.customerObj,
            partsAndLabour: parts,
            notes: fullJob.notes || ''
          }));
        }
      } catch (err) {
        console.error("Failed to fetch full job card:", err);
      }
    } else {
      setFormData(prev => ({ ...prev, jobCardObj: null }));
    }
  };

  useEffect(() => {
    if (initialJobCardId && !formData.jobCardObj) {
      onSelectJobCard({ _id: initialJobCardId });
      setSearchParams({});
    }
  }, [initialJobCardId]);

  const handleTypeSelect = (type) => {
    setFormData({ ...formData, type });
  };

  const [selectedInvPartObj, setSelectedInvPartObj] = useState(null);
  const [invPartQty, setInvPartQty] = useState('');

  // Parts & Labour Actions
  const addInvPart = () => {
    if (!selectedInvPartObj) return;

    const qty = Number(invPartQty) || 1;
    const price = selectedInvPartObj.unitPrice;

    setFormData(prev => ({
      ...prev,
      partsAndLabour: [...prev.partsAndLabour, { 
        inventoryId: selectedInvPartObj.inventoryId,
        variantId: selectedInvPartObj.variantId,
        description: selectedInvPartObj.label, 
        qty: qty, 
        price: price 
      }]
    }));
    setSelectedInvPartObj(null); 
    setInvPartQty('');
  };

  const addPartAndLabour = () => {
    if (plDesc && plPrice) {
      setFormData(prev => ({
        ...prev,
        partsAndLabour: [...prev.partsAndLabour, { 
          description: plDesc, 
          qty: Number(plQty) || 1, 
          price: Number(plPrice) 
        }]
      }));
      setPlDesc(''); setPlQty(''); setPlPrice('');
    }
  };

  const removePartAndLabour = (index) => {
    setFormData(prev => ({
      ...prev,
      partsAndLabour: prev.partsAndLabour.filter((_, i) => i !== index)
    }));
  };

  // Checklist Actions
  const toggleChecklist = (item) => {
    setFormData(prev => {
      const list = [...prev.checklist];
      if (list.includes(item)) {
        return { ...prev, checklist: list.filter(i => i !== item) };
      } else {
        return { ...prev, checklist: [...list, item] };
      }
    });
  };

  const addCustomChecklist = () => {
    if (customChecklist && !formData.checklist.includes(customChecklist)) {
      setFormData(prev => ({
        ...prev,
        checklist: [...prev.checklist, customChecklist]
      }));
      setCustomChecklist('');
    }
  };

  // Recommendation Actions
  const addRecommendation = () => {
    if (recommendation) {
      setFormData(prev => ({
        ...prev,
        recommendations: [...prev.recommendations, recommendation]
      }));
      setRecommendation('');
    }
  };

  const removeRecommendation = (index) => {
    setFormData(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter((_, i) => i !== index)
    }));
  };

  const submitInvoiceForm = async (statusOverride = 'Unpaid') => {
    if (!formData.customerObj) {
      toast.error("Customer is required");
      return;
    }
    try {
      const token = localStorage.getItem('gsk_token');
      
      const payload = {
        type: formData.type,
        status: statusOverride,
        customerId: formData.customerObj._id,
        vehicleId: formData.vehicleObj?._id || null,
        jobCardId: formData.jobCardObj?._id || null,
        rentalId: formData.rentalObj?._id || null,
        partsAndLabour: formData.partsAndLabour,
        checklist: formData.checklist,
        recommendations: formData.recommendations,
        notes: formData.notes
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        toast.success(statusOverride === 'Draft' ? 'Draft invoice saved.' : 'Invoice created.');
        setIsModalOpen(false);
        setFormData({
          type: 'Service Invoice', customerObj: null, vehicleObj: null, jobCardObj: null, rentalObj: null,
          partsAndLabour: [], checklist: [], recommendations: [], notes: ''
        });
        refreshInvoices();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Failed to add invoice:", error);
    }
  };

  const handleAddInvoice = async (e) => {
    e.preventDefault();
    await submitInvoiceForm('Unpaid');
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm("Are you sure you want to delete this draft invoice?")) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Cannot delete invoice under retention policy.");
      } else {
        toast.success("Draft invoice deleted.");
      }
      refreshInvoices();
    } catch (error) {
      console.error("Failed to delete invoice", error);
      toast.error("Failed to delete invoice");
    }
  };

  const handleRetentionReviewAction = async (inv, decision, defaultNotes = '') => {
    const notes = window.prompt(
      `Enter review note for ${inv.invoiceNo} (${decision}):`,
      defaultNotes
    );
    if (notes === null) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${inv._id}/retention-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ decision, notes })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Retention review (${decision}) recorded for ${inv.invoiceNo}.`);
        refreshInvoices();
      } else {
        toast.error(data.error || 'Retention review action failed.');
      }
    } catch (err) {
      toast.error('Network error performing retention review.');
    }
  };

  const handleIssueDraft = async (inv) => {
    if (!window.confirm(`Issue draft invoice ${inv.invoiceNo} as an official Unpaid Invoice?`)) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${inv._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'Unpaid' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Draft ${inv.invoiceNo} issued as official Invoice.`);
        refreshInvoices();
      } else {
        toast.error(data.error || 'Failed to issue draft invoice.');
      }
    } catch (err) {
      toast.error('Network error issuing draft.');
    }
  };

  const triggerSendEmail = async (inv) => {
    if (!window.confirm(`Are you sure you want to send the invoice to ${inv.customerId?.email || 'the customer'}?`)) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${inv._id}/send-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        toast.error(data.message || 'Email sent successfully.');
        refreshInvoices();
      } else {
        toast.error(data.error || 'Failed to send email.');
      }
    } catch (error) {
      console.error("Failed to send email:", error);
      toast.error("Failed to send email.");
    }
  };

  const handleExportCSV = () => {
    const headers = [
      { label: 'Invoice Number', key: 'invoiceNumber' },
      { label: 'Type', key: 'type' },
      { label: 'Customer', key: 'customerId' },
      { label: 'Status', key: 'status' },
      { label: 'Total Amount', key: 'totalAmount' },
      { label: 'Created At', key: 'createdAt' }
    ];
    
    const formattedData = invoices.map(inv => ({
      invoiceNumber: inv.invoiceNo,
      type: inv.type,
      customerId: inv.customerId?.name || 'N/A',
      status: inv.status,
      totalAmount: inv.totalAmount,
      createdAt: new Date(inv.createdAt).toLocaleDateString()
    }));

    downloadCSV(formattedData, 'Invoices_Export', headers);
  };

  // ============================================
  // PRINT — react-to-print v3 API
  // ============================================
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice_${selectedInvoiceForPrint?.invoiceNo || ''}`,
  });

  const triggerPrint = useCallback((invoice) => {
    setIsPrinting(true);
    setSelectedInvoiceForPrint(invoice);
  }, []);

  const [isPrinting, setIsPrinting] = useState(false);

  // When the selected invoice changes and ref is ready, trigger print
  useEffect(() => {
    if (isPrinting && selectedInvoiceForPrint && printRef.current) {
      // Small delay to let React render the new invoice data into PrintableInvoice
      const timer = setTimeout(() => {
        handlePrint();
        // Reset after print dialog closes
        setTimeout(() => {
          setSelectedInvoiceForPrint(null);
          setIsPrinting(false);
        }, 500);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedInvoiceForPrint, isPrinting]);

  // ============================================
  // DOWNLOAD PDF — fetch from backend
  // ============================================
  const triggerPDF = useCallback(async (invoice) => {
    if (pdfGenerating) return; // prevent double-click
    setPdfGenerating(invoice._id);
    
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${invoice._id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GSK-Automotive-Invoice-${invoice.invoiceNo || 'Draft'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setPdfGenerating(null);
    }
  }, [pdfGenerating]);

  // Math for create modal
  const liveSubtotal = formData.partsAndLabour.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const currentGstRate = settings?.gstRate ?? 10;
  const liveTotal = liveSubtotal * (1 + (currentGstRate / 100));

  const STATUS_TABS = [
    { label: 'All', value: '' },
    { label: 'Unpaid', value: 'Unpaid' },
    { label: 'Paid', value: 'Paid' },
    { label: 'Draft', value: 'Draft' }
  ];

  const RETENTION_VIEW_TABS = [
    { id: 'active', label: 'Active Invoices', icon: FileText },
    { id: 'archived', label: `Archived (>2Y Read-Only)${metrics.archivedCount ? ` (${metrics.archivedCount})` : ''}`, icon: Archive },
    { id: 'cancelled', label: `Cancelled / Voided${metrics.cancelledCount ? ` (${metrics.cancelledCount})` : ''}`, icon: Ban },
    { id: 'draft_review', label: 'Draft Review (90d)', icon: Clock },
    { id: 'retention_review', label: '5-Year Retention Review', icon: ShieldCheck },
    { id: 'quotes_review', label: 'Old Quotes (12m)', icon: FileText },
    { id: 'retention_policy', label: 'Retention & Backups', icon: Database }
  ];

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <FileText size={24} className="text-red-500" />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="font-heading text-3xl mb-1">Invoices</h1>
              {user && (user.role === 'admin' || user.role === 'superadmin') && (
                <button
                  onClick={() => startTour('invoices')}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold bg-dark hover:bg-black text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <FileText size={14} /> Page Tour
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm">Independent auto repair shop booking and invoice system.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          <button 
            onClick={handleExportCSV}
            className="w-full sm:w-auto justify-center bg-white border border-gray-200 hover:border-gray-300 text-dark font-bold px-4 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download size={18} /> Export
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto justify-center bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20"
          >
            <Plus size={18} /> New Invoice
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-50 border border-red-500/20 p-6 rounded-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full  group-hover:bg-red-500/10 transition-colors"></div>
          <div>
            <p className="text-3xl font-bold font-heading mb-1 text-red-400">{metrics.unpaidCount}</p>
            <p className="text-xs text-red-500/70 font-medium uppercase tracking-wider">Pending Invoices</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-red-400">${metrics.unpaidTotal.toFixed(2)}</p>
            <p className="text-xs text-red-500/70 font-medium uppercase tracking-wider">Outstanding Balance</p>
          </div>
        </div>
        
        <div className="bg-white border border-green-500/20 p-6 rounded-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full  group-hover:bg-green-500/10 transition-colors"></div>
          <div>
            <p className="text-3xl font-bold font-heading mb-1 text-green-400">{metrics.paidCount}</p>
            <p className="text-xs text-green-500/70 font-medium uppercase tracking-wider">Paid Invoices</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-green-400">${metrics.paidTotal.toFixed(2)}</p>
            <p className="text-xs text-green-500/70 font-medium uppercase tracking-wider">Collected Revenue</p>
          </div>
        </div>
      </div>

      {/* Data Retention & Archival View Selector Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-gray-100 rounded-xl border border-gray-200/70">
        {RETENTION_VIEW_TABS.map(tab => {
          const IconComp = tab.icon;
          const active = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleViewModeChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                active
                  ? 'bg-[#222] text-white shadow-sm'
                  : 'text-gray-600 hover:text-dark hover:bg-white/70'
              }`}
            >
              <IconComp size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {viewMode === 'archived' && (
        <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-slate-700 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Read-Only Historical Archive (Invoices Older Than 2 Years)</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Archived invoices are retained for a minimum of 5 years in read-only mode. You can search by invoice number, customer name, customer ID, invoice date, vehicle registration, or status, and view or download official PDFs. Editing and deletion are disabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'cancelled' && (
        <div className="mb-6 p-4 rounded-xl bg-red-50/70 border border-red-200 flex items-start gap-3">
          <Ban size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-red-900">Cancelled &amp; Voided Invoice Audit Records (5-Year Retention)</h3>
            <p className="text-xs text-red-700 mt-0.5">
              Cancelled and voided invoices preserve the original invoice number, customer snapshot, financial amounts, cancellation date, actor, and reason for accounting and statutory audit compliance.
            </p>
          </div>
        </div>
      )}

      {viewMode === 'draft_review' && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Clock size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">Draft Invoice Inactivity Review (90-Day Policy)</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Draft invoices inactive for 90+ days are surfaced here for review. Drafts are never automatically deleted. You may retain them, issue them, or approve deletion if not linked to an active Job Card.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-amber-900 bg-white px-3 py-2 rounded-lg border border-amber-200 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={includeAllDrafts}
              onChange={(e) => {
                const next = e.target.checked;
                setIncludeAllDrafts(next);
                fetchInvoices(searchTerm, statusFilter, 1, datePreset, customFromDate, customToDate, 'draft_review', next);
              }}
              className="accent-red-600"
            />
            Show all drafts (including &lt;90d)
          </label>
        </div>
      )}

      {viewMode === 'retention_review' && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
          <ShieldCheck size={18} className="text-blue-700 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-blue-900">Post-5-Year Financial Record Retention Review &amp; Legal Holds</h3>
            <p className="text-xs text-blue-700 mt-0.5">
              Five years is the minimum retention period for issued, paid, and cancelled/voided invoices — records are never automatically deleted after 5 years. Administrators can extend retention, manage legal/audit holds, or review eligible post-5-year records.
            </p>
          </div>
        </div>
      )}

      {viewMode === 'quotes_review' ? (
        <OldQuotesReviewPanel />
      ) : viewMode === 'retention_policy' ? (
        <RetentionAndBackupManagementPanel onRefreshInvoices={refreshInvoices} />
      ) : (
        <>
      {/* Search + Status Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search Bar */}
        <div data-tour="invoices-search" className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by customer/company name, Rego No, email or Job Card number..."
            className="w-full pl-10 pr-10 py-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all"
          />
          <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg shrink-0">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => handleStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                statusFilter === tab.value 
                  ? 'bg-white text-dark shadow-sm' 
                  : 'text-gray-500 hover:text-dark hover:bg-gray-200/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex gap-2 items-center shrink-0">
          <select
            value={datePreset}
            onChange={(e) => applyDateFilter(e.target.value, customFromDate, customToDate)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white font-medium outline-none focus:border-red-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="custom">Custom</option>
          </select>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => applyDateFilter('custom', e.target.value, customToDate)}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-red-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => applyDateFilter('custom', customFromDate, e.target.value)}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:border-red-500"
              />
            </div>
          )}
        </div>

      </div>

      {/* Consolidated email selection bar */}
      {selectedCount > 0 && (
        <div className="sticky top-2 z-20 mb-4 bg-[#222] text-white rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-bold">{selectedCount} invoice{selectedCount === 1 ? '' : 's'} selected</span>
            {selectedCustomer && <span className="text-gray-300"> · {selectedCustomer.name} · ${selectedTotal.toFixed(2)}</span>}
            {hasMixedCustomers && (
              <div className="mt-1 text-red-300 flex items-start gap-1.5">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Multiple Customers Selected.</strong> You have selected invoices belonging to different customers. Please select invoices belonging to a single customer to send them together.
                  <span className="block text-xs text-red-200/80">
                    {customerGroups.map(g => `${g.name}: ${g.invoices.map(i => i.invoiceNo).join(', ')}`).join(' | ')}
                  </span>
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={clearSelection} className="px-3 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/20">Clear selection</button>
            <button
              onClick={openEmailModal}
              disabled={hasMixedCustomers}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={14} /> Send Email
            </button>
          </div>
        </div>
      )}

      {/* UNIFIED INVOICES TABLE */}
      <div data-tour="invoices-list" className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-6 relative min-h-[300px]">
        {loading ? (
          <TableSkeleton rows={10} columns={7} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={searchTerm ? `No invoices matching "${searchTerm}"` : 'No invoices found'}
            description="Adjust your search or date filter to find what you're looking for."
            action={searchTerm ? () => { setSearchTerm(''); applyDateFilter('last_30_days'); } : null}
            actionLabel="Clear Filters"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-4 pl-6 pr-2 w-8">
                    <input type="checkbox" aria-label="Select all invoices" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="w-4 h-4 accent-red-600 cursor-pointer" />
                  </th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice No</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Rego</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status &amp; Archive</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice Date &amp; Retention</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th data-tour="invoices-actions" className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const isPaid = inv.status === 'Paid';
                  const isDraft = inv.status === 'Draft';
                  const isCancelledOrVoided = inv.status === 'Cancelled' || inv.status === 'Voided';
                  const isArchived = Boolean(inv.isArchived || inv.archiveStatus === 'archived');
                  const isReadOnly = isArchived || isCancelledOrVoided;
                  const retention = inv.retentionInfo || {};
                  const displayCustomerName = (inv.customerSnapshot?.name && !isDraft)
                    ? inv.customerSnapshot.name
                    : (inv.customerId?.name || inv.customerSnapshot?.name || 'Unknown');
                  const displayCustomerEmail = (inv.customerSnapshot?.email && !isDraft)
                    ? inv.customerSnapshot.email
                    : (inv.customerId?.email || inv.customerSnapshot?.email || '');
                  const displayCustomerType = (inv.customerSnapshot?.customerType && !isDraft)
                    ? inv.customerSnapshot.customerType
                    : inv.customerId?.customerType;
                  const displayRego = inv.vehicleSnapshot?.registrationNumber || inv.vehicleId?.registrationNumber || inv.trackerCarId?.registrationNumber || '—';
                  const effectiveDate = inv.invoiceDate || inv.createdAt;

                  return (
                    <tr key={inv._id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedInvoices[inv._id] ? 'bg-red-50/40' : ''}`}>
                      <td className="py-4 pl-6 pr-2">
                        <input type="checkbox" aria-label={`Select ${inv.invoiceNo}`} disabled={!isEligible(inv)} checked={Boolean(selectedInvoices[inv._id])} onChange={() => toggleInvoice(inv)} className="w-4 h-4 accent-red-600 cursor-pointer" />
                      </td>
                      <td className={`py-4 px-6 font-mono text-sm ${isPaid ? 'text-green-600' : isCancelledOrVoided ? 'text-gray-400 line-through' : 'text-red-500'}`}>
                        {inv.invoiceNo}
                        {isArchived && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-sans font-bold uppercase">
                            <Lock size={10} /> Read-Only Archive
                          </div>
                        )}
                        {inv.retentionMetadata?.legalHold && (
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-sans font-bold uppercase ml-1">
                            Legal Hold
                          </div>
                        )}
                        {inv.invoiceEmailSent && (
                          <div className="text-[10px] text-gray-400 font-sans mt-0.5" title={inv.lastEmailStatus?.recipientEmail || ''}>
                            ✉ {inv.lastEmailStatus?.mode === 'consolidated' ? 'Consolidated' : 'Emailed'}
                            {inv.lastEmailStatus?.status === 'accepted' ? ' (accepted)' : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-800">
                        <div className="flex items-center">
                          {displayCustomerName}
                          <CustomerTypeBadge type={displayCustomerType} />
                        </div>
                        {displayCustomerEmail && (
                          <div className="text-xs text-gray-400 mt-0.5">{displayCustomerEmail}</div>
                        )}
                        {inv.customerSnapshot?.name && inv.customerId?.name && inv.customerSnapshot.name !== inv.customerId.name && (
                          <div className="text-[10px] text-slate-500 mt-0.5" title="Original billing customer snapshot preserved">
                            Snapshot preserved (Current profile: {inv.customerId.name})
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600 font-mono">
                        {displayRego}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          isPaid
                            ? 'bg-green-100 text-green-700'
                            : isDraft
                            ? 'bg-amber-100 text-amber-800'
                            : isCancelledOrVoided
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {inv.status}
                        </span>
                        {isCancelledOrVoided && inv.cancellationDetails?.reason && (
                          <div className="text-[11px] text-gray-500 mt-1 max-w-[200px]" title={inv.cancellationDetails.reason}>
                            Reason: {inv.cancellationDetails.reason}
                            {inv.cancellationDetails.cancelledByName && (
                              <span className="block text-[10px] text-gray-400">
                                By {inv.cancellationDetails.cancelledByName} · {inv.cancellationDetails.cancelledAt ? new Date(inv.cancellationDetails.cancelledAt).toLocaleDateString('en-AU') : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        <div>{new Date(effectiveDate).toLocaleDateString('en-AU')}</div>
                        {isDraft ? (
                          <div className="text-[11px] text-amber-700 mt-0.5">
                            Inactive: {retention.draftInactiveDays ?? 0}d · {retention.reviewStatus || 'active'}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Retain until: {retention.retainUntil ? new Date(retention.retainUntil).toLocaleDateString('en-AU') : '5+ yrs'}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-sm font-mono font-bold text-dark">
                        ${(inv.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button onClick={() => triggerPrint(inv)} className="text-gray-400 hover:text-blue-500 transition-colors p-1" title="Print / View Invoice">
                            <Printer size={16} />
                          </button>
                          <button 
                            onClick={() => triggerPDF(inv)} 
                            className="text-gray-400 hover:text-blue-500 transition-colors p-1" 
                            title="Download PDF"
                            disabled={pdfGenerating === inv._id}
                          >
                            {pdfGenerating === inv._id ? (
                              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                            ) : (
                              <Download size={16} />
                            )}
                          </button>
                          {!isDraft && !isCancelledOrVoided && (
                            <button onClick={() => triggerSendEmail(inv)} className="text-gray-400 hover:text-blue-500 transition-colors p-1" title="Send Email">
                              <Mail size={16} />
                            </button>
                          )}

                          {/* Active Issued/Unpaid Actions (disabled when Read-Only Archived or Cancelled/Voided) */}
                          {!isReadOnly && !isPaid && !isDraft && (
                            <button 
                              onClick={() => setMarkPaidInvoice(inv)} 
                              className="text-xs font-bold text-green-600 hover:text-green-700 bg-green-500/10 px-2.5 py-1 rounded transition-colors uppercase tracking-wider whitespace-nowrap"
                            >
                              Mark Paid
                            </button>
                          )}

                          {!isReadOnly && !isDraft && (
                            <button
                              onClick={() => setCancelVoidInvoice(inv)}
                              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 px-2.5 py-1 rounded transition-colors uppercase tracking-wider whitespace-nowrap"
                              title="Cancel or Void Invoice (preserves 5-year audit record)"
                            >
                              Cancel / Void
                            </button>
                          )}

                          {/* Draft Actions */}
                          {isDraft && (
                            <>
                              <button
                                onClick={() => handleIssueDraft(inv)}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded"
                              >
                                Issue
                              </button>
                              {viewMode === 'draft_review' && (
                                <button
                                  onClick={() => handleRetentionReviewAction(inv, 'retain', 'Draft retained after 90-day review')}
                                  className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded"
                                >
                                  Retain
                                </button>
                              )}
                              <button
                                onClick={() => deleteInvoice(inv._id)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Delete Draft Invoice"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}

                          {/* 5-Year Retention Review Actions */}
                          {viewMode === 'retention_review' && !isDraft && (
                            <>
                              <button
                                onClick={() => handleRetentionReviewAction(inv, 'retain', 'Retained beyond 5-year minimum period')}
                                className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded border border-green-200"
                              >
                                Retain Longer
                              </button>
                              {inv.retentionMetadata?.legalHold ? (
                                <button
                                  onClick={() => handleRetentionReviewAction(inv, 'clear_legal_hold', 'Legal hold cleared')}
                                  className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200"
                                >
                                  Clear Hold
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRetentionReviewAction(inv, 'set_legal_hold', 'Audit / dispute hold')}
                                  className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200"
                                >
                                  Legal Hold
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} invoices
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
              let pageNum;
              if (pagination.pages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= pagination.pages - 2) {
                pageNum = pagination.pages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    currentPage === pageNum 
                      ? 'bg-red-600 text-white' 
                      : 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={currentPage >= pagination.pages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* CREATE INVOICE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 ">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fade-in-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 bg-[#222]">
              <h2 className="text-xl font-bold">Create Invoice</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-dark transition-colors bg-gray-50 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body - Scrollable */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
              <form id="invoiceForm" onSubmit={handleAddInvoice}>
                
                {/* 1. Type Selector Row */}
                <div className="flex gap-2 mb-8 bg-gray-50 p-2 rounded-lg">
                  {INVOICE_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleTypeSelect(type)}
                      className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${
                        formData.type === type 
                          ? 'bg-red-500/20 text-red-500 border border-red-500/50' 
                          : 'bg-[#222] text-gray-500 hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* 2. Link Entities */}
                <div className="mb-8">
                  <h3 className="text-red-500 font-bold uppercase tracking-wider text-sm mb-4">Link Invoice to Records</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Customer*</label>
                      <EntityAutocomplete
                        placeholder="Search Customer..."
                        fetchOptions={async (q) => {
                          const res = await fetch(`${import.meta.env.VITE_API_URL}/customers?search=${encodeURIComponent(q)}&limit=10`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` } });
                          const data = await res.json();
                          return data.success ? data.data : [];
                        }}
                        getOptionLabel={(c) => `${c.name} - ${c.phone}`}
                        value={formData.customerObj}
                        onSelect={(val) => setFormData({ ...formData, customerObj: val })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 uppercase">Vehicle (Optional)</label>
                      <EntityAutocomplete
                        placeholder="Search Vehicle..."
                        fetchOptions={async (q) => {
                          const url = formData.customerObj 
                            ? `${import.meta.env.VITE_API_URL}/vehicles?search=${encodeURIComponent(q)}&customerId=${formData.customerObj._id}&limit=10`
                            : `${import.meta.env.VITE_API_URL}/vehicles?search=${encodeURIComponent(q)}&limit=10`;
                          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` } });
                          const data = await res.json();
                          return data.success ? data.data : [];
                        }}
                        getOptionLabel={(v) => `${v.registrationNumber} - ${v.brand} ${v.model}`}
                        value={formData.vehicleObj}
                        onSelect={(val) => setFormData({ ...formData, vehicleObj: val })}
                      />
                    </div>
                    {formData.type === 'Service Invoice' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1 uppercase">Job Card (Optional)</label>
                        <EntityAutocomplete
                          placeholder="Search Job Card..."
                          fetchOptions={async (q) => {
                            const params = new URLSearchParams();
                            if (q) params.set('search', q);
                            params.set('limit', '10');
                            if (formData.customerObj?._id) params.set('customerId', formData.customerObj._id);
                            if (formData.vehicleObj?._id) params.set('vehicleId', formData.vehicleObj._id);
                            const res = await fetch(`${import.meta.env.VITE_API_URL}/job-cards?${params.toString()}`, { 
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` } 
                            });
                            const data = await res.json();
                            return data.success ? data.data.filter(j => j.isActive) : [];
                          }}
                          getOptionLabel={(j) => `JC-${j._id.slice(-4).toUpperCase()} — ${j.vehicleId?.registrationNumber || j.trackerCarId?.registrationNumber || 'Unknown'} — ${new Date(j.createdAt).toLocaleDateString()}`}
                          value={formData.jobCardObj}
                          onSelect={onSelectJobCard}
                        />
                      </div>
                    )}

                  </div>
                </div>

                {/* 4. The Internal Tabs (Parts/Checklist/Recommendations) */}
                <div className="mb-8 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                  
                  {/* Tab Headers */}
                  <div className="flex border-b border-gray-100 bg-[#222]">
                    {['Parts, Labour & Service Charges', 'Checklist', 'Recommendations'].map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${
                          activeTab === tab 
                            ? 'bg-red-500/10 text-red-400 border-b-2 border-red-500' 
                            : 'text-gray-500 hover:text-dark hover:bg-gray-50'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Tab Body */}
                  <div className="p-5">
                    
                    {/* --- PARTS & LABOUR TAB --- */}
                    {activeTab === 'Parts, Labour & Service Charges' && (
                      <div className="animate-fade-in">
                        {/* INVENTORY PART SELECTION */}
                        <div className="mb-6 p-4 border border-gray-100 bg-gray-50/50 rounded-lg">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Add from Inventory</h4>
                          <div className="flex gap-2">
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
                                        flat.push({ ...item, inventoryId: item._id, valueId: item._id, label: `${item.itemName || item.productName} - $${(item.unitPrice||0).toFixed(2)}` });
                                      } else {
                                        item.variants.forEach(v => {
                                          if (v.isActive) {
                                            flat.push({ ...v, inventoryId: item._id, variantId: v._id, valueId: `${item._id}_${v._id}`, label: `${item.itemName || item.productName} (${v.name || v.variantName}) - $${(v.unitPrice||0).toFixed(2)}` });
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
                                onSelect={(val) => setSelectedInvPartObj(val)}
                              />
                            </div>
                            <div className="w-20">
                              <input type="number" min="1" value={invPartQty} onChange={(e) => setInvPartQty(e.target.value)} placeholder="Qty" className="w-full bg-white border border-gray-100 rounded px-3 py-2 text-sm text-dark focus:border-red-500 outline-none text-center" />
                            </div>
                            <div className="w-20 flex items-end">
                              <button type="button" onClick={addInvPart} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded text-xs uppercase tracking-wider transition-colors h-[38px]">
                                Add
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* MANUAL ENTRY */}
                        <div className="mb-4">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Add Manual Item / Labour / Service Charge</h4>
                          <div className="flex gap-2">
                            <div className="flex-grow">
                              <input type="text" value={plDesc} onChange={(e) => setPlDesc(e.target.value)} placeholder="Item Description / Labour / Service Charge" className="w-full bg-white border border-gray-100 rounded px-3 py-2 text-sm text-dark focus:border-red-500 outline-none" />
                            </div>
                            <div className="w-20">
                              <input type="number" min="1" value={plQty} onChange={(e) => setPlQty(e.target.value)} placeholder="Qty" className="w-full bg-white border border-gray-100 rounded px-3 py-2 text-sm text-dark focus:border-red-500 outline-none text-center" />
                            </div>
                            <div className="w-28">
                              <input type="number" step="0.01" value={plPrice} onChange={(e) => setPlPrice(e.target.value)} placeholder="Price" className="w-full bg-white border border-gray-100 rounded px-3 py-2 text-sm text-dark focus:border-red-500 outline-none font-mono" />
                            </div>
                            <div className="w-20 flex items-end">
                              <button type="button" onClick={addPartAndLabour} className="w-full bg-gray-50 hover:bg-red-600 text-dark font-bold py-2 rounded text-xs uppercase tracking-wider transition-colors h-[38px]">
                                Add
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* List */}
                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                          {formData.partsAndLabour.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border border-gray-100 group">
                              <div className="flex-1 text-sm text-gray-700">{item.description}</div>
                              <div className="w-20 text-center text-sm text-gray-500">x{item.qty}</div>
                              <div className="w-28 font-mono text-sm text-dark">${item.price.toFixed(2)}</div>
                              <div className="w-8 text-right">
                                <button type="button" onClick={() => removePartAndLabour(idx)} className="text-gray-500 hover:text-red-500">
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                          {formData.partsAndLabour.length === 0 && (
                            <p className="text-center text-gray-500 text-sm py-4">No items added yet.</p>
                          )}
                        </div>
                        
                        {/* Tab Subtotal */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Total (Parts, Labour & Service Charges)</span>
                          <span className="text-xl font-bold font-mono text-dark">${liveTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* --- CHECKLIST TAB --- */}
                    {activeTab === 'Checklist' && (
                      <div className="animate-fade-in">
                        <div className="flex gap-2 mb-4">
                          <input 
                            type="text" value={customChecklist} onChange={(e) => setCustomChecklist(e.target.value)} placeholder="Add custom checklist item"
                            className="flex-grow bg-white border border-gray-100 rounded px-3 py-2 text-sm text-dark focus:border-red-500 outline-none"
                          />
                          <button type="button" onClick={addCustomChecklist} className="bg-gray-50 hover:bg-red-600 text-dark font-bold px-6 py-2 rounded text-xs uppercase tracking-wider transition-colors">
                            Add
                          </button>
                        </div>
                        
                        <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                          {/* Presets */}
                          {CHECKLIST_PRESETS.map(item => (
                            <label key={item} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded cursor-pointer group hover:border-red-500/50 transition-colors">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.checklist.includes(item) ? 'bg-red-500 border-red-500' : 'border-gray-500'}`}>
                                {formData.checklist.includes(item) && <CheckCircle size={14} className="text-dark" />}
                              </div>
                              <span className="text-sm text-gray-700 group-hover:text-dark transition-colors">{item}</span>
                              <input type="checkbox" className="hidden" checked={formData.checklist.includes(item)} onChange={() => toggleChecklist(item)} />
                            </label>
                          ))}
                          
                          {/* Custom Added */}
                          {formData.checklist.filter(i => !CHECKLIST_PRESETS.includes(i)).map((item, idx) => (
                            <label key={`custom-${idx}`} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded cursor-pointer group hover:border-red-500/50 transition-colors">
                              <div className="w-5 h-5 rounded border border-red-500 bg-red-500 flex items-center justify-center">
                                <CheckCircle size={14} className="text-dark" />
                              </div>
                              <span className="text-sm text-gray-700">{item}</span>
                              <input type="checkbox" className="hidden" checked onChange={() => toggleChecklist(item)} />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* --- RECOMMENDATIONS TAB --- */}
                    {activeTab === 'Recommendations' && (
                      <div className="animate-fade-in">
                        <div className="flex gap-2 mb-4">
                          <input 
                            type="text" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Add Recommendation"
                            className="flex-grow bg-white border border-gray-100 rounded px-3 py-2 text-sm text-dark focus:border-red-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRecommendation())}
                          />
                          <button type="button" onClick={addRecommendation} className="bg-gray-50 hover:bg-red-600 text-dark font-bold px-6 py-2 rounded text-xs uppercase tracking-wider transition-colors">
                            Add
                          </button>
                        </div>
                        
                        <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                          {formData.recommendations.map((rec, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border border-gray-100 group">
                              <div className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">•</span> {rec}
                              </div>
                              <button type="button" onClick={() => removeRecommendation(idx)} className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                          {formData.recommendations.length === 0 && (
                            <p className="text-center text-gray-500 text-sm py-4">No recommendations added.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Notes */}
                <div>
                  <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Notes</label>
                  <textarea 
                    name="notes" value={formData.notes} onChange={handleInputChange} rows="2"
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:border-red-500 outline-none resize-none"
                  ></textarea>
                </div>
                
              </form>
            </div>
            
            {/* Modal Footer (Sticky) */}
            <div className="p-6 border-t border-gray-100 bg-[#222] flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-4">
              <div className="w-full sm:w-auto">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="block font-bold text-white uppercase tracking-wider text-sm mb-1">TOTAL INC. GST ({currentGstRate}%)</span>
                    <span className="text-[10px] text-gray-400">Calculated automatically</span>
                  </div>
                  <span className="text-2xl font-bold font-mono text-red-500 ml-4">${liveTotal.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => submitInvoiceForm('Draft')}
                  className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-lg text-sm font-bold text-amber-300 border border-amber-400/40 hover:bg-amber-500/10 transition-colors"
                >
                  Save as Draft
                </button>
                <button form="invoiceForm" type="submit" className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20">
                  Create Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {isEmailModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl overflow-hidden my-8">
            <div className="p-5 bg-[#222] flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Mail size={18} /> Send Invoices by Email</h2>
              <button onClick={() => !emailSending && setIsEmailModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-bold">{selectedCustomer.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Recipient</span>
                  <span className={`font-bold ${customerEmailValid ? '' : 'text-red-600'}`}>{customerEmailValid ? selectedCustomer.email : 'No valid email on record'}</span>
                </div>
                <div className="flex justify-between"><span className="text-gray-500">Invoices</span><span className="font-bold">{selectedCount}</span></div>
              </div>

              <div className="border border-gray-100 rounded-lg divide-y max-h-56 overflow-y-auto">
                {selectedList.map(inv => (
                  <div key={inv._id} className="flex justify-between items-center px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip size={13} className="text-gray-400 shrink-0" />
                      <span className="font-mono truncate">Invoice_{String(inv.invoiceNo).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf</span>
                      {inv.invoiceEmailSent && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 rounded">sent before</span>}
                    </div>
                    <span className="font-mono font-bold">${(Number(inv.totalAmount) || 0).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 bg-gray-50 font-bold">
                  <span>Combined amount (AUD)</span><span className="font-mono">${selectedTotal.toFixed(2)}</span>
                </div>
              </div>

              {!customerEmailValid && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex gap-2"><AlertCircle size={16} className="shrink-0 mt-0.5" />
                  This customer has no valid registered email address. Add one to the customer record before sending.</div>
              )}
              {alreadyEmailedSelected.length > 0 && (
                <label className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 cursor-pointer">
                  <input type="checkbox" checked={resendConfirmed} onChange={e => setResendConfirmed(e.target.checked)} className="mt-0.5 accent-red-600" />
                  <span>{alreadyEmailedSelected.map(i => i.invoiceNo).join(', ')} {alreadyEmailedSelected.length === 1 ? 'was' : 'were'} already emailed. I confirm I want to resend.</span>
                </label>
              )}
              {emailError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
                  <div className="font-bold">{emailError.title}</div><div>{emailError.message}</div>
                </div>
              )}
              <p className="text-xs text-gray-500">All PDFs are sent in a single email. Brevo acceptance does not guarantee delivery.</p>
            </div>
            <div className="p-5 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button disabled={emailSending} onClick={() => setIsEmailModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button
                disabled={emailSending || !customerEmailValid || (alreadyEmailedSelected.length > 0 && !resendConfirmed)}
                onClick={handleSendConsolidated}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {emailSending ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Confirm &amp; Send</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {markPaidInvoice && (
        <MarkPaidModal 
          invoice={markPaidInvoice} 
          onClose={() => setMarkPaidInvoice(null)}
          onSuccess={refreshInvoices}
        />
      )}

      {/* Cancel / Void Invoice Modal */}
      {cancelVoidInvoice && (
        <CancelVoidInvoiceModal
          invoice={cancelVoidInvoice}
          onClose={() => setCancelVoidInvoice(null)}
          onSuccess={refreshInvoices}
        />
      )}

      {/* Off-screen Printable Invoice — visible but positioned off-screen for html2canvas */}
      <div style={{ 
        position: 'fixed', 
        left: '-9999px', 
        top: 0, 
        width: '210mm',
        zIndex: -1,
        backgroundColor: '#ffffff',
      }}>
        <PrintableInvoice ref={printRef} invoice={selectedInvoiceForPrint} settings={settings} />
      </div>
    </div>
  );
};

export default Invoices;
