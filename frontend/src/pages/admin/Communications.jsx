import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare, FileText, Calendar, Bell, Search, ChevronLeft, ChevronRight,
  Eye, CheckCircle, Clock, X, Mail, Phone, Car, Wrench, AlertCircle,
  Filter, RefreshCw, ExternalLink, Check, MailOpen, Loader2, Send, User, Trash2, Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import InternalNotesSection from '../../components/admin/InternalNotesSection';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';

const API = import.meta.env.VITE_API_URL;

// --- UTILS & CONSTANTS ---
const TABS = [
  { key: 'quotes', label: 'Quotes', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'messages', label: 'Messages', icon: Mail, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { key: 'bookings', label: 'Service Requests', icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { key: 'notifications', label: 'Notifications', icon: Bell, color: 'text-orange-500', bg: 'bg-orange-500/10' },
];

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'In Review': 'bg-blue-100 text-blue-700 border-blue-200',
  Quoted: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Responded: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Closed: 'bg-gray-100 text-gray-600 border-gray-200',
  Unread: 'bg-red-100 text-red-700 border-red-200',
  Read: 'bg-gray-100 text-gray-600 border-gray-200',
  Replied: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border ${STATUS_COLORS[status] || 'bg-gray-50 border-gray-200 text-gray-600'}`}>
    {status}
  </span>
);

const CustomerTypeBadge = ({ type }) => {
  if (type === 'import_company') return <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">Import</span>;
  if (type === 'rental_company') return <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">Rental</span>;
  return null;
};

const AssigneeBadge = ({ assignee }) => {
  if (!assignee) return null;
  return (
    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded text-[9px] text-gray-600 font-medium whitespace-nowrap ml-2">
      <User size={10} className="text-gray-400" />
      {assignee.name || 'Assigned'}
    </div>
  );
};

const getCustomerDisplay = (item) => {
  if (item.customerId) {
    return {
      name: item.customerId.name || 'Unknown',
      email: item.customerId.email || 'N/A',
      phone: item.customerId.phone || 'N/A',
      type: item.customerId.customerType,
      isSnapshot: false
    };
  }
  return {
    name: item.customerInfo?.fullName || `${item.customerInfo?.firstName || ''} ${item.customerInfo?.lastName || ''}`.trim() || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown',
    email: item.customerInfo?.email || item.email || 'N/A',
    phone: item.customerInfo?.phone || item.phone || 'N/A',
    type: null,
    isSnapshot: true
  };
};

const getVehicleDisplay = (item) => {
  if (item.vehicleId) {
    return {
      make: item.vehicleId.brand || 'Unknown',
      model: item.vehicleId.model || 'Unknown',
      year: item.vehicleId.year || 'N/A',
      regNo: item.vehicleId.registrationNumber || 'N/A',
      kilometers: item.vehicleId.mileage || 'N/A',
      isSnapshot: false
    };
  }
  return {
    make: item.vehicleInfo?.make || item.vehicleInfo?.brand || item.vehicleMake || 'Unknown',
    model: item.vehicleInfo?.model || item.vehicleModel || 'Unknown',
    year: item.vehicleInfo?.year || item.vehicleYear || 'N/A',
    regNo: item.vehicleInfo?.regNo || item.registrationNumber || 'N/A',
    kilometers: item.vehicleInfo?.kilometers || 'N/A',
    isSnapshot: true
  };
};

// Booking service ids are stored in `services[]` (e.g. 'Pink Slip', 'Import Compliance').
const getBookingServiceLabel = (b) => {
  if (Array.isArray(b?.services) && b.services.length > 0) return b.services.join(', ');
  return b?.serviceType || 'N/A';
};
const bookingIsImportCompliance = (b) => Array.isArray(b?.services) && b.services.includes('Import Compliance');
const getBookingAppointmentLabel = (b) => {
  if (b?.appointment?.date) return `${b.appointment.date}${b.appointment.time ? ` at ${b.appointment.time}` : ''}`;
  return b?.requestedDate ? new Date(b.requestedDate).toLocaleDateString() : 'N/A';
};

// --- CUSTOM HOOKS ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- SHARED COMPONENTS ---
const ListSkeleton = () => (
  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="animate-pulse bg-white border border-gray-100 rounded-xl p-4 flex gap-3">
        <div className="flex-1">
          <div className="w-1/2 h-4 bg-gray-200 rounded mb-2"></div>
          <div className="w-3/4 h-3 bg-gray-100 rounded"></div>
        </div>
      </div>
    ))}
  </div>
);

const DetailSkeleton = () => (
  <div className="flex-1 flex flex-col p-6 animate-pulse bg-white">
    <div className="w-1/3 h-6 bg-gray-200 rounded mb-4"></div>
    <div className="w-full h-32 bg-gray-50 rounded-xl mb-6"></div>
    <div className="w-1/4 h-5 bg-gray-200 rounded mb-2"></div>
    <div className="w-full h-40 bg-gray-50 rounded-xl"></div>
  </div>
);

const EmptyState = ({ icon: Icon, title, desc }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-gray-400 bg-gray-50/50">
    <Icon size={48} className="mb-4 text-gray-200" />
    <p className="text-gray-500 font-bold mb-1">{title}</p>
    {desc && <p className="text-xs">{desc}</p>}
  </div>
);

const SearchFilterBar = ({ 
  search, setSearch, 
  statusFilter, setStatusFilter, statusOptions, 
  datePreset, setDatePreset, 
  customFromDate, setCustomFromDate, 
  customToDate, setCustomToDate,
  onSelectAll, isAllSelected, totalCount, hasSelection,
  onBulkDelete, selectAllMatching, setSelectAllMatching
}) => (
  <div className="p-4 border-b border-gray-100 bg-white flex flex-col gap-3 flex-shrink-0 relative z-10 shadow-sm">
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input type="text" placeholder="Search by name, email..." value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-red-300 focus:bg-white outline-none transition-colors" />
    </div>
    <div className="flex gap-2">
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-red-300">
        <option value="">All Statuses</option>
        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}
        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-red-300">
        <option value="all">All Dates</option>
        <option value="last_30_days">Last 30 Days</option>
        <option value="last_6_months">Last 6 Months</option>
        <option value="custom">Custom Range</option>
      </select>
    </div>
    {datePreset === 'custom' && (
      <div className="flex gap-2">
        <input type="date" value={customFromDate} onChange={(e) => setCustomFromDate(e.target.value)} className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none" />
        <input type="date" value={customToDate} onChange={(e) => setCustomToDate(e.target.value)} className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none" />
      </div>
    )}
    
    <div className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={isAllSelected} onChange={onSelectAll} className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500" />
        <span className="text-[11px] font-bold text-gray-600">Select All Page</span>
      </div>
      {isAllSelected && totalCount > 0 && !selectAllMatching && (
         <button onClick={() => setSelectAllMatching(true)} className="text-[10px] text-red-600 hover:underline">Select all {totalCount}</button>
      )}
      {hasSelection && (
        <button onClick={onBulkDelete} className="text-[10px] font-bold text-red-600 bg-red-100 hover:bg-red-200 px-2 py-1 rounded flex items-center gap-1 transition-colors" aria-label="Delete">
<Trash2 size={12}/> Trash
        </button>
      )}
    </div>
  </div>
);

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between p-3 border-t border-gray-100 bg-white flex-shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
      <p className="text-[10px] text-gray-500 font-medium">
        {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
      </p>
      <div className="flex gap-1">
        <button onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}
          className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">
          <ChevronLeft size={14} />
        </button>
        <button onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
          className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};


// --- CONVERSATION HISTORY & REPLY FEEDBACK COMPONENTS ---
const DELIVERY_STATUS_CONFIG = {
  accepted: {
    label: 'Accepted by Brevo',
    className: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  opened: {
    label: 'Opened',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  deferred: {
    label: 'Deferred',
    className: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  bounced: {
    label: 'Bounced',
    className: 'bg-red-50 text-red-700 border-red-200'
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-red-50 text-red-700 border-red-200'
  },
  invalid: {
    label: 'Invalid Email',
    className: 'bg-red-50 text-red-700 border-red-200'
  },
  error: {
    label: 'Delivery Error',
    className: 'bg-red-50 text-red-700 border-red-200'
  }
};

const DeliveryStatusBadge = ({ status }) => {
  const normalized = (status || 'accepted').toLowerCase();
  const cfg = DELIVERY_STATUS_CONFIG[normalized] || DELIVERY_STATUS_CONFIG.accepted;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${cfg.className}`}>
      <CheckCircle size={10} />
      {cfg.label}
    </span>
  );
};

const generateIdempotencyKey = (prefix, id) =>
  `${prefix}-${id || 'unknown'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return 'N/A';
  return dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const ReplyFeedbackBanner = ({ feedback, onDismiss }) => {
  if (!feedback || !feedback.message) return null;
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-800'
  };
  return (
    <div
      role="status"
      data-testid="reply-feedback-banner"
      className={`mb-3 px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-start justify-between gap-3 ${styles[feedback.type] || styles.error}`}
    >
      <div className="flex items-start gap-2">
        {feedback.type === 'success' ? (
          <CheckCircle size={15} className="mt-0.5 flex-shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
        )}
        <span>{feedback.message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-current opacity-60 hover:opacity-100 p-0.5"
          aria-label="Dismiss message"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

const ConversationHistorySection = ({
  communicationType,
  record,
  customerDisplay,
  originalSubject,
  originalBody
}) => {
  if (!record) return null;

  const rawReplies = Array.isArray(record.replies) ? record.replies : [];
  const sortedReplies = [...rawReplies].sort((a, b) => {
    const timeA = new Date(a.sentAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.sentAt || b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  return (
    <div
      className="mb-8 bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm"
      data-testid="conversation-history-section"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 mb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} className="text-red-600" />
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Message History / Conversation Log
          </h4>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600">
          {sortedReplies.length} {sortedReplies.length === 1 ? 'Reply' : 'Replies'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Original Customer Message / Quote Request */}
        <div
          className="flex flex-col items-start"
          data-testid="conversation-original-entry"
        >
          <div className="w-full md:max-w-[90%] bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 mb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-800">
                  Customer {communicationType === 'Quote' ? 'Quote Request' : 'Message'}
                </span>
                <span className="text-xs font-bold text-gray-800">
                  {customerDisplay.name}
                </span>
                <span className="text-[11px] text-gray-500">
                  ({customerDisplay.email})
                </span>
              </div>
              <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                <Clock size={11} />
                {formatDateTime(record.createdAt)}
              </span>
            </div>

            <div className="text-[11px] text-gray-500 mb-2 flex flex-wrap gap-x-4 gap-y-1">
              <span><strong>From:</strong> {customerDisplay.name} &lt;{customerDisplay.email}&gt;</span>
              <span><strong>To:</strong> GSK Automotive</span>
              {originalSubject && <span><strong>Subject:</strong> {originalSubject}</span>}
            </div>

            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {originalBody || 'No additional description provided.'}
            </p>
          </div>
        </div>

        {/* Chronological Admin Replies */}
        {sortedReplies.length === 0 ? (
          <div
            className="border border-dashed border-gray-200 rounded-xl p-5 text-center bg-gray-50/60"
            data-testid="conversation-empty-replies"
          >
            <Mail size={22} className="mx-auto mb-1.5 text-gray-300" />
            <p className="text-xs font-bold text-gray-600">No replies sent yet</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              When an administrator replies via Brevo, the full reply and delivery status will appear here in chronological order.
            </p>
          </div>
        ) : (
          sortedReplies.map((reply, idx) => {
            const senderName = reply.senderName || reply.authorName || 'GSK Automotive';
            const senderEmail = reply.senderEmail || 'admin@gskautomotive.com.au';
            const recipientEmail = reply.recipientEmail || customerDisplay.email;
            const replySubject = reply.subject || (originalSubject ? `Re: ${originalSubject}` : `Re: ${communicationType}`);
            const replyBody = reply.body || reply.message || '';
            const sentTimestamp = reply.sentAt || reply.createdAt;

            return (
              <div
                key={reply._id || `${sentTimestamp}-${idx}`}
                className="flex flex-col items-end"
                data-testid="conversation-reply-entry"
              >
                <div className="w-full md:max-w-[90%] bg-red-50/60 border border-red-200/80 rounded-2xl rounded-tr-sm p-4 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 mb-2 border-b border-red-200/60">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white">
                        GSK Automotive Reply
                      </span>
                      <span className="text-xs font-bold text-gray-900">
                        {senderName}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        ({senderEmail})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DeliveryStatusBadge status={reply.deliveryStatus} />
                      <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                        <Clock size={11} />
                        {formatDateTime(sentTimestamp)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-600 mb-2 flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong>From:</strong> {senderName} &lt;{senderEmail}&gt;</span>
                    <span><strong>To:</strong> {recipientEmail}</span>
                    <span><strong>Subject:</strong> {replySubject}</span>
                  </div>

                  <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {replyBody}
                  </p>

                  {reply.brevoMessageId && (
                    <div className="mt-2 pt-2 border-t border-red-100 flex items-center justify-between text-[10px] text-gray-400">
                      <span>Brevo Message ID: <code className="font-mono text-gray-500">{reply.brevoMessageId}</code></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// --- QUOTES TAB ---
const QuotesTab = ({ token, initialId, onClearInitialId }) => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyFeedback, setReplyFeedback] = useState(null);
  const [replyDraftKey, setReplyDraftKey] = useState(() => generateIdempotencyKey('quote', 'init'));
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const abortControllerRef = useRef(null);
  const replyInFlightRef = useRef(false);

  useEffect(() => { setPage(1); setSelectedIds([]); setSelectAllMatching(false); }, [debouncedSearch, statusFilter, datePreset, customFromDate, customToDate]);

  const fetchQuotes = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (datePreset !== 'all') params.set('datePreset', datePreset);
      if (datePreset === 'custom') {
        if (customFromDate) params.set('fromDate', customFromDate);
        if (customToDate) params.set('toDate', customToDate);
      }
      
      const res = await fetch(`${API}/communications/quotes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) { 
        setQuotes(data.data); 
        setPagination(data.pagination);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally { 
      setLoading(false); 
    }
  }, [token, page, debouncedSearch, statusFilter, datePreset, customFromDate, customToDate]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  useEffect(() => {
    if (initialId) {
      openDetail(initialId);
      onClearInitialId?.();
    }
  }, [initialId]);

  const openDetail = async (id) => {
    setReplyFeedback(null);
    setReplyDraftKey(generateIdempotencyKey('quote', id));
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/communications/quotes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setSelectedQuote(data.data);
        setQuotes(prev => prev.map(q => q._id === id ? data.data : q));
      }
    } catch (err) { console.error(err); }
    finally { setDetailLoading(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API}/communications/quotes/${id}/status`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setQuotes(prev => prev.map(q => q._id === id ? { ...q, status } : q));
      if (selectedQuote?._id === id) setSelectedQuote(prev => ({ ...prev, status }));
    } catch (err) { console.error(err); }
  };

  const handleReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed) {
      setReplyFeedback({ type: 'error', message: 'Reply message cannot be empty.' });
      return;
    }
    if (!selectedQuote || replyLoading || replyInFlightRef.current) return;

    replyInFlightRef.current = true;
    setReplyLoading(true);
    setReplyFeedback(null);

    try {
      const res = await fetch(`${API}/communications/quotes/${selectedQuote._id}/reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          idempotencyKey: replyDraftKey
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReplyText('');
        setReplyDraftKey(generateIdempotencyKey('quote', selectedQuote._id));
        setSelectedQuote(data.data);
        setQuotes(prev => prev.map(q => q._id === selectedQuote._id ? data.data : q));
        setReplyFeedback({
          type: 'success',
          message: 'Reply accepted by Brevo and saved to conversation history.'
        });
      } else if (data.partialFailure) {
        setReplyDraftKey(generateIdempotencyKey('quote', selectedQuote._id));
        setReplyFeedback({
          type: 'warning',
          message: data.error || 'Email was accepted by Brevo, but saving the conversation log to the database failed.'
        });
      } else {
        setReplyFeedback({
          type: 'error',
          message: data.error || 'Failed to send reply via Brevo. No reply was logged.'
        });
      }
    } catch (err) {
      console.error(err);
      setReplyFeedback({
        type: 'error',
        message: 'Network or server error while sending reply.'
      });
    } finally {
      replyInFlightRef.current = false;
      setReplyLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Move this quote to trash?")) return;
    try {
      const res = await fetch(`${API}/communications/quotes/${selectedQuote._id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedQuote(null);
        fetchQuotes();
      }
    } catch (err) { console.error(err); }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Move ${selectAllMatching ? pagination?.total : selectedIds.length} quotes to trash?`)) return;
    try {
      const payload = {
        type: 'Quote', selectAllMatching, ids: selectedIds,
        filters: selectAllMatching ? { search: debouncedSearch, status: statusFilter, datePreset, fromDate: customFromDate, toDate: customToDate } : {}
      };
      const res = await fetch(`${API}/communications/bulk-delete`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds([]); setSelectAllMatching(false); setPage(1); fetchQuotes();
      }
    } catch (err) { console.error(err); }
  };

  const handleSelect = (e, id) => {
    e.stopPropagation();
    if (selectAllMatching) {
      setSelectAllMatching(false);
      setSelectedIds(quotes.filter(q => q._id !== id).map(q => q._id));
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(quotes.map(q => q._id));
    else { setSelectedIds([]); setSelectAllMatching(false); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)] min-h-[600px]">
      {/* LEFT PANEL */}
      <div className={`w-full lg:w-[35%] xl:w-[30%] flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex-shrink-0 ${selectedQuote || detailLoading ? 'hidden lg:flex' : 'flex'}`}>
        <SearchFilterBar 
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          statusOptions={['Pending', 'In Review', 'Quoted', 'Responded', 'Closed']}
          datePreset={datePreset} setDatePreset={setDatePreset}
          customFromDate={customFromDate} setCustomFromDate={setCustomFromDate}
          customToDate={customToDate} setCustomToDate={setCustomToDate}
          onSelectAll={handleSelectAll} isAllSelected={selectedIds.length === quotes.length && quotes.length > 0}
          totalCount={pagination?.total} hasSelection={selectedIds.length > 0 || selectAllMatching}
          onBulkDelete={handleBulkDelete} selectAllMatching={selectAllMatching} setSelectAllMatching={setSelectAllMatching}
        />
        
        {loading ? <ListSkeleton /> : quotes.length === 0 ? (
          <EmptyState icon={FileText} title="No Quotes Found" desc="Try adjusting your filters or search." />
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-gray-50/30">
            {quotes.map(q => {
              const isUnread = q.status === 'Pending';
              const isSelected = selectedQuote?._id === q._id;
              const isChecked = selectAllMatching || selectedIds.includes(q._id);
              return (
                <div key={q._id} onClick={() => openDetail(q._id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border group flex gap-3 ${isSelected ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                  <div className="pt-1" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isChecked} onChange={(e) => handleSelect(e, q._id)} className="w-3.5 h-3.5 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className={`text-sm truncate pr-2 ${isUnread ? 'font-black text-dark' : 'font-bold text-gray-700'}`}>
                        {getCustomerDisplay(q).name}
                      </p>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className={`text-[10px] whitespace-nowrap font-medium ${isUnread ? 'text-red-500' : 'text-gray-400'}`}>
                          {new Date(q.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shadow-sm"></span>}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate mb-2">{getVehicleDisplay(q).make} {getVehicleDisplay(q).model}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={q.status} />
                      <AssigneeBadge assignee={q.assignedTo} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* RIGHT PANEL */}
      <div className={`w-full lg:w-[65%] xl:w-[70%] flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm ${selectedQuote || detailLoading ? 'flex' : 'hidden lg:flex'}`}>
        {detailLoading ? <DetailSkeleton /> : !selectedQuote ? (
          <EmptyState icon={FileText} title="Select a Quote" desc="Choose a quote from the list to view its details." />
        ) : (
          <div className="flex flex-col h-full relative">
            <div className="p-4 md:p-5 border-b border-gray-100 bg-white flex-shrink-0 z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedQuote(null)} className="lg:hidden p-2 bg-gray-50 rounded-lg text-gray-600 hover:text-dark">
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h2 className="font-heading text-lg md:text-xl leading-tight flex items-center flex-wrap gap-2">
                    {getCustomerDisplay(selectedQuote).name}
                    <CustomerTypeBadge type={getCustomerDisplay(selectedQuote).type} />
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">{getCustomerDisplay(selectedQuote).email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedQuote.status} />
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Move to Trash" aria-label="Delete">
<Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-gray-50/50">
              <div className="flex gap-2 flex-wrap mb-6">
                {['Pending', 'In Review', 'Quoted', 'Responded', 'Closed'].map(s => (
                  <button key={s} onClick={() => updateStatus(selectedQuote._id, s)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm border ${selectedQuote.status === s ? 'bg-white border-red-200 text-red-600 ring-1 ring-red-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User size={12}/> Customer Info
                  </h4>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Name</span> <span className="font-medium text-right">{getCustomerDisplay(selectedQuote).name}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Email</span> <span className="font-medium truncate ml-4">{getCustomerDisplay(selectedQuote).email}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Phone</span> <span className="font-medium">{getCustomerDisplay(selectedQuote).phone}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Contact Method</span> <span className="font-medium">{selectedQuote.customerInfo?.contactMethod || 'N/A'}</span></div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Car size={12}/> Vehicle Info
                  </h4>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Make</span> <span className="font-medium">{getVehicleDisplay(selectedQuote).make}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Model</span> <span className="font-medium">{getVehicleDisplay(selectedQuote).model}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Year</span> <span className="font-medium">{getVehicleDisplay(selectedQuote).year}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Rego</span> <span className="font-medium uppercase">{getVehicleDisplay(selectedQuote).regNo}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">KMs</span> <span className="font-medium">{getVehicleDisplay(selectedQuote).kilometers}</span></div>
                  </div>
                </div>
              </div>

              {selectedQuote.services?.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Requested Services</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedQuote.services.map((s, i) => (
                      <span key={i} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedQuote.description && (
                <div className="mb-8">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Customer Description</h4>
                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-sm text-blue-900 leading-relaxed whitespace-pre-wrap shadow-sm">
                    {selectedQuote.description}
                  </div>
                </div>
              )}
              
              {selectedQuote.images?.length > 0 && (
                <div className="mb-8">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Attachments</h4>
                  <div className="flex gap-3 flex-wrap">
                    {selectedQuote.images.map((img, i) => (
                      <a key={i} href={img.url} target="_blank" rel="noopener noreferrer"
                        className="w-24 h-24 rounded-xl overflow-hidden border border-gray-200 hover:border-red-300 transition-colors shadow-sm">
                        <img src={img.url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <ConversationHistorySection
                communicationType="Quote"
                record={selectedQuote}
                customerDisplay={getCustomerDisplay(selectedQuote)}
                originalSubject={`Quote Request (${getVehicleDisplay(selectedQuote).make} ${getVehicleDisplay(selectedQuote).model})`}
                originalBody={
                  selectedQuote.description ||
                  (selectedQuote.services?.length
                    ? `Requested Services: ${selectedQuote.services.join(', ')}`
                    : 'Quote request submitted.')
                }
              />

              <InternalNotesSection 
                recordId={selectedQuote._id} type="quotes"
                initialNotes={selectedQuote.internalNotes}
                initialAssigneeId={selectedQuote.assignedTo?._id || selectedQuote.assignedTo}
                token={token} onSave={(updated) => setSelectedQuote(updated)}
              />
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
              <ReplyFeedbackBanner
                feedback={replyFeedback}
                onDismiss={() => setReplyFeedback(null)}
              />
              <textarea 
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  setReplyDraftKey(generateIdempotencyKey('quote', selectedQuote._id));
                }}
                disabled={replyLoading}
                placeholder="Type reply... (Sends email to customer)"
                className="w-full h-24 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-red-300 focus:bg-white resize-none mb-3 transition-colors disabled:opacity-60"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-medium hidden sm:inline-block"><Lock size={12} className="inline mr-1 mb-0.5"/>Replies are permanent and visible to customer</span>
                <button onClick={handleReply} disabled={replyLoading || !replyText.trim()}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 active:scale-95 w-full sm:w-auto">
                  {replyLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {replyLoading ? 'Sending Reply...' : 'Send Reply'}
                </button>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
};


// --- MESSAGES TAB ---
const MessagesTab = ({ token, initialId, onClearInitialId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyFeedback, setReplyFeedback] = useState(null);
  const [replyDraftKey, setReplyDraftKey] = useState(() => generateIdempotencyKey('message', 'init'));
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const abortControllerRef = useRef(null);
  const replyInFlightRef = useRef(false);

  useEffect(() => { setPage(1); setSelectedIds([]); setSelectAllMatching(false); }, [debouncedSearch, statusFilter, datePreset, customFromDate, customToDate]);

  const fetchMessages = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (datePreset !== 'all') params.set('datePreset', datePreset);
      if (datePreset === 'custom') {
        if (customFromDate) params.set('fromDate', customFromDate);
        if (customToDate) params.set('toDate', customToDate);
      }
      
      const res = await fetch(`${API}/communications/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) { 
        setMessages(data.data); 
        setPagination(data.pagination);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally { setLoading(false); }
  }, [token, page, debouncedSearch, statusFilter, datePreset, customFromDate, customToDate]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (initialId) {
      openDetail({ _id: initialId });
      onClearInitialId?.();
    }
  }, [initialId]);

  const openDetail = async (msg) => {
    setReplyFeedback(null);
    setReplyDraftKey(generateIdempotencyKey('message', msg._id));
    setSelectedMessage(msg);
    setDetailLoading(true);

    try {
      const detailRes = await fetch(`${API}/communications/messages/${msg._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const detailData = await detailRes.json();
      let latestRecord = detailData.success ? detailData.data : msg;

      if (latestRecord.status === 'Unread') {
        const statusRes = await fetch(`${API}/communications/messages/${msg._id}/status`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Read' })
        });
        const statusData = await statusRes.json();
        if (statusData.success && statusData.data) {
          latestRecord = statusData.data;
        } else {
          latestRecord = { ...latestRecord, status: 'Read' };
        }
      }

      setSelectedMessage(latestRecord);
      setMessages(prev => prev.map(m => m._id === msg._id ? latestRecord : m));
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API}/communications/messages/${id}/status`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setMessages(prev => prev.map(m => m._id === id ? { ...m, status } : m));
      if (selectedMessage?._id === id) setSelectedMessage(prev => ({ ...prev, status }));
    } catch (err) { console.error(err); }
  };

  const handleReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed) {
      setReplyFeedback({ type: 'error', message: 'Reply message cannot be empty.' });
      return;
    }
    if (!selectedMessage || replyLoading || replyInFlightRef.current) return;

    replyInFlightRef.current = true;
    setReplyLoading(true);
    setReplyFeedback(null);

    try {
      const res = await fetch(`${API}/communications/messages/${selectedMessage._id}/reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          idempotencyKey: replyDraftKey
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReplyText('');
        setReplyDraftKey(generateIdempotencyKey('message', selectedMessage._id));
        setSelectedMessage(data.data);
        setMessages(prev => prev.map(m => m._id === selectedMessage._id ? data.data : m));
        setReplyFeedback({
          type: 'success',
          message: 'Reply accepted by Brevo and saved to conversation history.'
        });
      } else if (data.partialFailure) {
        setReplyDraftKey(generateIdempotencyKey('message', selectedMessage._id));
        setReplyFeedback({
          type: 'warning',
          message: data.error || 'Email was accepted by Brevo, but saving the conversation log to the database failed.'
        });
      } else {
        setReplyFeedback({
          type: 'error',
          message: data.error || 'Failed to send reply via Brevo. No reply was logged.'
        });
      }
    } catch (err) {
      console.error(err);
      setReplyFeedback({
        type: 'error',
        message: 'Network or server error while sending reply.'
      });
    } finally {
      replyInFlightRef.current = false;
      setReplyLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Move this message to trash?")) return;
    try {
      const res = await fetch(`${API}/communications/messages/${selectedMessage._id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedMessage(null);
        fetchMessages();
      }
    } catch (err) { console.error(err); }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Move ${selectAllMatching ? pagination?.total : selectedIds.length} messages to trash?`)) return;
    try {
      const payload = {
        type: 'Message', selectAllMatching, ids: selectedIds,
        filters: selectAllMatching ? { search: debouncedSearch, status: statusFilter, datePreset, fromDate: customFromDate, toDate: customToDate } : {}
      };
      const res = await fetch(`${API}/communications/bulk-delete`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds([]); setSelectAllMatching(false); setPage(1); fetchMessages();
      }
    } catch (err) { console.error(err); }
  };

  const handleSelect = (e, id) => {
    e.stopPropagation();
    if (selectAllMatching) {
      setSelectAllMatching(false);
      setSelectedIds(messages.filter(m => m._id !== id).map(m => m._id));
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(messages.map(m => m._id));
    else { setSelectedIds([]); setSelectAllMatching(false); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)] min-h-[600px]">
      {/* LEFT PANEL */}
      <div className={`w-full lg:w-[35%] xl:w-[30%] flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex-shrink-0 ${selectedMessage || detailLoading ? 'hidden lg:flex' : 'flex'}`}>
        <SearchFilterBar 
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          statusOptions={['Unread', 'Read', 'Replied']}
          datePreset={datePreset} setDatePreset={setDatePreset}
          customFromDate={customFromDate} setCustomFromDate={setCustomFromDate}
          customToDate={customToDate} setCustomToDate={setCustomToDate}
          onSelectAll={handleSelectAll} isAllSelected={selectedIds.length === messages.length && messages.length > 0}
          totalCount={pagination?.total} hasSelection={selectedIds.length > 0 || selectAllMatching}
          onBulkDelete={handleBulkDelete} selectAllMatching={selectAllMatching} setSelectAllMatching={setSelectAllMatching}
        />
        
        {loading ? <ListSkeleton /> : messages.length === 0 ? (
          <EmptyState icon={Mail} title="No Messages Found" desc="Try adjusting your filters or search." />
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-gray-50/30">
            {messages.map(m => {
              const isUnread = m.status === 'Unread';
              const isSelected = selectedMessage?._id === m._id;
              const isChecked = selectAllMatching || selectedIds.includes(m._id);
              return (
                <div key={m._id} onClick={() => openDetail(m)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border group flex gap-3 ${isSelected ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                  <div className="pt-1" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isChecked} onChange={(e) => handleSelect(e, m._id)} className="w-3.5 h-3.5 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className={`text-sm truncate pr-2 ${isUnread ? 'font-black text-dark' : 'font-bold text-gray-700'}`}>
                        {getCustomerDisplay(m).name}
                      </p>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className={`text-[10px] whitespace-nowrap font-medium ${isUnread ? 'text-red-500' : 'text-gray-400'}`}>
                          {new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shadow-sm"></span>}
                      </div>
                    </div>
                    <p className={`text-xs truncate mb-2 ${isUnread ? 'font-bold text-gray-800' : 'text-gray-500'}`}>{m.subject}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={m.status} />
                      <AssigneeBadge assignee={m.assignedTo} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* RIGHT PANEL */}
      <div className={`w-full lg:w-[65%] xl:w-[70%] flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm ${selectedMessage || detailLoading ? 'flex' : 'hidden lg:flex'}`}>
        {detailLoading && !selectedMessage ? <DetailSkeleton /> : !selectedMessage ? (
          <EmptyState icon={Mail} title="Select a Message" desc="Choose a message from the list to view the conversation." />
        ) : (
          <div className="flex flex-col h-full relative">
            <div className="p-4 md:p-5 border-b border-gray-100 bg-white flex-shrink-0 z-10 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setSelectedMessage(null)} className="lg:hidden p-2 bg-gray-50 rounded-lg text-gray-600 hover:text-dark">
                  <ChevronLeft size={20} />
                </button>
                <div className="min-w-0">
                  <h2 className="font-heading text-lg md:text-xl leading-tight truncate">{selectedMessage.subject}</h2>
                  <p className="text-xs text-gray-500 font-medium mt-1 truncate">
                    {getCustomerDisplay(selectedMessage).name} &bull; {getCustomerDisplay(selectedMessage).email} &bull; {getCustomerDisplay(selectedMessage).phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-4 flex-shrink-0">
                <StatusBadge status={selectedMessage.status} />
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Move to Trash" aria-label="Delete">
<Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-gray-50/50 flex flex-col">
              {/* Message Details Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <User size={12} /> Message Details
                  </h4>
                  <div className="flex gap-1.5 flex-wrap">
                    {['Unread', 'Read', 'Replied'].map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedMessage._id, s)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${selectedMessage.status === s ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs border-b border-gray-100 pb-3 mb-3">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Customer</span>
                    <span className="font-medium text-gray-800">{getCustomerDisplay(selectedMessage).name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Email</span>
                    <span className="font-medium text-gray-800 break-all">{getCustomerDisplay(selectedMessage).email}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Phone</span>
                    <span className="font-medium text-gray-800">{getCustomerDisplay(selectedMessage).phone}</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold mb-1">Original Inquiry</span>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>

              {/* Conversation History / Message Log Section */}
              <ConversationHistorySection
                communicationType="Message"
                record={selectedMessage}
                customerDisplay={getCustomerDisplay(selectedMessage)}
                originalSubject={selectedMessage.subject}
                originalBody={selectedMessage.message}
              />

              <div className="mt-auto pt-2">
                <InternalNotesSection 
                  recordId={selectedMessage._id} type="messages"
                  initialNotes={selectedMessage.internalNotes}
                  initialAssigneeId={selectedMessage.assignedTo?._id || selectedMessage.assignedTo}
                  token={token} onSave={(updated) => setSelectedMessage(updated)}
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
              <ReplyFeedbackBanner
                feedback={replyFeedback}
                onDismiss={() => setReplyFeedback(null)}
              />
              <textarea 
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  setReplyDraftKey(generateIdempotencyKey('message', selectedMessage._id));
                }}
                disabled={replyLoading}
                placeholder="Type reply... (Sends email to customer)"
                className="w-full h-20 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-red-300 focus:bg-white resize-none mb-3 transition-colors disabled:opacity-60"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-medium hidden sm:inline-block"><Lock size={12} className="inline mr-1 mb-0.5"/>Replies are permanent and visible to customer</span>
                <button onClick={handleReply} disabled={replyLoading || !replyText.trim()}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 active:scale-95 w-full sm:w-auto">
                  {replyLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {replyLoading ? 'Sending Reply...' : 'Send Reply'}
                </button>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
};


// --- BOOKINGS TAB ---
const ProcessBookingSection = ({ booking, token, onProcessed, onCancel }) => {
  const [customerId, setCustomerId] = useState(null);
  const [vehicleId, setVehicleId] = useState(null);
  const [createCustomer, setCreateCustomer] = useState(false);
  const [createVehicle, setCreateVehicle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!createCustomer && !customerId && !booking.customerId) {
      return setError('Please select or create a customer.');
    }
    if (!createVehicle && !vehicleId && !booking.vehicleId) {
      return setError('Please select or create a vehicle.');
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/communications/bookings/${booking._id}/add-customer-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customerId, vehicleId, createCustomer, createVehicle })
      });
      const data = await res.json();
      if (data.success) {
        onProcessed(data.data);
      } else {
        setError(data.error || 'Failed to process request.');
      }
    } catch (err) {
      setError('Network error processing request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-blue-500" /> Process Request (Add Details)
        </h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>
      
      {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-4 border border-red-100">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!booking.customerId && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">Link Customer</label>
            {!createCustomer ? (
              <EntityAutocomplete
                type="customer"
                onSelect={(c) => setCustomerId(c ? c._id : null)}
                placeholder="Search for canonical customer..."
              />
            ) : (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                A new Customer will be created from the request details.
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={createCustomer} onChange={e => setCreateCustomer(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Create new Customer if no match exists
            </label>
          </div>
        )}

        {!booking.vehicleId && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-700">Link Vehicle</label>
            {!createVehicle ? (
              <EntityAutocomplete
                type="vehicle"
                filterByCustomer={customerId || booking.customerId || undefined}
                onSelect={(v) => setVehicleId(v ? v._id : null)}
                placeholder="Search for canonical vehicle..."
              />
            ) : (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                A new Vehicle will be created from the request details.
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={createVehicle} onChange={e => setCreateVehicle(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Create new Vehicle if no match exists
            </label>
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button type="submit" disabled={loading} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Process & Link
          </button>
        </div>
      </form>
    </div>
  );
};

const BookingsTab = ({ token, summary, initialId, onClearInitialId }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showProcessBooking, setShowProcessBooking] = useState(false);
  
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const abortControllerRef = useRef(null);

  useEffect(() => { setPage(1); setSelectedIds([]); setSelectAllMatching(false); }, [debouncedSearch, statusFilter, datePreset, customFromDate, customToDate]);

  const fetchBookings = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (datePreset !== 'all') params.set('datePreset', datePreset);
      if (datePreset === 'custom') {
        if (customFromDate) params.set('fromDate', customFromDate);
        if (customToDate) params.set('toDate', customToDate);
      }
      
      const res = await fetch(`${API}/communications/bookings?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) { 
        setBookings(data.data); 
        setPagination(data.pagination);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally { setLoading(false); }
  }, [token, page, debouncedSearch, statusFilter, datePreset, customFromDate, customToDate]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  useEffect(() => {
    if (initialId) {
      openDetail(initialId);
      onClearInitialId?.();
    }
  }, [initialId]);

  const openDetail = async (id) => {
    if (selectedBooking?._id === id) return;
    setSelectedBooking(null);
    setShowProcessBooking(false);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/communications/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setSelectedBooking(data.data);
    } catch (err) { console.error(err); }
    finally { setDetailLoading(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API}/communications/bookings/${id}/status`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setBookings(prev => prev.map(b => b._id === id ? { ...b, status } : b));
      if (selectedBooking?._id === id) setSelectedBooking(prev => ({ ...prev, status }));
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Move this request to trash?")) return;
    try {
      const res = await fetch(`${API}/communications/bookings/${selectedBooking._id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedBooking(null);
        fetchBookings();
      }
    } catch (err) { console.error(err); }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Move ${selectAllMatching ? pagination?.total : selectedIds.length} requests to trash?`)) return;
    try {
      const payload = {
        type: 'Booking', selectAllMatching, ids: selectedIds,
        filters: selectAllMatching ? { search: debouncedSearch, status: statusFilter, datePreset, fromDate: customFromDate, toDate: customToDate } : {}
      };
      const res = await fetch(`${API}/communications/bulk-delete`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIds([]); setSelectAllMatching(false); setPage(1); fetchBookings();
      }
    } catch (err) { console.error(err); }
  };

  const handleSelect = (e, id) => {
    e.stopPropagation();
    if (selectAllMatching) {
      setSelectAllMatching(false);
      setSelectedIds(bookings.filter(b => b._id !== id).map(b => b._id));
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(bookings.map(b => b._id));
    else { setSelectedIds([]); setSelectAllMatching(false); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-280px)] min-h-[600px]">
      {/* LEFT PANEL */}
      <div className={`w-full lg:w-[35%] xl:w-[30%] flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm flex-shrink-0 ${selectedBooking || detailLoading ? 'hidden lg:flex' : 'flex'}`}>
        <SearchFilterBar 
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          statusOptions={['Pending', 'Confirmed', 'Completed', 'Cancelled']}
          datePreset={datePreset} setDatePreset={setDatePreset}
          customFromDate={customFromDate} setCustomFromDate={setCustomFromDate}
          customToDate={customToDate} setCustomToDate={setCustomToDate}
          onSelectAll={handleSelectAll} isAllSelected={selectedIds.length === bookings.length && bookings.length > 0}
          totalCount={pagination?.total} hasSelection={selectedIds.length > 0 || selectAllMatching}
          onBulkDelete={handleBulkDelete} selectAllMatching={selectAllMatching} setSelectAllMatching={setSelectAllMatching}
        />
        
        {loading ? <ListSkeleton /> : bookings.length === 0 ? (
          <EmptyState icon={Calendar} title="No Service Requests" desc="Try adjusting your filters or search." />
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-gray-50/30">
            {bookings.map(b => {
              const isUnread = b.status === 'Pending';
              const isSelected = selectedBooking?._id === b._id;
              const isChecked = selectAllMatching || selectedIds.includes(b._id);
              return (
                <div key={b._id} onClick={() => openDetail(b._id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border group flex gap-3 ${isSelected ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                  <div className="pt-1" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isChecked} onChange={(e) => handleSelect(e, b._id)} className="w-3.5 h-3.5 text-red-600 rounded border-gray-300 focus:ring-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className={`text-sm truncate pr-2 ${isUnread ? 'font-black text-dark' : 'font-bold text-gray-700'}`}>
                        {getCustomerDisplay(b).name}
                      </p>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className={`text-[10px] whitespace-nowrap font-medium ${isUnread ? 'text-red-500' : 'text-gray-400'}`}>
                          {new Date(b.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shadow-sm"></span>}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate mb-1 flex items-center gap-1.5">
                      {bookingIsImportCompliance(b) && <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 text-[9px] font-bold uppercase tracking-wide">Import</span>}
                      <span className="truncate">{getBookingServiceLabel(b)}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mb-2 truncate">Appointment: {getBookingAppointmentLabel(b)}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={b.status} />
                      <AssigneeBadge assignee={b.assignedTo} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* RIGHT PANEL */}
      <div className={`w-full lg:w-[65%] xl:w-[70%] flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm ${selectedBooking || detailLoading ? 'flex' : 'hidden lg:flex'}`}>
        {detailLoading ? <DetailSkeleton /> : !selectedBooking ? (
          <EmptyState icon={Calendar} title="Select a Service Request" desc="Choose a request to view details." />
        ) : (
          <div className="flex flex-col h-full relative">
            <div className="p-4 md:p-5 border-b border-gray-100 bg-white flex-shrink-0 z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedBooking(null)} className="lg:hidden p-2 bg-gray-50 rounded-lg text-gray-600 hover:text-dark">
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h2 className="font-heading text-lg md:text-xl leading-tight flex items-center flex-wrap gap-2">
                    {getCustomerDisplay(selectedBooking).name}
                    <CustomerTypeBadge type={getCustomerDisplay(selectedBooking).type} />
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">{getCustomerDisplay(selectedBooking).email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedBooking.status} />
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Move to Trash" aria-label="Delete">
<Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-gray-50/50">
              <div className="flex gap-2 flex-wrap mb-6">
                {['Pending', 'Confirmed', 'Completed', 'Cancelled'].map(s => (
                  <button key={s} onClick={() => updateStatus(selectedBooking._id, s)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm border ${selectedBooking.status === s ? 'bg-white border-red-200 text-red-600 ring-1 ring-red-500/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User size={12}/> Customer Info
                  </h4>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Name</span> <span className="font-medium text-right">{getCustomerDisplay(selectedBooking).name}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Email</span> <span className="font-medium truncate ml-4">{getCustomerDisplay(selectedBooking).email}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Phone</span> <span className="font-medium">{getCustomerDisplay(selectedBooking).phone}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Service</span> <span className="font-medium text-red-600 text-right ml-4">{getBookingServiceLabel(selectedBooking)}</span></div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Car size={12}/> Vehicle Info
                  </h4>
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Make</span> <span className="font-medium">{getVehicleDisplay(selectedBooking).make}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Model</span> <span className="font-medium">{getVehicleDisplay(selectedBooking).model}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Year</span> <span className="font-medium">{getVehicleDisplay(selectedBooking).year}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Rego</span> <span className="font-medium uppercase">{getVehicleDisplay(selectedBooking).regNo}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Appointment</span> <span className="font-medium text-right ml-4">{getBookingAppointmentLabel(selectedBooking)}</span></div>
                  </div>
                </div>
              </div>

              {bookingIsImportCompliance(selectedBooking) && (
                <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm mb-6">
                  <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Car size={12}/> Imported Vehicle Information
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Make</span> <span className="font-medium text-right ml-4">{selectedBooking.vehicleInfo?.make || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Model</span> <span className="font-medium text-right ml-4">{selectedBooking.vehicleInfo?.model || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Manufacturing Year</span> <span className="font-medium text-right ml-4">{selectedBooking.vehicleInfo?.year || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">VIN / Chassis Number</span> <span className="font-medium text-right ml-4 break-all">{selectedBooking.importVehicleInfo?.vin || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Country of Origin</span> <span className="font-medium text-right ml-4">{selectedBooking.importVehicleInfo?.countryOfOrigin || 'N/A'}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-500">Import Approval Status</span> <span className="font-medium text-right ml-4">{selectedBooking.importVehicleInfo?.approvalStatus || 'N/A'}</span></div>
                  </div>
                  <div className="mt-3 text-[13px]">
                    <span className="text-gray-500">Additional Information</span>
                    <p className="font-medium whitespace-pre-wrap mt-1">{selectedBooking.importVehicleInfo?.additionalInfo || 'None provided'}</p>
                  </div>
                </div>
              )}

              {(selectedBooking.additionalInfo || selectedBooking.description) && (
                <div className="mb-8">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Additional Notes</h4>
                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-sm text-blue-900 leading-relaxed whitespace-pre-wrap shadow-sm">
                    {selectedBooking.additionalInfo || selectedBooking.description}
                  </div>
                </div>
              )}

              {(!selectedBooking.customerId || !selectedBooking.vehicleId) && !showProcessBooking && (
                <div className="mb-6 flex justify-end">
                  <button onClick={() => setShowProcessBooking(true)} className="px-4 py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-xl hover:bg-blue-100 flex items-center gap-2">
                    <AlertCircle size={14} /> Add Details (Link Records)
                  </button>
                </div>
              )}

              {showProcessBooking && (
                <ProcessBookingSection
                  booking={selectedBooking}
                  token={token}
                  onProcessed={(updated) => {
                    setSelectedBooking(updated);
                    setBookings(prev => prev.map(b => b._id === updated._id ? updated : b));
                    setShowProcessBooking(false);
                  }}
                  onCancel={() => setShowProcessBooking(false)}
                />
              )}

              <InternalNotesSection 
                recordId={selectedBooking._id} type="bookings"
                initialNotes={selectedBooking.internalNotes}
                initialAssigneeId={selectedBooking.assignedTo?._id || selectedBooking.assignedTo}
                token={token} onSave={(updated) => setSelectedBooking(updated)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


// --- NOTIFICATIONS TAB ---
const NOTIFICATION_CATEGORIES = [
  { key: '', label: 'All', icon: Bell },
  { key: 'bookings', label: 'Bookings', icon: Calendar },
  { key: 'job_cards', label: 'Job Cards', icon: Wrench },
  { key: 'rentals', label: 'Rentals', icon: Car },
  { key: 'communications', label: 'Communications', icon: Mail },
  { key: 'system', label: 'System', icon: AlertCircle },
];

const CATEGORY_BADGES = {
  bookings: { label: 'Bookings', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  job_cards: { label: 'Job Cards', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  rentals: { label: 'Rentals', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  communications: { label: 'Communications', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  system: { label: 'System', className: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const NOTIF_ICONS = {
  new_booking: { icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  booking_update: { icon: RefreshCw, color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
  new_quote: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  new_message: { icon: Mail, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  job_completed: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
  job_review: { icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-500/10' },
  rental_update: { icon: Car, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  system: { icon: Bell, color: 'text-orange-500', bg: 'bg-orange-500/10' },
};

const NotificationsTab = ({ token, onCountUpdate, onNavigateTab }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [page, setPage] = useState(1);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, readFilter]);

  const fetchNotifications = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (categoryFilter) params.set('category', categoryFilter);
      if (readFilter) params.set('isRead', readFilter);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const res = await fetch(`${API}/communications/notifications?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, page, categoryFilter, readFilter, debouncedSearch]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id) => {
    try {
      await fetch(`${API}/communications/notifications/${id}/read`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => {
        if (readFilter === 'false') {
          return prev.filter(n => n._id !== id);
        }
        return prev.map(n => n._id === id ? { ...n, isRead: true } : n);
      });
      onCountUpdate?.();
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API}/communications/notifications/read-all`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => {
        if (readFilter === 'false') return [];
        return prev.map(n => ({ ...n, isRead: true }));
      });
      onCountUpdate?.();
    } catch (err) { console.error(err); }
  };

  const handleNotificationClick = (n) => {
    if (!n.isRead) {
      markRead(n._id);
    }
    if (n.relatedModel === 'JobCard' && n.relatedId) {
      navigate(`/admin/job-cards/${n.relatedId}/edit`);
      return;
    }
    if (n.relatedModel === 'RentalServiceEntry') {
      navigate('/admin/rentals');
      return;
    }
    if (n.relatedModel === 'Booking' && n.relatedId) {
      onNavigateTab?.('bookings', n.relatedId);
      return;
    }
    if (n.relatedModel === 'Quote' && n.relatedId) {
      onNavigateTab?.('quotes', n.relatedId);
      return;
    }
    if (n.relatedModel === 'Contact' && n.relatedId) {
      onNavigateTab?.('messages', n.relatedId);
      return;
    }
    if (n.metadata?.actionUrl && typeof n.metadata.actionUrl === 'string' && n.metadata.actionUrl.startsWith('/')) {
      navigate(n.metadata.actionUrl);
    }
  };

  const hasActiveFilters = Boolean(search.trim() || categoryFilter || readFilter);

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setReadFilter('');
    setPage(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shadow-sm">
      {/* Search + Read Filter + Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, description, customer, booking ref, job card..."
            className="w-full pl-10 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-300 focus:bg-white transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={readFilter}
            onChange={(e) => { setReadFilter(e.target.value); setPage(1); }}
            aria-label="Read status filter"
            className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-300"
          >
            <option value="">All Statuses</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1.5"
            >
              <X size={14} /> Clear Filters
            </button>
          )}

          <button
            type="button"
            onClick={markAllRead}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Check size={14} /> Mark All as Read
          </button>
        </div>
      </div>

      {/* Category Filter Chips (horizontally scrollable on mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {NOTIFICATION_CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          const active = categoryFilter === cat.key;
          return (
            <button
              key={cat.key || 'all'}
              type="button"
              onClick={() => { setCategoryFilter(cat.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors flex-shrink-0 ${
                active
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <CatIcon size={13} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <EmptyState
            icon={Bell}
            title={hasActiveFilters ? 'No matching notifications' : "You're all caught up!"}
            desc={hasActiveFilters ? 'Try adjusting your search or filter criteria.' : 'No notifications to display.'}
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
            >
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => {
            const iconConfig = NOTIF_ICONS[n.type] || NOTIF_ICONS.system;
            const Icon = iconConfig.icon;
            const catBadge = CATEGORY_BADGES[n.category];
            const isNavigable = Boolean(
              (n.relatedModel === 'JobCard' && n.relatedId) ||
              n.relatedModel === 'RentalServiceEntry' ||
              (n.relatedModel === 'Booking' && n.relatedId) ||
              (n.relatedModel === 'Quote' && n.relatedId) ||
              (n.relatedModel === 'Contact' && n.relatedId) ||
              (n.metadata?.actionUrl && typeof n.metadata.actionUrl === 'string' && n.metadata.actionUrl.startsWith('/'))
            );

            return (
              <div
                key={n._id}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  !n.isRead
                    ? 'border-orange-200 bg-orange-50/50 hover:bg-orange-50 cursor-pointer shadow-sm'
                    : isNavigable
                      ? 'border-gray-100 bg-white hover:bg-gray-50/80 cursor-pointer'
                      : 'border-gray-100 bg-white'
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${iconConfig.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={iconConfig.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm ${!n.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{n.title}</p>
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                    {catBadge && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catBadge.className}`}>
                        {catBadge.label}
                      </span>
                    )}
                    {n.relatedReference && (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                        {n.relatedReference}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{n.message}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                    <p className="text-[10px] text-gray-400 font-medium">{new Date(n.createdAt).toLocaleString()}</p>
                    {n.relatedModel === 'JobCard' && n.relatedId && (
                      <Link
                        to={`/admin/job-cards/${n.relatedId}/edit`}
                        onClick={(e) => { e.stopPropagation(); if (!n.isRead) markRead(n._id); }}
                        className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1 rounded-lg transition-colors"
                      >
                        Review &amp; Finalize Job Card →
                      </Link>
                    )}
                    {n.relatedModel !== 'JobCard' && isNavigable && (
                      <span className="text-[11px] font-semibold text-gray-500 inline-flex items-center gap-1">
                        View record <ExternalLink size={11} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="mt-4">
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
};


// --- MAIN PAGE ---
const Communications = () => {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'quotes';
  const initialId = searchParams.get('id');
  const [summary, setSummary] = useState({ newQuotes: 0, unreadMessages: 0, pendingBookings: 0, unreadNotifications: 0 });

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const navigateToTab = useCallback((tab, id) => {
    const next = { tab };
    if (id) next.id = id;
    setSearchParams(next);
  }, [setSearchParams]);

  const clearInitialId = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('id');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API}/communications/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch (err) { console.error(err); }
  }, [token]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const tabCounts = {
    quotes: summary.newQuotes,
    messages: summary.unreadMessages,
    bookings: summary.pendingBookings,
    notifications: summary.unreadNotifications,
  };

  return (
    <div className="max-w-[1600px] mx-auto text-dark flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 px-2">
        <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20 shadow-sm">
          <MessageSquare size={24} className="text-red-600" />
        </div>
        <div>
          <h1 className="font-heading text-2xl md:text-3xl mb-1">Communications</h1>
          <p className="text-gray-500 text-xs md:text-sm">Manage incoming customer requests, messages, and notifications</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 px-2">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`bg-white border p-4 md:p-5 rounded-2xl text-left transition-all ${activeTab === tab.key ? 'border-red-300 shadow-md ring-1 ring-red-500/10' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${tab.bg} flex items-center justify-center`}>
                <tab.icon size={20} className={tab.color} />
              </div>
              {tabCounts[tab.key] > 0 && (
                <span className="bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full min-w-[24px] text-center shadow-sm">
                  {tabCounts[tab.key]}
                </span>
              )}
            </div>
            <p className="text-xl md:text-2xl font-black font-heading">{tabCounts[tab.key] || 0}</p>
            <p className="text-xs md:text-sm text-gray-500 font-bold">{tab.label}</p>
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div className="flex-1 px-2 pb-6">
        {activeTab === 'quotes' && <QuotesTab token={token} initialId={initialId} onClearInitialId={clearInitialId} />}
        {activeTab === 'messages' && <MessagesTab token={token} initialId={initialId} onClearInitialId={clearInitialId} />}
        {activeTab === 'bookings' && <BookingsTab token={token} summary={summary} initialId={initialId} onClearInitialId={clearInitialId} />}
        {activeTab === 'notifications' && <NotificationsTab token={token} onCountUpdate={fetchSummary} onNavigateTab={navigateToTab} />}
      </div>
    </div>
  );
};

export default Communications;
