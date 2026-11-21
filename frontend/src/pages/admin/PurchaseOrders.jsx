import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Search, Plus, Eye, CheckCircle2, Circle, AlertCircle, X, Trash2, ArrowLeft, Loader2,
  ClipboardList, Mail, Send, AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import { hasActionPermission } from '../../utils/pageAccess';
import { useToast } from '../../components/ui/ToastContext';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

const PO_STATUSES = ['All', 'Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'];
const CONFIRMED_PO_STATUSES = ['Ordered', 'Partially Received', 'Received'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PurchaseOrders = () => {
  const { user } = useAuth();
  const { startTour } = useTour();
  const toast = useToast();
  const canCreate = hasActionPermission(user, 'purchaseOrders.create');
  const canEdit = hasActionPermission(user, 'purchaseOrders.edit');
  const canDelete = hasActionPermission(user, 'purchaseOrders.delete');
  const canEmail = hasActionPermission(user, 'purchaseOrders.email') || hasActionPermission(user, 'purchaseOrders.place');
  const [pos, setPos] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Send PO Email Modal state
  const [poToEmail, setPoToEmail] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState(null);
  const [emailIdempotencyKey, setEmailIdempotencyKey] = useState('');
  const emailInFlightRef = useRef(false);
  
  const [formData, setFormData] = useState({
    supplierId: null,
    notes: '',
    expectedDeliveryDate: ''
  });
  const [poItems, setPoItems] = useState([]);

  // For adding items to PO
  const [selectedPoItem, setSelectedPoItem] = useState(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);

  const fetchPOs = async (signal) => {
    try {
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      params.append('page', page);
      params.append('limit', '10');
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (response.ok) {
        const data = await response.json();
        setPos(data.purchaseOrders);
        setPagination({ page: data.page || page, pages: data.pages || 1, total: data.total || 0 });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch POs:', error);
      }
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      fetchPOs(abortController.signal);
    }, 300);
    return () => {
      clearTimeout(timeout);
      abortController.abort();
    };
  }, [searchQuery, statusFilter, page]);

  const searchSuppliers = async (q) => {
    const token = localStorage.getItem('gsk_token');
    const res = await fetch(`${import.meta.env.VITE_API_URL}/suppliers?search=${encodeURIComponent(q)}&status=Active`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return data;
  };

  const searchPoItems = async (q) => {
    const token = localStorage.getItem('gsk_token');
    const res = await fetch(`${import.meta.env.VITE_API_URL}/inventory/purchase-order-items?search=${encodeURIComponent(q)}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return data.data || [];
  };

  const handleAddPoItem = () => {
    if (!selectedPoItem || itemQuantity <= 0 || itemPrice < 0) {
        toast.error("Please select a valid inventory item, quantity (>0), and price (>=0)");
        return;
    }
    
    // Check if variant already exists
    const exists = poItems.find(i => i.variantId === selectedPoItem.variantId && i.inventoryId === selectedPoItem.inventoryId);
    if (exists) {
        toast.error("This inventory item is already in the PO. Please edit its quantity instead or remove it first.");
        return;
    }

    setPoItems([...poItems, {
        inventoryId: selectedPoItem.inventoryId,
        variantId: selectedPoItem.variantId,
        productName: selectedPoItem.productName,
        variantName: selectedPoItem.variantName,
        hierarchyPath: selectedPoItem.hierarchyPath,
        sku: selectedPoItem.sku,
        quantityOrdered: parseInt(itemQuantity, 10),
        unitPurchasePrice: parseFloat(itemPrice)
    }]);

    setSelectedPoItem(null);
    setItemQuantity(1);
    setItemPrice(0);
  };

  const removePoItem = (variantId) => {
      setPoItems(poItems.filter(i => i.variantId !== variantId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (poItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const url = editingId 
        ? `${import.meta.env.VITE_API_URL}/purchase-orders/${editingId}`
        : `${import.meta.env.VITE_API_URL}/purchase-orders`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
            supplierId: formData.supplierId._id,
            items: poItems,
            notes: formData.notes,
            expectedDeliveryDate: formData.expectedDeliveryDate
        })
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ supplierId: null, notes: '', expectedDeliveryDate: '' });
        setPoItems([]);
        fetchPOs();
        window.scrollTo(0, 0);
        document.querySelector('main')?.scrollTo(0, 0);
        toast.success(`Purchase Order ${editingId ? 'updated' : 'created'} successfully`);
      } else {
        const err = await response.json();
        toast.error(err.message || `Failed to ${editingId ? 'update' : 'create'} PO`);
      }
    } catch (error) {
      console.error(error);
      toast.error(`Error ${editingId ? 'updating' : 'creating'} PO`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (po) => {
    setEditingId(po._id);
    setFormData({
      supplierId: po.supplierId,
      notes: po.notes || '',
      expectedDeliveryDate: po.expectedDeliveryDate ? po.expectedDeliveryDate.split('T')[0] : ''
    });
    setPoItems(po.items.map(item => ({
      inventoryId: item.inventoryId,
      variantId: item.variantId,
      productName: item.name || 'Item',
      hierarchyPath: '',
      sku: item.sku || '',
      quantityOrdered: item.quantityOrdered,
      unitPurchasePrice: item.unitPurchasePrice
    })));
    setIsModalOpen(true);
  };

  const openDeleteModal = (po) => {
    setPoToDelete(po);
    setIsDeleteModalOpen(true);
  };

  const openEmailModal = (po) => {
    setEmailFeedback(null);
    setEmailIdempotencyKey(`po-email-${po._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setPoToEmail(po);
  };

  const handleSendPoEmail = async () => {
    if (!poToEmail || isSendingEmail || emailInFlightRef.current) return;
    const recipientEmail = String(poToEmail.supplierId?.email || '').trim();
    if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
      setEmailFeedback({
        type: 'error',
        message: 'Supplier does not have a valid registered email address. Please update the supplier profile first.'
      });
      return;
    }

    const hasBeenSent = (poToEmail.lastEmailStatus?.sendCount > 0) ||
      (poToEmail.emailHistory || []).some(e => e.status && e.status !== 'failed');

    emailInFlightRef.current = true;
    setIsSendingEmail(true);
    setEmailFeedback(null);

    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders/${poToEmail._id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          resend: hasBeenSent,
          idempotencyKey: emailIdempotencyKey
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updatedPo = data.purchaseOrder || {
          ...poToEmail,
          lastEmailStatus: data.lastEmailStatus,
          emailHistory: [...(poToEmail.emailHistory || []), data.emailLog].filter(Boolean)
        };
        setPos(prev => prev.map(p => p._id === poToEmail._id ? updatedPo : p));
        setPoToEmail(updatedPo);
        setEmailIdempotencyKey(`po-email-${poToEmail._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const msg = data.message || `Purchase Order email accepted by Brevo for ${recipientEmail}`;
        setEmailFeedback({ type: 'success', message: msg });
        toast.success(msg);
      } else {
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

  const confirmDelete = async () => {
    if (!poToDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/purchase-orders/${poToDelete._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('Purchase Order deleted successfully');
        fetchPOs();
        setIsDeleteModalOpen(false);
        setPoToDelete(null);
      } else {
        const err = await response.json();
        toast.error(err.message || 'Failed to delete PO');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error deleting PO');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status) => {
      switch (status) {
          case 'Draft': return 'bg-gray-100 text-gray-700';
          case 'Ordered': return 'bg-blue-100 text-blue-700';
          case 'Partially Received': return 'bg-yellow-100 text-yellow-700';
          case 'Received': return 'bg-green-100 text-green-700';
          case 'Cancelled': return 'bg-red-100 text-red-700';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

  const updateListFilter = (setter, value) => {
    setPage(1);
    setter(value);
  };

  if (isModalOpen) {
    const subtotal = poItems.reduce((sum, item) => sum + (item.quantityOrdered * item.unitPurchasePrice), 0);
    const gstRate = 10;
    const taxAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + taxAmount;

    return (
      <div className="max-w-[1400px] mx-auto text-dark">
        {/* Back navigation */}
        <div className="mb-6">
          <button 
            onClick={() => { setIsModalOpen(false); setEditingId(null); window.scrollTo(0, 0); document.querySelector('main')?.scrollTo(0, 0); }} 
            className="inline-flex items-center text-gray-500 hover:text-dark transition-colors font-medium text-sm"
          >
            <ArrowLeft size={16} className="mr-2" /> Back to Purchase Orders
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-white">
              <h2 className="text-2xl font-bold font-heading text-dark">{editingId ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
              <p className="text-gray-500 text-sm mt-1">{editingId ? 'Update draft purchase order details.' : 'Create a new purchase order for a supplier.'}</p>
            </div>
            
            <div className="p-6 bg-[#f8f9fa]">
              <form id="createPoForm" onSubmit={handleSubmit} className="space-y-8 max-w-5xl">
                {/* Supplier Section */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-dark border-b pb-2">Supplier Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Supplier *</label>
                            <EntityAutocomplete
                                fetchOptions={searchSuppliers}
                                value={formData.supplierId}
                                onSelect={(val) => setFormData(prev => ({ ...prev, supplierId: val }))}
                                getOptionLabel={(opt) => opt.name}
                                placeholder="Search supplier..."
                                emptyMessage="Search for a supplier by name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Expected Delivery Date</label>
                            <input 
                                type="date" 
                                value={formData.expectedDeliveryDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Items Section */}
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-dark border-b pb-2">Order Items</h3>
                    
                    {/* Item Adder */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                        <h4 className="text-sm font-bold text-gray-700 mb-3">Add Variant to PO</h4>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-7">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Inventory Item *</label>
                                <EntityAutocomplete
                                    fetchOptions={searchPoItems}
                                    value={selectedPoItem}
                                    onSelect={(val) => {
                                        setSelectedPoItem(val);
                                        if (val) setItemPrice(val.unitPurchasePrice || 0);
                                    }}
                                    getOptionLabel={(opt) => `${opt.productName} — ${opt.hierarchyPath} ${opt.sku ? `(SKU: ${opt.sku})` : ''} [Stock: ${opt.currentStock}]`}
                                    placeholder="Search Product, Variant, SKU..."
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Quantity *</label>
                                <input 
                                    type="number" min="1"
                                    value={itemQuantity}
                                    onChange={(e) => setItemQuantity(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Unit Purchase Price *</label>
                                <input 
                                    type="number" min="0" step="0.01"
                                    value={itemPrice}
                                    onChange={(e) => setItemPrice(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 focus:border-blue-500 outline-none transition-colors"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <button
                                    type="button"
                                    onClick={handleAddPoItem}
                                    disabled={!selectedPoItem || itemQuantity <= 0 || itemPrice < 0}
                                    className="w-full h-[42px] bg-blue-600 disabled:bg-blue-300 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Added Items List */}
                    {poItems.length > 0 ? (
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product / Variant</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit Purchase Price</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {poItems.map((item, idx) => (
                                        <tr key={idx} className="border-b last:border-0 border-gray-100">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-dark">{item.productName}</div>
                                                <div className="text-xs text-gray-500">{item.hierarchyPath} {item.sku ? `| SKU: ${item.sku}` : ''}</div>
                                            </td>
                                            <td className="py-3 px-4">{item.quantityOrdered}</td>
                                            <td className="py-3 px-4">${parseFloat(item.unitPurchasePrice).toFixed(2)}</td>
                                            <td className="py-3 px-4 font-bold text-dark">
                                                ${(item.quantityOrdered * item.unitPurchasePrice).toFixed(2)}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button type="button" onClick={() => removePoItem(item.variantId)} className="text-gray-400 hover:text-red-500">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            No items added to the Purchase Order yet.
                        </div>
                    )}
                </div>
                
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</label>
                    <textarea 
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows="3"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 outline-none transition-colors resize-none"
                        placeholder="Additional instructions or notes for the supplier..."
                    ></textarea>
                </div>
              </form>
            </div>
            
            {/* Order Summary & Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="w-full md:w-72 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
                        <span>Subtotal ({poItems.length} items)</span>
                        <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-3 text-sm text-gray-600 border-b border-gray-100 pb-3">
                        <span>Tax/GST (10%)</span>
                        <span className="font-medium">${taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold text-dark">
                        <span>Total</span>
                        <span>${totalAmount.toFixed(2)}</span>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <button 
                        type="button" onClick={() => { setIsModalOpen(false); setEditingId(null); window.scrollTo(0, 0); document.querySelector('main')?.scrollTo(0, 0); }} 
                        className="flex-1 md:flex-none px-6 py-3 rounded-lg text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        form="createPoForm"
                        disabled={isSubmitting}
                        className="flex-1 md:flex-none px-6 py-3 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        {isSubmitting ? (
                          <><Loader2 size={16} className="animate-spin" /> Saving...</>
                        ) : (
                          editingId ? 'Save Changes' : 'Create Purchase Order'
                        )}
                    </button>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <FileText size={24} className="text-blue-500" />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="font-heading text-3xl mb-1">Purchase Orders</h1>
              {user && (user.role === 'admin' || user.role === 'superadmin') && (
                <button
                  onClick={() => startTour('purchase-orders')}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold bg-dark hover:bg-black text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <ClipboardList size={14} /> Page Tour
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm">Manage inventory orders and stock receiving.</p>
          </div>
        </div>
        {canCreate && <button
          onClick={() => {
              setFormData({ supplierId: null, notes: '', expectedDeliveryDate: '' });
              setPoItems([]);
              setIsModalOpen(true);
              window.scrollTo(0, 0);
              document.querySelector('main')?.scrollTo(0, 0);
          }}
          className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> Create PO
        </button>}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-96">
          <input 
            type="text" 
            placeholder="Search PO number, supplier, items..." 
            value={searchQuery}
            onChange={(e) => updateListFilter(setSearchQuery, e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => updateListFilter(setStatusFilter, e.target.value)}
          className="w-full sm:w-auto px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-sm font-medium text-gray-700 cursor-pointer"
        >
          {PO_STATUSES.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mb-6 text-sm text-gray-500">
          <span>Page {pagination.page} of {pagination.pages} ({pagination.total} orders)</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">PO Number</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-500 text-sm">
                    No purchase orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                pos.map(po => {
                  const isConfirmed = CONFIRMED_PO_STATUSES.includes(po.status);
                  const emailStatus = po.lastEmailStatus?.status || 'not_sent';
                  const hasBeenSent = (po.lastEmailStatus?.sendCount > 0) ||
                    (po.emailHistory || []).some(e => e.status && e.status !== 'failed');
                  return (
                  <tr key={po._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-dark">{po.purchaseOrderNumber}</div>
                      <div className="text-sm text-gray-500">{po.items.length} items</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium">{po.supplierId?.name || 'Unknown Supplier'}</div>
                      {po.supplierId?.email && (
                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{po.supplierId.email}</div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-gray-600">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-dark">${po.totalAmount.toFixed(2)}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${getStatusColor(po.status)}`}>
                          {po.status}
                        </span>
                        {isConfirmed && emailStatus !== 'not_sent' && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            emailStatus === 'delivered' || emailStatus === 'opened'
                              ? 'bg-emerald-50 text-emerald-700'
                              : emailStatus === 'accepted'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-red-50 text-red-700'
                          }`}>
                            <Mail size={10} />
                            {emailStatus === 'accepted' ? 'Accepted by Brevo' : emailStatus === 'delivered' ? 'Delivered' : emailStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                          <Link 
                            to={`/admin/purchase-orders/${po._id}`}
                            className="inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                          >
                            <Eye size={16} className="mr-1" /> View
                          </Link>
                          {isConfirmed && canEmail && (
                            <button
                              type="button"
                              onClick={() => openEmailModal(po)}
                              className="inline-flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                            >
                              <Mail size={15} className="mr-1" />
                              {hasBeenSent ? 'Resend PO' : 'Email PO'}
                            </button>
                          )}
                          {po.status === 'Draft' && canEdit && (
                            <button
                              onClick={() => handleEdit(po)}
                              className="inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => openDeleteModal(po)}
                              className="inline-flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                            >
                              Delete
                            </button>
                          )}
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

      {/* Send Purchase Order Email Modal */}
      <Modal isOpen={!!poToEmail} onClose={() => !isSendingEmail && setPoToEmail(null)}>
        {poToEmail && (() => {
          const recipientEmail = String(poToEmail.supplierId?.email || '').trim();
          const hasValidEmail = Boolean(recipientEmail && EMAIL_REGEX.test(recipientEmail));
          const hasBeenSent = (poToEmail.lastEmailStatus?.sendCount > 0) ||
            (poToEmail.emailHistory || []).some(e => e.status && e.status !== 'failed');
          return (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-dark">
                      {hasBeenSent ? 'Resend Purchase Order Email' : 'Send Purchase Order Email'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Purchase Order #{poToEmail.purchaseOrderNumber} &bull; GSK Automotive
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={() => setPoToEmail(null)}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>

              {emailFeedback && (
                <div className={`mb-4 p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                  emailFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {emailFeedback.type === 'success' ? (
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                  ) : (
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                  )}
                  <span>{emailFeedback.message}</span>
                </div>
              )}

              {!hasValidEmail && (
                <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                  <span>
                    Supplier <strong>{poToEmail.supplierId?.name || 'Unknown'}</strong> has no valid registered email address. Please update the supplier record before sending.
                  </span>
                </div>
              )}

              {hasBeenSent && hasValidEmail && (
                <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    This purchase order was already emailed previously. Confirm below to intentionally resend it to <strong>{recipientEmail}</strong>.
                  </span>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-500">Supplier:</span>
                  <span className="font-bold text-dark">{poToEmail.supplierId?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Recipient Email:</span>
                  <span className={`font-bold ${hasValidEmail ? 'text-blue-700' : 'text-red-600'}`}>
                    {recipientEmail || 'No email registered'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Attachment:</span>
                  <span className="font-mono text-xs text-gray-700">GSK_PO_{poToEmail.purchaseOrderNumber}.pdf</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Grand Total:</span>
                  <span className="font-bold text-dark">${poToEmail.totalAmount.toFixed(2)} AUD</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPoToEmail(null)}
                  disabled={isSendingEmail}
                >
                  Close
                </Button>
                <button
                  type="button"
                  disabled={isSendingEmail || !hasValidEmail}
                  onClick={handleSendPoEmail}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      {hasBeenSent ? 'Confirm & Resend' : 'Send Purchase Order Email'}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => !isDeleting && setIsDeleteModalOpen(false)}>
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 mx-auto">
            <Trash2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-center text-dark mb-2">Delete Purchase Order</h3>
          <p className="text-gray-500 text-center text-sm mb-6">
            Are you sure you want to delete purchase order <span className="font-bold text-dark">{poToDelete?.purchaseOrderNumber}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={isDeleting}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default PurchaseOrders;
