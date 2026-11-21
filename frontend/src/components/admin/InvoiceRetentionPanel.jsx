import React, { useState, useEffect, useCallback } from 'react';
import {
  Archive, ShieldCheck, AlertTriangle, Database, RefreshCw, CheckCircle,
  Clock, Lock, Unlock, Trash2, FileText, HardDrive, RotateCcw, Ban
} from 'lucide-react';
import { useToast } from '../ui/ToastContext';

/**
 * Modal for Cancelling or Voiding an Issued/Paid Invoice while preserving the 5-year audit trail.
 */
export const CancelVoidInvoiceModal = ({ invoice, onClose, onSuccess }) => {
  const toast = useToast();
  const [actionType, setActionType] = useState('Cancelled');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!invoice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please enter a reason for cancelling or voiding this invoice.');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/${invoice._id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ actionType, reason: reason.trim() })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Invoice ${invoice.invoiceNo} marked as ${actionType}. Audit record retained for 5+ years.`);
        onSuccess();
        onClose();
      } else {
        toast.error(data.error || 'Failed to cancel/void invoice.');
      }
    } catch (err) {
      console.error('Error cancelling invoice:', err);
      toast.error('Network error while cancelling invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
        <div className="p-5 bg-[#222] text-white flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Ban size={18} className="text-red-400" />
            Cancel / Void Invoice — {invoice.invoiceNo}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
            <strong>5-Year Financial Audit Policy:</strong> Issued and paid invoices cannot be deleted. Cancelling or voiding preserves the original invoice number, customer snapshot, and financial amounts as an immutable audit record for at least 5 years.
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3.5 rounded-lg border border-gray-100">
            <div>
              <span className="text-xs text-gray-500 block">Customer</span>
              <span className="font-bold text-gray-800">{invoice.customerSnapshot?.name || invoice.customerId?.name || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Original Amount</span>
              <span className="font-mono font-bold text-gray-800">${Number(invoice.totalAmount || 0).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Action Type</label>
            <div className="grid grid-cols-2 gap-3">
              {['Cancelled', 'Voided'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActionType(type)}
                  className={`py-2.5 px-4 rounded-lg text-sm font-bold border transition-all ${
                    actionType === type
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Mark as {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
              Cancellation / Void Reason *
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Duplicate billing entry, re-issued under new invoice number, or customer billing adjustment..."
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:border-red-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {submitting ? 'Recording...' : `Confirm ${actionType}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Panel for 12-Month Old Quotes & Estimates Review
 */
export const OldQuotesReviewPanel = () => {
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [includeAll, setIncludeAll] = useState(false);
  const [search, setSearch] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams({
        includeAll: includeAll ? 'true' : 'false',
        search: search.trim()
      });
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/retention/quotes?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuotes(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load quotes for review:', err);
    } finally {
      setLoading(false);
    }
  }, [includeAll, search]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleQuoteDecision = async (quoteId, decision) => {
    const notes = window.prompt(
      decision === 'retain'
        ? 'Optional review note for retaining this quote:'
        : 'Optional review note for archiving this 12+ month quote:',
      decision === 'retain' ? 'Retained after 12-month review' : 'Archived after 12-month inactivity review'
    );
    if (notes === null) return;

    setReviewingId(quoteId);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/retention/quotes/${quoteId}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ decision, notes })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Quote ${decision === 'retain' ? 'retained' : 'archived'} successfully.`);
        fetchQuotes();
      } else {
        toast.error(data.error || 'Failed to update quote review status.');
      }
    } catch (err) {
      toast.error('Network error reviewing quote.');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2">
            <Clock size={18} className="text-amber-500" />
            Quotes &amp; Estimates Retention Review (12-Month Policy)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Quotes older than 12 months are flagged for administrative review. Quotes converted into invoices or under active discussion are automatically protected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer or rego..."
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500"
          />
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              checked={includeAll}
              onChange={(e) => setIncludeAll(e.target.checked)}
              className="accent-red-600"
            />
            Show all quotes (including &lt;12 months)
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading quote retention records...</div>
      ) : quotes.length === 0 ? (
        <div className="py-10 text-center bg-gray-50 rounded-xl border border-gray-100">
          <CheckCircle size={28} className="mx-auto text-green-500 mb-2" />
          <p className="text-sm font-bold text-gray-700">No Quotes Requiring 12-Month Review</p>
          <p className="text-xs text-gray-500 mt-1">All quotes older than 12 months have been reviewed or are within their active window.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Vehicle</th>
                <th className="py-3.5 px-4">Quote Status</th>
                <th className="py-3.5 px-4">Created / Age</th>
                <th className="py-3.5 px-4">Review Eligibility</th>
                <th className="py-3.5 px-4 text-right">Review Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => {
                const info = q.retentionInfo || {};
                return (
                  <tr key={q._id} className="border-b border-gray-100 hover:bg-gray-50 text-sm">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-800">{q.customerInfo?.fullName || 'Unknown'}</div>
                      <div className="text-xs text-gray-400">{q.customerInfo?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      <div>{q.vehicleInfo?.regNo || '—'}</div>
                      <div className="text-gray-400 font-sans">{q.vehicleInfo?.make} {q.vehicleInfo?.model}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                        {q.status}
                      </span>
                      {q.isArchived && (
                        <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600">
                      <div>Created: {new Date(q.createdAt).toLocaleDateString('en-AU')}</div>
                      <div className="text-gray-400">{info.ageMonths || 0} months ({info.ageDays || 0} days)</div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="font-medium text-gray-700">
                        Review Date: {info.retentionEligibleAt ? new Date(info.retentionEligibleAt).toLocaleDateString('en-AU') : '—'}
                      </div>
                      <div className="mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          info.reviewStatus === 'pending_review'
                            ? 'bg-amber-100 text-amber-800'
                            : info.reviewStatus === 'retained'
                            ? 'bg-green-100 text-green-700'
                            : info.reviewStatus === 'archived'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}>
                          {info.reviewStatus || 'not_due'}
                        </span>
                      </div>
                      {info.isProtected && (
                        <div className="text-[11px] text-amber-700 mt-1">
                          Protected: {info.protectionReasons?.join(' ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={reviewingId === q._id}
                          onClick={() => handleQuoteDecision(q._id, 'retain')}
                          className="px-3 py-1.5 rounded text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                        >
                          Retain
                        </button>
                        {!q.isArchived && !info.isProtected && (
                          <button
                            disabled={reviewingId === q._id}
                            onClick={() => handleQuoteDecision(q._id, 'archive')}
                            className="px-3 py-1.5 rounded text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
                          >
                            Archive Quote
                          </button>
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
  );
};

/**
 * Comprehensive Retention Policy, 2-Year Archival Control & 30–90 Day Database Backup Panel
 */
export const RetentionAndBackupManagementPanel = ({ onRefreshInvoices }) => {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [verifyingBackupId, setVerifyingBackupId] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);

  const fetchOverviewAndBackups = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [ovRes, bkRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/invoices/retention/overview`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/invoices/retention/backups`, { headers })
      ]);
      const ovData = await ovRes.json();
      const bkData = await bkRes.json();
      if (ovData.success) setOverview(ovData.data);
      if (bkData.success) setBackups(bkData.data?.backups || []);
    } catch (err) {
      console.error('Error loading retention overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewAndBackups();
  }, [fetchOverviewAndBackups]);

  const handleRunArchivalBatch = async () => {
    setArchiving(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/retention/run-archival`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchSize: 100 })
      });
      const data = await res.json();
      if (data.success) {
        const count = data.data?.archivedCount || 0;
        toast.success(
          count > 0
            ? `Archived ${count} invoice(s) older than 2 years to read-only archive.`
            : 'All eligible invoices older than 2 years are already archived (idempotent check complete).'
        );
        fetchOverviewAndBackups();
        if (onRefreshInvoices) onRefreshInvoices();
      } else {
        toast.error(data.error || 'Failed to run archival batch.');
      }
    } catch (err) {
      toast.error('Network error running archival batch.');
    } finally {
      setArchiving(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/retention/backups/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: 'Manual administrative snapshot from Retention & Backup console' })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Backup ${data.data.backupId} created (${data.data.totalDocuments} records across ${data.data.totalCollections} collections).`);
        fetchOverviewAndBackups();
      } else {
        toast.error(data.error || 'Failed to create database backup.');
      }
    } catch (err) {
      toast.error('Network error creating backup.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleVerifyBackup = async (backupId) => {
    setVerifyingBackupId(backupId);
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/invoices/retention/backups/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backupId })
      });
      const data = await res.json();
      if (data.success) {
        setVerificationResult(data.data);
        toast.success(`Backup ${backupId} verified: ${data.data.collectionsVerified} collections & SHA-256 checksums intact.`);
      } else {
        toast.error(data.error || 'Backup verification failed.');
      }
    } catch (err) {
      toast.error('Network error verifying backup.');
    } finally {
      setVerifyingBackupId(null);
    }
  };

  if (loading && !overview) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-sm text-gray-500">
        Loading Data Retention Policy &amp; Backup Management status...
      </div>
    );
  }

  const counts = overview?.counts || {};
  const schedule = overview?.policy?.OFFICIAL_SCHEDULE || [];

  return (
    <div className="space-y-6 mb-8">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-gray-500">Active Financial Invoices</span>
            <ShieldCheck size={18} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold font-heading text-dark">{counts.activeInvoices ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Retained minimum 5 years</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-slate-600">Read-Only Archive (&gt;2Y)</span>
            <Archive size={18} className="text-slate-600" />
          </div>
          <p className="text-2xl font-bold font-heading text-dark">{counts.archivedInvoices ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">
            {counts.archiveEligibleNow > 0
              ? `${counts.archiveEligibleNow} eligible for archival now`
              : 'All &gt;2 year invoices archived'}
          </p>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-amber-700">Pending Reviews</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-heading text-dark">
            {(counts.draftsReviewEligible || 0) + (counts.quotesReviewEligible || 0) + (counts.fiveYearReviewEligible || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {counts.draftsReviewEligible || 0} Drafts (90d) · {counts.quotesReviewEligible || 0} Quotes (12m) · {counts.fiveYearReviewEligible || 0} Post-5Y
          </p>
        </div>

        <div className="bg-white border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase text-blue-700">Database Backups (30–90d)</span>
            <Database size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold font-heading text-dark">{backups.length}</p>
          <p className="text-xs text-gray-500 mt-1">
            Latest: {backups[0] ? new Date(backups[0].createdAt).toLocaleDateString('en-AU') : 'None'}
          </p>
        </div>
      </div>

      {/* Authoritative Retention Policy Schedule + 2-Year Archival Runner */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-dark flex items-center gap-2">
              <ShieldCheck size={20} className="text-red-600" />
              Authoritative GSK Automotive Data Retention Policy
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Five years is the minimum statutory/accounting retention period for financial records — records are never automatically deleted after 5 years.
            </p>
          </div>
          <button
            onClick={handleRunArchivalBatch}
            disabled={archiving}
            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-black text-white flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <Archive size={15} />
            {archiving ? 'Running 2-Year Archival...' : 'Run 2-Year Read-Only Archival Now'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                <th className="py-3 px-4">Data Type</th>
                <th className="py-3 px-4">Official Retention Policy</th>
                <th className="py-3 px-4">Enforcement &amp; Protection Rules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {schedule.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50/70">
                  <td className="py-3 px-4 font-bold text-gray-800 whitespace-nowrap">{row.dataType}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                      {row.retentionPolicy}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Database Backup & Recovery History Section */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-bold text-dark flex items-center gap-2">
              <HardDrive size={20} className="text-blue-600" />
              Database Backups &amp; 30–90 Day Recovery History
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Logical JSON collection snapshots with SHA-256 checksum verification, CustomerSnapshot preservation, and Cloudinary/PDF recovery manifest.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchOverviewAndBackups}
              className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50"
            >
              <Database size={15} />
              {creatingBackup ? 'Creating Snapshot...' : 'Create Backup Snapshot Now'}
            </button>
          </div>
        </div>

        {verificationResult && (
          <div className="mb-5 p-4 rounded-xl bg-green-50 border border-green-200 text-green-900 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                Restoration &amp; Integrity Verification Passed: {verificationResult.backupId}
              </span>
              <button onClick={() => setVerificationResult(null)} className="text-green-700 hover:underline">Dismiss</button>
            </div>
            <p>
              Verified <strong>{verificationResult.collectionsVerified}</strong> collections with zero SHA-256 checksum mismatches.
              Invoices in snapshot: <strong>{verificationResult.invoiceVerification?.totalInvoicesInBackup || 0}</strong>{' '}
              (Active: {verificationResult.invoiceVerification?.activeCount || 0}, Archived: {verificationResult.invoiceVerification?.archivedCount || 0}, Cancelled/Voided: {verificationResult.invoiceVerification?.cancelledOrVoidedCount || 0}).
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                <th className="py-3 px-4">Snapshot ID</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Retention Expires</th>
                <th className="py-3 px-4">Collections / Docs</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {backups.map(bk => (
                <tr key={bk.backupId} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-xs font-bold text-gray-800">{bk.backupId}</td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {new Date(bk.createdAt).toLocaleString('en-AU')} ({bk.ageDays}d ago)
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {bk.expiresAt ? new Date(bk.expiresAt).toLocaleDateString('en-AU') : '90 days'}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-700">
                    {bk.totalCollections} collections · {bk.totalDocuments} records
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-600">
                    {(Number(bk.totalBytes || 0) / 1024).toFixed(1)} KB
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleVerifyBackup(bk.backupId)}
                      disabled={verifyingBackupId === bk.backupId}
                      className="px-3 py-1.5 rounded text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    >
                      {verifyingBackupId === bk.backupId ? 'Verifying...' : 'Verify Integrity & Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

