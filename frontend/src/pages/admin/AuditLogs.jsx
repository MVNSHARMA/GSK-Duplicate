import React, { useEffect, useState } from 'react';
import { FileClock, Search, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ACTION_OPTIONS = [
  // Auth
  ['LOGIN_SUCCESS', 'Login Success'],
  ['LOGIN_FAILED', 'Login Failed'],
  ['USER_REGISTERED', 'User Registered'],
  ['INVITATION_ACCEPTED', 'Invitation Accepted'],
  ['PASSWORD_RESET', 'Password Reset'],
  // Employee Management
  ['employee.page_access.granted', 'Permission Granted'],
  ['employee.page_access.revoked', 'Permission Revoked'],
  ['employee.action_permission.granted', 'Action Permission Granted'],
  ['employee.action_permission.revoked', 'Action Permission Revoked'],
  ['employee.invitation.created', 'Invitation Created'],
  ['employee.invitation.revoked', 'Invitation Revoked'],
  ['employee.role.changed', 'Role Changed'],
  ['employee.account.disabled', 'Account Disabled'],
  ['employee.account.enabled', 'Account Enabled'],
  ['employee.removed', 'Employee Removed'],
  ['employee.password.changed', 'Password Changed'],
  // Customers
  ['CREATE_CUSTOMER', 'Customer Created'],
  ['UPDATE_CUSTOMER', 'Customer Updated'],
  ['DELETE_CUSTOMER', 'Customer Deleted'],
  ['LINK_VEHICLE', 'Vehicle Linked'],
  ['UNLINK_VEHICLE', 'Vehicle Unlinked'],
  ['REASSIGN_VEHICLE', 'Vehicle Reassigned'],
  ['PROVISION_PORTAL_USER', 'Portal User Provisioned'],
  // Vehicles
  ['CREATE_VEHICLE', 'Vehicle Created'],
  ['UPDATE_VEHICLE', 'Vehicle Updated'],
  ['DELETE_VEHICLE', 'Vehicle Deleted'],
  // Job Cards
  ['CREATE_JOB_CARD', 'Job Card Created'],
  ['UPDATE_JOB_CARD', 'Job Card Updated'],
  ['DELETE_JOB_CARD', 'Job Card Deleted'],
  ['job_card.status_changed', 'Job Card Status Changed'],
  // Invoices
  ['CREATE_INVOICE', 'Invoice Created'],
  ['UPDATE_INVOICE', 'Invoice Updated'],
  ['DELETE_INVOICE', 'Invoice Deleted'],
  ['RECORD_PAYMENT', 'Payment Recorded'],
  ['SEND_INVOICE_EMAIL', 'Invoice Emailed'],
  // Inventory
  ['inventory.created', 'Inventory Created'],
  ['inventory.updated', 'Inventory Updated'],
  ['inventory.deleted', 'Inventory Deleted'],
  ['inventory.stock_adjusted', 'Stock Adjusted'],
  ['ADD_VARIANT', 'Variant Added'],
  ['UPDATE_VARIANT', 'Variant Updated'],
  ['DEACTIVATE_VARIANT', 'Variant Deactivated'],
  // Purchase Orders
  ['purchase_order.created', 'PO Created'],
  ['purchase_order.updated', 'PO Updated'],
  ['purchase_order.placed', 'PO Placed'],
  ['purchase_order.received', 'PO Received'],
  ['purchase_order.cancelled', 'PO Cancelled'],
  // Suppliers
  ['supplier.created', 'Supplier Created'],
  ['supplier.updated', 'Supplier Updated'],
  ['supplier.deactivated', 'Supplier Deactivated'],
  // Sales
  ['CREATE_SALE', 'Sale Created'],
  ['UPDATE_SALE', 'Sale Updated'],
  ['DELETE_SALE', 'Sale Deleted'],
  // Imports
  ['CREATE_IMPORT', 'Import Created'],
  ['UPDATE_IMPORT', 'Import Updated'],
  ['DELETE_IMPORT', 'Import Deleted'],
  ['UPDATE_IMPORT_STATUS', 'Import Status Updated'],
  // Rentals
  ['CREATE_RENTAL', 'Rental Created'],
  ['UPDATE_RENTAL', 'Rental Updated'],
  ['DELETE_RENTAL', 'Rental Deleted'],
  // Dealer Cars
  ['CREATE_DEALER_CAR', 'Dealer Car Added'],
  ['UPDATE_DEALER_CAR', 'Dealer Car Updated'],
  ['DELETE_DEALER_CAR', 'Dealer Car Deleted'],
  // Trash
  ['RESTORE_ITEM', 'Item Restored'],
  ['PERMANENT_DELETE', 'Permanently Deleted'],
  ['PERMANENT_DELETE_BULK', 'Bulk Permanently Deleted'],
  // Tracker Cars
  ['STATUS_CHANGE', 'Tracker Car Status Changed'],
  ['BULK_STATUS_UPDATE', 'Bulk Tracker Car Status Update'],
  ['TRACKER_CAR_EDIT', 'Tracker Car Edited'],
  ['DOCUMENT_UPLOAD', 'Document Uploaded'],
  ['DOCUMENT_DELETE', 'Document Deleted'],
  // Settings
  ['UPDATE_SETTINGS', 'Settings Updated'],
];

const ENTITY_OPTIONS = [
  'Employee', 'User', 'Customer', 'Vehicle', 'JobCard', 'Invoice',
  'Inventory', 'PurchaseOrder', 'Supplier', 'Sale', 'ImportTracker',
  'Rental', 'DealerCar', 'Booking', 'Quote', 'Setting', 'VehicleBatch',
  'VehicleBatchMembership', 'TrackerCarDocument'
];

const formatDate = (value) => new Date(value).toLocaleString('en-AU', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const AuditLogs = () => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, hasNext: false, hasPrevious: false });
  const [filters, setFilters] = useState({ search: '', actor: '', action: '', date: 'last_7_days', from: '', to: '' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [actors, setActors] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    const loadLogs = async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page, limit: 25 });
      if (debouncedFilters.search.trim()) params.set('search', debouncedFilters.search.trim());
      if (debouncedFilters.actor) params.set('actor', debouncedFilters.actor);
      if (debouncedFilters.action) params.set('action', debouncedFilters.action);
      
      if (debouncedFilters.date !== 'all') {
        params.set('datePreset', debouncedFilters.date);
        if (debouncedFilters.date === 'custom') {
          if (debouncedFilters.from) params.set('customFromDate', debouncedFilters.from);
          if (debouncedFilters.to) params.set('customToDate', debouncedFilters.to);
        }
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/audit-logs?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load audit logs');
        setLogs(data.data || []);
        setPagination(data.pagination || { page, pages: 1, hasNext: false, hasPrevious: false });
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message === 'Forbidden' ? 'You do not have permission to view audit logs.' : 'Unable to load audit logs. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    if (token) loadLogs();
    return () => controller.abort();
  }, [token, page, debouncedFilters]);

  useEffect(() => {
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_URL}/admins`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => { if (data.success) setActors(data.data || []); })
      .catch(() => setActors([]));
  }, [token]);

  const updateFilter = (name, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  };

  return (
    <div className="max-w-[1400px] mx-auto text-dark pb-20">
      <div className="mb-8 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <FileClock size={24} />
        </div>
        <div>
          <h1 className="font-heading text-4xl mb-1">Audit Logs</h1>
          <p className="text-gray-500 text-sm">Read-only security and administrative activity.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search actor, entity, or description" className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary" />
        </label>
        <select value={filters.actor} onChange={(event) => updateFilter('actor', event.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary">
          <option value="">All actors</option>
          {actors.map((actor) => <option key={actor._id} value={actor._id}>{actor.name || actor.email}</option>)}
        </select>
        <select value={filters.action} onChange={(event) => updateFilter('action', event.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary">
          <option value="">All actions</option>
          {ACTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary">
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>
        {filters.date === 'custom' && (
          <div className="md:col-span-4 flex gap-3">
            <input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary" />
            <input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading && <div className="p-12 text-center text-sm text-gray-500">Loading audit activity...</div>}
        {!loading && error && <div className="p-12 text-center text-sm text-red-500">{error}</div>}
        {!loading && !error && logs.length === 0 && <div className="p-12 text-center text-sm text-gray-500">No audit activity found.</div>}
        {!loading && !error && logs.length > 0 && (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <button key={log._id} type="button" onClick={() => setSelectedLog(log)} className="w-full text-left p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{formatDate(log.createdAt)}</p>
                    <p className="font-semibold text-dark">{log.actionLabel}</p>
                    <p className="text-sm text-gray-600 mt-1">{log.description || log.entityDisplay || log.target || 'Administrative activity'}</p>
                    <p className="text-xs text-gray-400 mt-2">{log.actorName || log.actorEmail || 'System'}{log.actorRole ? ` - ${log.actorRole.replace('_', ' ')}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {log.entityType && <span className="rounded-full bg-gray-100 px-2.5 py-1">{log.entityType}</span>}
                    <Eye size={15} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Page {pagination.page} of {pagination.pages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={!pagination.hasPrevious} onClick={() => setPage((current) => current - 1)} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <button type="button" disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-2xl">Audit Event</h2>
              <button type="button" onClick={() => setSelectedLog(null)} className="p-2 text-gray-400 hover:text-dark"><X size={18} /></button>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-400">Time</dt><dd>{formatDate(selectedLog.createdAt)}</dd></div>
              <div><dt className="text-gray-400">Action</dt><dd>{selectedLog.actionLabel}</dd></div>
              <div><dt className="text-gray-400">Actor</dt><dd>{selectedLog.actorName || selectedLog.actorEmail || 'System'}</dd></div>
              <div><dt className="text-gray-400">Role</dt><dd>{selectedLog.actorRole || 'Unknown'}</dd></div>
              <div><dt className="text-gray-400">Entity</dt><dd>{selectedLog.entityDisplay || selectedLog.entityType || selectedLog.target || 'Not specified'}</dd></div>
              <div><dt className="text-gray-400">Entity ID</dt><dd className="break-all">{selectedLog.entityId || 'Not specified'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-gray-400">Description</dt><dd>{selectedLog.description || 'Not specified'}</dd></div>
            </dl>
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <pre className="mt-5 bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
