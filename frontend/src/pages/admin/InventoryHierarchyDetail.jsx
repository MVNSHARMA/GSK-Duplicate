import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Edit2, Trash2, Search, 
  History, AlertTriangle, Package, Box, ArrowDownToLine, ShieldCheck, Eye, ChevronRight, ChevronLeft
} from 'lucide-react';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';
import { useAuth } from '../../context/AuthContext';
import { hasActionPermission } from '../../utils/pageAccess';

const ITEMS_PER_PAGE = 15;

const InventoryHierarchyDetail = () => {
  const { id, variantId, subVariantId, subSubVariantId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const canEdit = hasActionPermission(user, 'inventory.edit');
  const canDelete = hasActionPermission(user, 'inventory.delete');
  const canAdjustStock = hasActionPermission(user, 'inventory.adjustStock');
  const canView = hasActionPermission(user, 'inventory.view');

  const currentDepth = subSubVariantId ? 3 : subVariantId ? 2 : variantId ? 1 : 0;
  const currentParentId = subSubVariantId || subVariantId || variantId || null;

  const [parentData, setParentData] = useState(null);
  const [children, setChildren] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('All'); 
  const [currentPage, setCurrentPage] = useState(1);

  // Variant Modal State
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantFormData, setVariantFormData] = useState({
    name: '', sku: '', quantity: '', unitPrice: '', minStockLevel: '',
    parentId: null, supplierId: '', supplierSource: 'inherited'
  });

  // Adjust Stock Modal State
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [adjustStockData, setAdjustStockData] = useState({ adjustment: '', reason: '' });
  
  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPages, setTransactionPages] = useState(1);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, stockFilter, currentDepth]);

  const fetchHierarchyData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('gsk_token');
      
      const params = new URLSearchParams();
      if (currentParentId) params.append('parentId', currentParentId);
      else params.append('parentId', 'null');
      
      params.append('page', currentPage);
      params.append('limit', ITEMS_PER_PAGE);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (stockFilter !== 'All') params.append('stockStatus', stockFilter);

      const url = `${import.meta.env.VITE_API_URL}/inventory/${id}/children?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      const data = await response.json();
      
      if (response.status === 404 || !data.success) {
        setError(data.error || 'Hierarchy node not found');
        setParentData(null);
      } else if (data.success) {
        setParentData(data.parent);
        setChildren(data.children || []);
        if (data.pagination) setPagination(data.pagination);
        setError(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to fetch hierarchy:", err);
        setError("Failed to fetch inventory data.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, currentParentId, currentPage, debouncedSearch, stockFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchHierarchyData(controller.signal);
    return () => controller.abort();
  }, [fetchHierarchyData]);

  // VARIANT MANAGEMENT
  const resetVariantForm = () => {
    setIsVariantModalOpen(false);
    setEditingVariant(null);
    setVariantFormData({ name: '', sku: '', quantity: '', unitPrice: '', minStockLevel: '', parentId: null, supplierId: '', supplierSource: 'inherited' });
  };

  const handleAddChildClick = () => {
    setEditingVariant(null);
    setVariantFormData({ name: '', sku: '', quantity: '', unitPrice: '', minStockLevel: '', parentId: currentParentId, supplierId: '', supplierSource: 'inherited' });
    setIsVariantModalOpen(true);
  };

  const handleEditVariantClick = (variant) => {
    setEditingVariant(variant._id);
    setVariantFormData({
      name: variant.name,
      sku: variant.sku || '',
      quantity: variant.quantity,
      unitPrice: variant.unitPrice,
      minStockLevel: variant.minStockLevel,
      parentId: variant.parentId || null,
      supplierId: variant.supplierId?._id || variant.supplierId || '',
      supplierSource: variant.supplierSource || 'inherited'
    });
    setIsVariantModalOpen(true);
  };

  const handleSaveVariant = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('gsk_token');
      const url = editingVariant 
        ? `${import.meta.env.VITE_API_URL}/inventory/${id}/variants/${editingVariant}`
        : `${import.meta.env.VITE_API_URL}/inventory/${id}/variants`;
      const method = editingVariant ? 'PUT' : 'POST';

      const payload = {
        name: variantFormData.name,
        sku: variantFormData.sku,
        minStockLevel: Number(variantFormData.minStockLevel),
        unitPrice: Number(variantFormData.unitPrice),
        supplierSource: variantFormData.supplierSource,
        supplierId: variantFormData.supplierId
      };
      
      if (!editingVariant) {
          payload.quantity = Number(variantFormData.quantity);
          payload.parentId = variantFormData.parentId;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
          alert(data.error || 'Operation failed');
          return;
      }
      if (data.success) {
        fetchHierarchyData();
        resetVariantForm();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Failed to save variant:", error);
    }
  };

  const handleDeleteVariant = async (targetId) => {
    if (!window.confirm("Are you sure you want to deactivate this variant? This will deactivate all its sub-variants too.")) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory/${id}/variants/${targetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchHierarchyData();
      }
    } catch (error) {
      console.error("Failed to deactivate variant:", error);
    }
  };

  // STOCK ADJUSTMENT
  const handleAdjustStockClick = (targetId) => {
    setEditingVariant(targetId);
    setAdjustStockData({ adjustment: '', reason: '' });
    setIsAdjustStockModalOpen(true);
  };

  const handleAdjustStockSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory/${id}/variants/${editingVariant}/adjust-stock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adjustment: Number(adjustStockData.adjustment),
          reason: adjustStockData.reason
        })
      });
      const data = await response.json();
      if (!response.ok) {
          alert(data.error || 'Operation failed');
          return;
      }
      if (data.success) {
        fetchHierarchyData();
        setIsAdjustStockModalOpen(false);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Failed to adjust stock:", error);
      alert("Error adjusting stock.");
    }
  };

  // HISTORY
  const handleViewHistory = (targetId) => {
    setHistoryTarget(targetId);
    setTransactionPage(1);
    setIsHistoryModalOpen(true);
  };

  useEffect(() => {
    if (!isHistoryModalOpen || !historyTarget) return;
    const loadHistory = async () => {
      try {
        const token = localStorage.getItem('gsk_token');
        const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory/transactions?inventoryId=${id}&variantId=${historyTarget}&page=${transactionPage}&limit=50`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            setTransactions(data.data);
            setTransactionPages(data.pagination?.pages || 1);
        }
      } catch(err) {
          console.error("Failed to fetch history:", err);
      }
    };
    loadHistory();
  }, [historyTarget, isHistoryModalOpen, transactionPage, id]);

  const handleViewChild = (childId) => {
    if (currentDepth === 0) navigate(`/admin/inventory/${id}/variants/${childId}`);
    else if (currentDepth === 1) navigate(`/admin/inventory/${id}/variants/${variantId}/sub-variants/${childId}`);
    else if (currentDepth === 2) navigate(`/admin/inventory/${id}/variants/${variantId}/sub-variants/${subVariantId}/sub-sub-variants/${childId}`);
  };

  const getBackLink = () => {
    if (currentDepth === 3) return { url: `/admin/inventory/${id}/variants/${variantId}/sub-variants/${subVariantId}`, label: 'Back to Sub-Variant' };
    if (currentDepth === 2) return { url: `/admin/inventory/${id}/variants/${variantId}`, label: 'Back to Variant' };
    if (currentDepth === 1) return { url: `/admin/inventory/${id}`, label: 'Back to Product' };
    return { url: '/admin/inventory', label: 'Back to Inventory' };
  };

  const getChildTitle = () => {
    if (currentDepth === 0) return 'Variants';
    if (currentDepth === 1) return 'Sub-Variants';
    if (currentDepth === 2) return 'Sub-Sub-Variants';
    return '';
  };

  const getAddChildLabel = () => {
    if (currentDepth === 0) return 'Add Variant';
    if (currentDepth === 1) return 'Add Sub-Variant';
    if (currentDepth === 2) return 'Add Sub-Sub-Variant';
    return '';
  };

  if (loading && !parentData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50/50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !parentData) {
    return (
      <div className="p-4 md:p-8 animate-fade-in-up max-w-4xl mx-auto">
        <button onClick={() => navigate(getBackLink().url)} className="text-gray-500 hover:text-dark flex items-center gap-2 mb-8 transition-colors">
          <ArrowLeft size={16} /> {getBackLink().label}
        </button>
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-12 text-center">
          <AlertTriangle className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold text-dark mb-2">Node Not Found</h2>
          <p className="text-gray-500">{error || "The inventory node you are looking for does not exist or has an invalid relationship."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-fade-in-up max-w-7xl mx-auto">
      {/* Navigation */}
      <button onClick={() => navigate(getBackLink().url)} className="text-gray-500 hover:text-dark flex items-center gap-2 mb-6 transition-colors font-medium">
        <ArrowLeft size={16} /> {getBackLink().label}
      </button>

      {/* Header Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {currentDepth === 0 ? parentData.category || 'Product' : `Level ${currentDepth}`}
              </span>
              {parentData.supplierId && <span className="text-sm text-gray-500 flex items-center gap-2">Supplier: {parentData.supplierId.name || parentData.supplierId} </span>}
              {!parentData.supplierId && parentData.supplier && <span className="text-sm text-gray-500">Legacy Supplier: {parentData.supplier}</span>}
              
              {currentDepth > 0 && parentData.supplierSource && (
                 <span className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${parentData.supplierSource === 'inherited' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                    {parentData.supplierSource === 'inherited' ? <><ArrowDownToLine size={12}/> Inherited</> : <><ShieldCheck size={12}/> Custom</>}
                 </span>
              )}
            </div>
            
            <h1 className="text-3xl font-bold text-dark tracking-tight">{parentData.name}</h1>
            {currentDepth > 0 && <div className="text-sm text-gray-500 mt-1">SKU: {parentData.sku || 'No SKU'}</div>}
            
            <div className="flex items-center gap-6 mt-4">
              {currentDepth === 3 ? (
                <>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500 font-medium">Stock</span>
                    <span className="text-2xl font-bold text-dark flex items-center gap-2"><Package size={20} className="text-emerald-500"/> {parentData.quantity || 0}</span>
                  </div>
                  <div className="w-px h-10 bg-gray-200"></div>
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500 font-medium">Unit Price</span>
                    <span className="text-2xl font-bold text-dark">${(parentData.unitPrice || 0).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 font-medium">Direct Children</span>
                  <span className="text-2xl font-bold text-dark flex items-center gap-2"><Box size={20} className="text-indigo-500"/> {pagination.total}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex shrink-0 gap-3">
             {currentDepth === 3 && canAdjustStock && (
                 <button onClick={() => handleAdjustStockClick(parentData._id)} className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors shadow-sm w-full md:w-auto justify-center">
                   Adjust Stock
                 </button>
             )}
             {currentDepth === 3 && canView && (
                 <button onClick={() => handleViewHistory(parentData._id)} className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors shadow-sm w-full md:w-auto justify-center">
                   <History size={18}/> History
                 </button>
             )}
            {currentDepth < 3 && canEdit && (
              <button onClick={handleAddChildClick} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors shadow-sm shadow-red-200 w-full md:w-auto justify-center">
                <Plus size={18} /> {getAddChildLabel()}
              </button>
            )}
          </div>
        </div>
      </div>

      {currentDepth < 3 && (
        <>
          {/* Toolbar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <h2 className="text-lg font-bold text-dark">{getChildTitle()}</h2>
            <div className="flex flex-col md:flex-row gap-4 flex-1 justify-end w-full md:w-auto">
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search name, SKU..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-sm"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
                  {['All', 'In Stock', 'Low Stock', 'Out of Stock'].map(filter => (
                    <button 
                      key={filter}
                      onClick={() => setStockFilter(filter)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        stockFilter === filter 
                        ? 'bg-dark text-white shadow-sm' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
            </div>
          </div>

          {/* Child List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Unit Price</th>
                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {children.length === 0 ? (
                    <tr>
                        <td colSpan="5" className="py-8 text-center text-gray-500 text-sm">
                            {debouncedSearch ? "No matches found." : `No ${getChildTitle().toLowerCase()} found.`}
                        </td>
                    </tr>
                  ) : (
                    children.map(child => {
                      const isLowStock = child.quantity > 0 && child.quantity <= child.minStockLevel;
                      const isOutOfStock = child.quantity <= 0;
                      
                      return (
                        <tr key={child._id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-medium text-dark">{child.name}</div>
                            <div className="text-xs text-gray-500">{child.sku || '-'}</div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1 text-sm">
                                {child.supplierId?.name || child.supplierId || parentData.supplier}
                                {child.supplierSource === 'inherited' ? (
                                    <span className="inline-flex items-center gap-1 text-gray-400 text-xs" title="Inherited"><ArrowDownToLine size={10}/> Inherited</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-primary text-xs" title="Custom"><ShieldCheck size={10}/> Custom</span>
                                )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded text-sm font-bold ${
                              isOutOfStock ? 'bg-red-100 text-red-700' : 
                              isLowStock ? 'bg-amber-100 text-amber-700' : 
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {child.quantity}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right font-medium text-dark">${(child.unitPrice || 0).toFixed(2)}</td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {canView && <button onClick={() => handleViewChild(child._id)} className="text-xs font-semibold text-white bg-dark hover:bg-black px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                                <Eye size={14}/> View
                              </button>}
                              {canAdjustStock && <button onClick={() => handleAdjustStockClick(child._id)} className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors shadow-sm">
                                Adjust Stock
                              </button>}
                              {canEdit && <button onClick={() => handleEditVariantClick(child)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded transition-colors" title="Edit">
                                <Edit2 size={16} />
                              </button>}
                              {canDelete && <button onClick={() => handleDeleteVariant(child._id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors" title="Deactivate">
                                <Trash2 size={16} />
                              </button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <span className="text-sm text-gray-500">
                  Showing <span className="font-medium text-dark">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> to <span className="font-medium text-dark">{Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)}</span> of <span className="font-medium text-dark">{pagination.total}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm font-medium text-dark px-2">Page {currentPage} of {pagination.totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage === pagination.totalPages}
                    className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      {/* Variant Modal */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-dark">{editingVariant ? 'Edit Node' : `Add ${getAddChildLabel().replace('Add ', '')}`}</h2>
              <button onClick={resetVariantForm} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
                <ArrowLeft size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveVariant} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Settings</label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="supplierSource" value="inherited" checked={variantFormData.supplierSource === 'inherited'} onChange={(e) => setVariantFormData({...variantFormData, supplierSource: e.target.value})} className="text-primary focus:ring-primary"/>
                    <span className="text-sm font-medium">Use Parent Supplier</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="supplierSource" value="explicit" checked={variantFormData.supplierSource === 'explicit'} onChange={(e) => setVariantFormData({...variantFormData, supplierSource: e.target.value})} className="text-primary focus:ring-primary"/>
                    <span className="text-sm font-medium">Custom Supplier</span>
                  </label>
                </div>
                {variantFormData.supplierSource === 'explicit' && (
                   <EntityAutocomplete
                      label="Select Supplier"
                      placeholder="Search suppliers..."
                      value={variantFormData.supplierId ? { _id: variantFormData.supplierId, name: 'Selected Supplier' } : null}
                      fetchOptions={async (query) => {
                          const token = localStorage.getItem('gsk_token');
                          const res = await fetch(`${import.meta.env.VITE_API_URL}/suppliers?search=${encodeURIComponent(query)}&limit=10`, { headers: { 'Authorization': `Bearer ${token}` }});
                          const data = await res.json();
                          return data.success ? data.data : [];
                      }}
                      getOptionLabel={(s) => s.name}
                      getOptionValue={(s) => s._id}
                      onSelect={(s) => setVariantFormData({...variantFormData, supplierId: s ? s._id : ''})}
                   />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" name="name" required value={variantFormData.name} onChange={(e) => setVariantFormData({...variantFormData, name: e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" placeholder="e.g. Red, XL, V8" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" name="sku" value={variantFormData.sku} onChange={(e) => setVariantFormData({...variantFormData, sku: e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" placeholder="Optional unique code" />
                </div>
                {!editingVariant && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Quantity</label>
                    <input type="number" name="quantity" required min="0" value={variantFormData.quantity} onChange={(e) => setVariantFormData({...variantFormData, quantity: e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Selling Price ($) *</label>
                  <input type="number" name="unitPrice" required min="0" step="0.01" value={variantFormData.unitPrice} onChange={(e) => setVariantFormData({...variantFormData, unitPrice: e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level *</label>
                  <input type="number" name="minStockLevel" required min="0" value={variantFormData.minStockLevel} onChange={(e) => setVariantFormData({...variantFormData, minStockLevel: e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={resetVariantForm} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-sm shadow-red-200 transition-colors">Save Details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustStockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-dark">Adjust Stock</h2>
              <button onClick={() => setIsAdjustStockModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
            </div>
            <form onSubmit={handleAdjustStockSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Amount *</label>
                <p className="text-xs text-gray-500 mb-2">Use positive numbers to add stock, negative to reduce.</p>
                <input type="number" required value={adjustStockData.adjustment} onChange={(e) => setAdjustStockData({...adjustStockData, adjustment: e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" placeholder="e.g. 5 or -2" />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <input type="text" required value={adjustStockData.reason} onChange={(e) => setAdjustStockData({...adjustStockData, reason: e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" placeholder="e.g. Manual count correction" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsAdjustStockModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm shadow-blue-200 transition-colors">Confirm Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-dark">Stock History</h2>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 bg-gray-50/30">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 shadow-sm z-10">
                  <tr>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Adjustment</th>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason/Reference</th>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {transactions.length === 0 ? (
                    <tr><td colSpan="5" className="py-8 text-center text-gray-500">No transactions recorded.</td></tr>
                  ) : (
                    transactions.map(tx => (
                      <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-6 text-sm text-gray-600">{new Date(tx.date).toLocaleString()}</td>
                        <td className="py-3 px-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            tx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`py-3 px-6 text-right font-semibold text-sm ${tx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-700 max-w-xs truncate" title={tx.reason || tx.referenceNumber}>{tx.reason || tx.referenceNumber || '-'}</td>
                        <td className="py-3 px-6 text-sm text-gray-500 truncate max-w-[100px]" title={tx.userId?.name || 'System'}>{tx.userId?.name || 'System'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {transactionPages > 1 && (
              <div className="p-4 border-t border-gray-100 bg-white shrink-0 flex justify-between items-center">
                 <button onClick={() => setTransactionPage(p => Math.max(1, p-1))} disabled={transactionPage === 1} className="text-sm font-medium text-gray-600 disabled:opacity-50">Previous</button>
                 <span className="text-sm text-gray-500">Page {transactionPage} of {transactionPages}</span>
                 <button onClick={() => setTransactionPage(p => Math.min(transactionPages, p+1))} disabled={transactionPage === transactionPages} className="text-sm font-medium text-gray-600 disabled:opacity-50">Next</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryHierarchyDetail;
