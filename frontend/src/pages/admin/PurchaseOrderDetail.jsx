import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Building2, Calendar, FileText, CheckCircle2, Clock, MapPin, Inbox, AlertTriangle, Edit2,
    Mail, Send, Loader2, RefreshCw, AlertCircle, X, Eye, Paperclip
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/ToastContext';

const CONFIRMED_PO_STATUSES = ['Ordered', 'Partially Received', 'Received'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_STATUS_META = {
  not_sent: { label: 'Not Sent', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  accepted: { label: 'Accepted by Brevo', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  delivered: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  opened: { label: 'Opened', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  deferred: { label: 'Deferred', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  bounced: { label: 'Bounced', className: 'bg-red-50 text-red-700 border-red-200' },
  blocked: { label: 'Blocked', className: 'bg-red-50 text-red-700 border-red-200' },
  failed: { label: 'Send Failed', className: 'bg-red-50 text-red-700 border-red-200' }
};

const EmailStatusBadge = ({ status }) => {
  const key = (status || 'not_sent').toLowerCase();
  const meta = EMAIL_STATUS_META[key] || EMAIL_STATUS_META.not_sent;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const makeEmailKey = (poId) => `po-email-${poId || 'init'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const sanitizeEmailHtml = (rawHtml) => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');
  const blockedTags = ['script', 'iframe', 'object', 'embed', 'form', 'base'];
  blockedTags.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });
  doc.querySelectorAll('meta[http-equiv]').forEach((el) => {
    const val = (el.getAttribute('http-equiv') || '').toLowerCase();
    if (val === 'refresh') el.remove();
  });
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const val = (attr.value || '').trim().toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if ((name === 'href' || name === 'src' || name === 'action') && (val.startsWith('javascript:') || val.startsWith('vbscript:') || val.startsWith('data:text/html'))) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return `<!DOCTYPE html><html>${doc.head ? doc.head.outerHTML : ''}${doc.body ? doc.body.outerHTML : ''}</html>`;
};

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isReceivingModalOpen, setIsReceivingModalOpen] = useState(false);
  const [receivingItem, setReceivingItem] = useState(null);
  const [receiveQuantity, setReceiveQuantity] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  // Purchase Order Email Modal & State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState(null);
  const [emailIdempotencyKey, setEmailIdempotencyKey] = useState(() => makeEmailKey(id));
  const [isRefreshingDelivery, setIsRefreshingDelivery] = useState(false);
  const [selectedEmailLog, setSelectedEmailLog] = useState(null);
  const [emailViewMode, setEmailViewMode] = useState('html');
  const emailInFlightRef = useRef(false);

  useEffect(() => {
    if (!selectedEmailLog) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedEmailLog(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedEmailLog]);

  const fetchPO = async () => {
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPo(data);
      } else {
        alert('Purchase Order not found');
        navigate('/admin/purchase-orders');
      }
    } catch (error) {
      console.error('Failed to fetch PO:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPO();
  }, [id]);

  const updateStatus = async (action) => {
    if (!action) return;
    
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders/${id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        fetchPO();
      } else {
        const err = await response.json();
        alert(err.message || `Failed to ${action} PO`);
      }
    } catch (error) {
      console.error(error);
      alert('Error updating status');
    } finally {
      setPendingAction(null);
    }
  };

    const openEditModal = () => {
        setEditForm({
            supplierId: po.supplierId?._id,
            expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString().slice(0, 10) : '',
            notes: po.notes || '',
            items: po.items.map((item) => ({
                inventoryId: item.inventoryId,
                variantId: item.variantId,
                productName: item.productName,
                variantName: item.variantName,
                sku: item.sku,
                quantityOrdered: item.quantityOrdered,
                unitPurchasePrice: item.unitPurchasePrice
            }))
        });
        setIsEditModalOpen(true);
    };

    const saveDraft = async (event) => {
        event.preventDefault();
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('gsk_token')}`
                },
                body: JSON.stringify(editForm)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to update purchase order');
            setIsEditModalOpen(false);
            await fetchPO();
        } catch (error) {
            alert(error.message || 'Unable to update purchase order');
        }
    };

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    const qty = parseInt(receiveQuantity, 10);
    
    if (qty <= 0) {
        alert("Quantity received must be greater than zero.");
        return;
    }
    
    const outstanding = receivingItem.quantityOrdered - receivingItem.quantityReceived;
    if (qty > outstanding) {
        alert(`Cannot receive more than the outstanding quantity (${outstanding}).`);
        return;
    }

    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders/${id}/receive`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
            itemId: receivingItem._id,
            quantityReceived: qty
        })
      });
      
      if (response.ok) {
        setIsReceivingModalOpen(false);
        setReceivingItem(null);
        setReceiveQuantity('');
        fetchPO();
      } else {
        const err = await response.json();
        alert(err.message || `Failed to receive stock`);
      }
    } catch (error) {
      console.error(error);
      alert('Error receiving stock');
    }
  };

  const openSendEmailModal = () => {
    setEmailFeedback(null);
    setEmailIdempotencyKey(makeEmailKey(po?._id || id));
    setIsEmailModalOpen(true);
  };

  const handleSendPurchaseOrderEmail = async () => {
    if (!po || isSendingEmail || emailInFlightRef.current) return;

    const supplierEmail = String(po.supplierId?.email || '').trim();
    if (!supplierEmail || !EMAIL_REGEX.test(supplierEmail)) {
      setEmailFeedback({
        type: 'error',
        message: 'Supplier does not have a valid registered email address. Please update the supplier record before sending.'
      });
      return;
    }

    const hasPriorSuccess = (po.emailHistory || []).some(e => e.status && e.status !== 'failed');

    emailInFlightRef.current = true;
    setIsSendingEmail(true);
    setEmailFeedback(null);

    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders/${id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          resend: hasPriorSuccess,
          idempotencyKey: emailIdempotencyKey
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.purchaseOrder) {
          setPo(data.purchaseOrder);
        } else {
          await fetchPO();
        }
        setEmailIdempotencyKey(makeEmailKey(id));
        const msg = data. message || `Purchase Order email accepted by Brevo for ${supplierEmail}`;
        setEmailFeedback({ type: 'success', message: msg });
        toast.success(msg);
      } else {
        if (data.purchaseOrder) {
          setPo(data.purchaseOrder);
        }
        const errMsg = data.message || data.error || 'Failed to send Purchase Order email.';
        setEmailFeedback({ type: 'error', message: errMsg });
        toast.error(errMsg);
      }
    } catch (err) {
      console.error(err);
      const errMsg = 'Network or server error while sending Purchase Order email.';
      setEmailFeedback({ type: 'error', message: errMsg });
      toast.error(errMsg);
    } finally {
      emailInFlightRef.current = false;
      setIsSendingEmail(false);
    }
  };

  const handleRefreshDeliveryStatus = async () => {
    if (isRefreshingDelivery) return;
    setIsRefreshingDelivery(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders/${id}/email-history?refreshDelivery=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPo(prev => prev ? {
          ...prev,
          lastEmailStatus: data.lastEmailStatus,
          emailHistory: data.emailHistory
        } : prev);
        toast.success('Email delivery status refreshed.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshingDelivery(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Purchase Order...</div>;
  if (!po) return null;

  const isConfirmedPO = CONFIRMED_PO_STATUSES.includes(po.status);
  const supplierEmail = String(po.supplierId?.email || '').trim();
  const hasValidSupplierEmail = Boolean(supplierEmail && EMAIL_REGEX.test(supplierEmail));
  const successfulEmailSends = (po.emailHistory || []).filter(e => e.status && e.status !== 'failed');
  const hasBeenEmailed = successfulEmailSends.length > 0 || (po.lastEmailStatus?.sendCount > 0);
  const sortedEmailHistory = [...(po.emailHistory || [])].sort(
    (a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime()
  );

  const getStatusBadge = () => {
    const s = po.status;
    let classes = 'bg-gray-100 text-gray-700 border-gray-200';
    if (s === 'Ordered') classes = 'bg-blue-100 text-blue-700 border-blue-200';
    if (s === 'Partially Received') classes = 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (s === 'Received') classes = 'bg-green-100 text-green-700 border-green-200';
    if (s === 'Cancelled') classes = 'bg-red-100 text-red-700 border-red-200';
    
    return <span className={`px-3 py-1 rounded-full text-sm font-bold border ${classes}`}>{s}</span>;
  };

  return (
    <div className="max-w-[1200px] mx-auto text-dark">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/admin/purchase-orders')} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Purchase Orders
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div>
          <div className="flex items-center flex-wrap gap-3 mb-1">
            <h1 className="font-heading text-2xl font-bold">{po.purchaseOrderNumber}</h1>
            {getStatusBadge()}
            {isConfirmedPO && (
              <EmailStatusBadge status={po.lastEmailStatus?.status || 'not_sent'} />
            )}
          </div>
          <p className="text-sm text-gray-500">
            Created on {new Date(po.createdAt).toLocaleDateString()} by {po.createdBy?.name || po.createdBy?.email || 'Unknown user'}
          </p>
        </div>
        
        <div className="ml-auto flex flex-wrap gap-3">
            {po.status === 'Draft' && (
                <>
                    <button onClick={openEditModal} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-bold transition-colors flex items-center gap-2" aria-label="Edit">
<Edit2 size={15} /> Edit Draft
                    </button>
                    <button onClick={() => setPendingAction('cancel')} className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-bold transition-colors">
                        Cancel PO
                    </button>
                    <button onClick={() => setPendingAction('place')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-md shadow-blue-500/20 transition-colors">
                        Place Order
                    </button>
                </>
            )}
            {isConfirmedPO && (
                <button
                    type="button"
                    data-testid="send-po-email-btn"
                    onClick={openSendEmailModal}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold shadow-md shadow-red-500/20 transition-colors flex items-center gap-2"
                >
                    <Mail size={16} />
                    {hasBeenEmailed ? 'Resend Purchase Order Email' : 'Send Purchase Order Email'}
                </button>
            )}
            {po.status === 'Ordered' && (
                <button onClick={() => setPendingAction('cancel')} className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-bold transition-colors">
                    Cancel PO
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* Items Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="font-bold text-lg font-heading flex items-center gap-2">
                        <Inbox size={20} className="text-blue-500" /> Order Items
                    </h2>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Ordered</th>
                                <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Received</th>
                                <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">O/S</th>
                                <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Unit Price</th>
                                <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
                                <th className="py-3 px-5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {po.items.map((item, idx) => {
                                const outstanding = item.quantityOrdered - item.quantityReceived;
                                const isComplete = outstanding === 0;
                                
                                return (
                                    <tr key={idx} className={`border-t border-gray-100 ${isComplete ? 'bg-green-50/30' : ''}`}>
                                        <td className="py-4 px-5">
                                            <div className="font-bold text-dark">{item.productName}</div>
                                            <div className="text-xs text-gray-500">
                                                {item.hierarchyPath || item.variantName} {item.sku ? `| SKU: ${item.sku}` : ''}
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-center font-medium">{item.quantityOrdered}</td>
                                        <td className="py-4 px-5 text-center font-medium text-green-600">{item.quantityReceived}</td>
                                        <td className="py-4 px-5 text-center font-bold text-orange-500">{outstanding}</td>
                                        <td className="py-4 px-5 text-right">${item.unitPurchasePrice.toFixed(2)}</td>
                                        <td className="py-4 px-5 text-right font-bold">${(item.quantityOrdered * item.unitPurchasePrice).toFixed(2)}</td>
                                        <td className="py-4 px-5 text-center">
                                            {(po.status === 'Ordered' || po.status === 'Partially Received') && outstanding > 0 ? (
                                                <button 
                                                    onClick={() => {
                                                        setReceivingItem(item);
                                                        setReceiveQuantity(outstanding);
                                                        setIsReceivingModalOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Receive
                                                </button>
                                            ) : isComplete ? (
                                                <span className="text-green-500"><CheckCircle2 size={18} className="mx-auto"/></span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Notes */}
            {po.notes && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wider mb-2">Notes & Instructions</h2>
                    <p className="text-gray-700 whitespace-pre-wrap">{po.notes}</p>
                </div>
            )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
            
            {/* Supplier Info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Supplier Info</h2>
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100 shrink-0">
                        <Building2 size={20} className="text-gray-400" />
                    </div>
                    <div>
                        <div className="font-bold text-lg leading-tight">{po.supplierId?.name || 'Unknown Supplier'}</div>
                        {po.supplierId?.contactPerson && (
                            <div className="text-sm text-gray-500 mt-0.5">Attn: {po.supplierId.contactPerson}</div>
                        )}
                    </div>
                </div>
                
                <div className="space-y-2 text-sm">
                    {po.supplierId?.phone && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <span className="text-gray-400 w-5">📞</span> {po.supplierId.phone}
                        </div>
                    )}
                    {po.supplierId?.email && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <span className="text-gray-400 w-5">✉️</span> {po.supplierId.email}
                        </div>
                    )}
                    {po.supplierId?.address && (
                        <div className="flex items-start gap-2 text-gray-600 mt-2">
                            <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" /> 
                            <span>{po.supplierId.address}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">Order Summary</h2>
                
                <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>Expected Delivery</span>
                        <span className="font-medium text-dark flex items-center gap-1">
                            <Calendar size={14} className="text-blue-500"/>
                            {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'TBD'}
                        </span>
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-600 pt-3 border-t border-gray-100">
                        <span>Subtotal</span>
                        <span className="font-medium text-dark">${po.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                        <span>GST ({po.gstRate}%)</span>
                        <span className="font-medium text-dark">${po.taxAmount.toFixed(2)}</span>
                    </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center border border-blue-100">
                    <span className="font-bold text-blue-900">Total</span>
                    <span className="font-heading text-2xl font-bold text-blue-600">
                        ${po.totalAmount.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Supplier Email Status & Sending History */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5" data-testid="po-email-status-section">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
                    <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Mail size={15} className="text-red-600" /> Supplier Email Status
                    </h2>
                    {po.lastEmailStatus?.lastBrevoMessageId && (
                        <button
                            type="button"
                            onClick={handleRefreshDeliveryStatus}
                            disabled={isRefreshingDelivery}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                            title="Check Brevo delivery status"
                        >
                            <RefreshCw size={12} className={isRefreshingDelivery ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    )}
                </div>

                <div className="space-y-2.5 text-sm mb-4">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500">Latest Status</span>
                        <EmailStatusBadge status={po.lastEmailStatus?.status || 'not_sent'} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500 shrink-0">Supplier Email</span>
                        <span className={`font-medium truncate ${hasValidSupplierEmail ? 'text-dark' : 'text-red-600'}`}>
                            {supplierEmail || 'No email registered'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500">Times Sent</span>
                        <span className="font-bold text-dark">{po.lastEmailStatus?.sendCount || successfulEmailSends.length || 0}</span>
                    </div>
                    {po.lastEmailStatus?.lastSentAt && (
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500">Last Sent</span>
                            <span className="text-xs font-medium text-gray-700">
                                {new Date(po.lastEmailStatus.lastSentAt).toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>

                {!isConfirmedPO ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                        {po.status === 'Draft'
                            ? 'Confirm (Place Order) this Purchase Order to enable sending the official PO email to the supplier.'
                            : 'This Purchase Order is cancelled and cannot be emailed to the supplier.'}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={openSendEmailModal}
                        className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <Send size={14} />
                        {hasBeenEmailed ? 'Resend Purchase Order Email' : 'Send Purchase Order Email'}
                    </button>
                )}

                {/* Email Sending History */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Sending History ({sortedEmailHistory.length})
                    </h3>
                    {sortedEmailHistory.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No email attempts recorded yet.</p>
                    ) : (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                            {sortedEmailHistory.map((log, idx) => (
                                <div
                                    key={log._id || idx}
                                    onClick={() => {
                                        setSelectedEmailLog(log);
                                        setEmailViewMode(log.htmlContent ? 'html' : 'text');
                                    }}
                                    className="p-3 rounded-lg border border-gray-200/80 bg-gray-50/70 hover:bg-white hover:border-red-200 hover:shadow-sm transition-all cursor-pointer text-xs space-y-1.5"
                                    data-testid="po-email-history-item"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <EmailStatusBadge status={log.status} />
                                        <span className="text-[11px] text-gray-500">
                                            {log.sentAt ? new Date(log.sentAt).toLocaleString() : 'N/A'}
                                        </span>
                                    </div>
                                    {log.subject && (
                                        <div className="font-semibold text-gray-800 truncate" title={log.subject}>
                                            {log.subject}
                                        </div>
                                    )}
                                    <div className="text-gray-700 truncate">
                                        <strong>To:</strong> {log.supplierEmail}
                                    </div>
                                    <div className="text-gray-500 flex items-center justify-between flex-wrap gap-1">
                                        <span><strong>By:</strong> {log.sentBy?.name || log.sentByName || 'Admin'}</span>
                                        <div className="flex items-center gap-1">
                                            {log.isResend && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                    Resend
                                                </span>
                                            )}
                                            {log.pdfAttached && (
                                                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                                                    PDF
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {log.brevoMessageId && (
                                        <div className="text-[10px] text-gray-400 font-mono truncate">
                                            ID: {log.brevoMessageId}
                                        </div>
                                    )}
                                    {log.failureReason && (
                                        <div className="text-[11px] text-red-600 font-medium mt-1">
                                            Error: {log.failureReason}
                                        </div>
                                    )}
                                    <div className="pt-1 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedEmailLog(log);
                                                setEmailViewMode(log.htmlContent ? 'html' : 'text');
                                            }}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700"
                                            data-testid="view-full-email-btn"
                                        >
                                            <Eye size={12} /> View Full Email
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
        </div>
      </div>

      {/* Send Purchase Order Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="send-po-email-modal">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                  <Mail size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-heading text-dark">
                    {hasBeenEmailed ? 'Resend Purchase Order Email' : 'Send Purchase Order Email'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Purchase Order #{po.purchaseOrderNumber} &bull; GSK Automotive
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSendingEmail}
                onClick={() => setIsEmailModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {emailFeedback && (
                <div
                  role="status"
                  className={`p-3.5 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
                    emailFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {emailFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{emailFeedback.message}</span>
                </div>
              )}

              {!hasValidSupplierEmail && (
                <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block mb-0.5">Missing or Invalid Supplier Email Address</strong>
                    The supplier <strong>{po.supplierId?.name || 'Unknown'}</strong> does not have a valid registered email address. Please add a valid email address on the Suppliers page before sending.
                  </div>
                </div>
              )}

              {hasBeenEmailed && hasValidSupplierEmail && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block mb-0.5">Previously Emailed Purchase Order</strong>
                    This purchase order was already sent ({successfulEmailSends.length} {successfulEmailSends.length === 1 ? 'time' : 'times'}
                    {po.lastEmailStatus?.lastSentAt ? `, last on ${new Date(po.lastEmailStatus.lastSentAt).toLocaleString()}` : ''}).
                    Click <strong>Confirm &amp; Resend Email</strong> below to intentionally send a fresh copy.
                  </div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2.5 text-sm">
                <div className="flex justify-between items-center border-b border-gray-200/70 pb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Supplier</span>
                  <span className="font-bold text-dark">{po.supplierId?.name || 'Unknown Supplier'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200/70 pb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Recipient Email</span>
                  <span
                    data-testid="po-recipient-email-display"
                    className={`font-bold ${hasValidSupplierEmail ? 'text-blue-700' : 'text-red-600'}`}
                  >
                    {supplierEmail || 'No email registered'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200/70 pb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Email Subject</span>
                  <span className="font-medium text-gray-800 text-xs">
                    Purchase Order #{po.purchaseOrderNumber} – GSK Automotive
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-200/70 pb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">PDF Attachment</span>
                  <span className="font-mono text-xs text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200">
                    GSK_PO_{po.purchaseOrderNumber}.pdf
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase">Order Summary</span>
                  <span className="font-bold text-dark">
                    {po.items?.length || 0} {po.items?.length === 1 ? 'item' : 'items'} &bull; ${po.totalAmount.toFixed(2)} AUD
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSendingEmail}
                onClick={() => setIsEmailModalOpen(false)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                data-testid="confirm-send-po-email-btn"
                disabled={isSendingEmail || !hasValidSupplierEmail || !isConfirmedPO}
                onClick={handleSendPurchaseOrderEmail}
                className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending via Brevo...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    {hasBeenEmailed ? 'Confirm & Resend Email' : 'Send Purchase Order Email'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receiving Modal */}
      {isReceivingModalOpen && receivingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold font-heading">Receive Stock</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {receivingItem.productName} - {receivingItem.variantName}
                    </p>
                </div>
                
                <div className="p-6">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex items-start gap-3">
                        <AlertTriangle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            You are about to receive stock. This action will permanently increase inventory levels for this specific variant and cannot be undone directly from here.
                        </div>
                    </div>
                    
                    <div className="flex justify-between mb-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div>
                            <div className="text-gray-500">Ordered</div>
                            <div className="font-bold text-lg">{receivingItem.quantityOrdered}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-gray-500">Received</div>
                            <div className="font-bold text-lg text-green-600">{receivingItem.quantityReceived}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-gray-500">Outstanding</div>
                            <div className="font-bold text-lg text-orange-500">{receivingItem.quantityOrdered - receivingItem.quantityReceived}</div>
                        </div>
                    </div>

                    <form id="receiveForm" onSubmit={handleReceiveStock}>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Quantity Receiving Now *</label>
                        <input 
                            type="number" min="1" max={receivingItem.quantityOrdered - receivingItem.quantityReceived}
                            value={receiveQuantity}
                            onChange={(e) => setReceiveQuantity(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition-colors text-lg font-bold"
                            required
                        />
                    </form>
                </div>
                
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={() => { setIsReceivingModalOpen(false); setReceivingItem(null); }}
                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" form="receiveForm"
                        className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
                    >
                        Confirm Receipt
                    </button>
                </div>
            </div>
        </div>
      )}

            {isEditModalOpen && editForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold font-heading">Edit Draft Purchase Order</h2>
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-red-500">Close</button>
                        </div>
                        <form onSubmit={saveDraft} className="p-6 overflow-y-auto space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expected Delivery</label>
                                    <input type="date" value={editForm.expectedDeliveryDate} onChange={(event) => setEditForm((current) => ({ ...current, expectedDeliveryDate: event.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Supplier</label>
                                    <div className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600">{po.supplierId?.name || 'Current supplier'}</div>
                                </div>
                            </div>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50"><tr><th className="p-3">Item</th><th className="p-3">Quantity</th><th className="p-3">Unit Price</th></tr></thead>
                                    <tbody>
                                        {editForm.items.map((item, index) => (
                                            <tr key={item.variantId} className="border-t border-gray-100">
                                                <td className="p-3"><div className="font-medium">{item.productName}</div><div className="text-xs text-gray-500">{item.variantName} {item.sku ? `(${item.sku})` : ''}</div></td>
                                                <td className="p-3"><input type="number" min="1" value={item.quantityOrdered} onChange={(event) => setEditForm((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantityOrdered: event.target.value } : row) }))} className="w-28 border border-gray-200 rounded-lg px-2 py-1.5" /></td>
                                                <td className="p-3"><input type="number" min="0" step="0.01" value={item.unitPurchasePrice} onChange={(event) => setEditForm((current) => ({ ...current, items: current.items.map((row, rowIndex) => rowIndex === index ? { ...row, unitPurchasePrice: event.target.value } : row) }))} className="w-32 border border-gray-200 rounded-lg px-2 py-1.5" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</label>
                                <textarea value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} rows="3" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 resize-none" />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold">Save Draft</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
      {/* Sent Purchase Order Email History Viewer Modal */}
      {selectedEmailLog && createPortal(
        <div
          className="fixed inset-0 lg:left-[240px] bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-3 sm:p-6 overflow-x-hidden"
          data-testid="po-email-viewer-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Sent Purchase Order Email"
          onClick={() => setSelectedEmailLog(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                  <Mail size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold font-heading text-dark truncate">
                      Sent Purchase Order Email
                    </h2>
                    <EmailStatusBadge status={selectedEmailLog.status} />
                    {selectedEmailLog.isResend && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                        Resend
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    PO #{selectedEmailLog.purchaseOrderNumber || po.purchaseOrderNumber} &bull; Sent {selectedEmailLog.sentAt ? new Date(selectedEmailLog.sentAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmailLog(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close email viewer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Email Information */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-2.5 text-xs sm:text-sm">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Email Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-gray-500 font-medium">From: </span>
                    <span className="text-dark font-semibold">
                      {selectedEmailLog.senderName || 'GSK Automotive'}
                      {selectedEmailLog.senderEmail ? ` <${selectedEmailLog.senderEmail}>` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">To: </span>
                    <span className="text-dark font-semibold break-all">
                      {selectedEmailLog.supplierEmail}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-500 font-medium">Subject: </span>
                    <span className="text-dark font-semibold">
                      {selectedEmailLog.subject || `Purchase Order #${selectedEmailLog.purchaseOrderNumber || po.purchaseOrderNumber}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Sent Date &amp; Time: </span>
                    <span className="text-dark">
                      {selectedEmailLog.sentAt ? new Date(selectedEmailLog.sentAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Sent By: </span>
                    <span className="text-dark">
                      {selectedEmailLog.sentBy?.name || selectedEmailLog.sentByName || 'GSK Automotive Admin'}
                    </span>
                  </div>
                  {selectedEmailLog.brevoMessageId && (
                    <div className="md:col-span-2">
                      <span className="text-gray-500 font-medium">Brevo Message ID: </span>
                      <span className="font-mono text-xs text-gray-700 break-all">
                        {selectedEmailLog.brevoMessageId}
                      </span>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {((selectedEmailLog.attachments && selectedEmailLog.attachments.length > 0) || selectedEmailLog.pdfAttached) && (
                  <div className="pt-2 border-t border-gray-200/70 flex flex-wrap items-center gap-2">
                    <span className="text-gray-500 font-medium flex items-center gap-1">
                      <Paperclip size={13} /> Attachments:
                    </span>
                    {selectedEmailLog.attachments && selectedEmailLog.attachments.length > 0 ? (
                      selectedEmailLog.attachments.map((att, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700"
                        >
                          <FileText size={12} className="text-red-600" />
                          <span>{att.filename}</span>
                          {att.size > 0 && <span className="text-gray-400">({formatBytes(att.size)})</span>}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700">
                        <FileText size={12} className="text-red-600" />
                        <span>{selectedEmailLog.pdfFilename || 'Purchase Order PDF'}</span>
                      </span>
                    )}
                  </div>
                )}

                {selectedEmailLog.failureReason && (
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                    <strong>Delivery Error:</strong> {selectedEmailLog.failureReason}
                  </div>
                )}
              </div>

              {/* Email Content */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Email Content
                  </h3>
                  {selectedEmailLog.htmlContent && selectedEmailLog.textContent && (
                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setEmailViewMode('html')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          emailViewMode === 'html' ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        Formatted Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailViewMode('text')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          emailViewMode === 'text' ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        Plain Text
                      </button>
                    </div>
                  )}
                </div>

                {selectedEmailLog.htmlContent && emailViewMode === 'html' ? (
                  <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
                    <iframe
                      sandbox=""
                      title={`Sent Purchase Order Email ${selectedEmailLog.purchaseOrderNumber || ''}`}
                      srcDoc={sanitizeEmailHtml(selectedEmailLog.htmlContent)}
                      className="w-full min-h-[400px] sm:min-h-[520px] h-[58vh] bg-white block border-0"
                    />
                  </div>
                ) : selectedEmailLog.textContent ? (
                  <pre className="whitespace-pre-wrap font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-x-auto leading-relaxed">
                    {selectedEmailLog.textContent}
                  </pre>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs sm:text-sm text-amber-900 flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Full historical email body unavailable</p>
                      <p className="text-amber-800 mt-1">
                        This email was sent before full email content archiving was enabled. All recorded metadata (recipient, subject, timestamp, status, and attachments) is displayed above.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/70 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmailLog(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={() => updateStatus(pendingAction)}
        title={`${pendingAction === 'cancel' ? 'Cancel' : 'Place'} Purchase Order?`}
        message={`Are you sure you want to ${pendingAction} this purchase order?`}
        confirmText={pendingAction === 'cancel' ? 'Cancel PO' : 'Confirm'}
        isDestructive={pendingAction === 'cancel'}
      />
    </div>
  );
};

export default PurchaseOrderDetail;
