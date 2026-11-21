import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Edit2, Trash2, X, Search, Filter, 
  History, AlertTriangle, ChevronLeft, ChevronRight, Package, Box, CornerDownRight, ArrowDownToLine, ShieldCheck
} from 'lucide-react';
import EntityAutocomplete from '../../components/admin/EntityAutocomplete';
import { useAuth } from '../../context/AuthContext';
import { hasActionPermission } from '../../utils/pageAccess';

const VARIANTS_PER_PAGE = 15;

const InventoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const canEdit = hasActionPermission(user, 'inventory.edit');
  const canDelete = hasActionPermission(user, 'inventory.delete');
  const canAdjustStock = hasActionPermission(user, 'inventory.adjustStock');
  const canView = hasActionPermission(user, 'inventory.view');

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Variant Modal State
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantFormData, setVariantFormData] = useState({
    name: '', sku: '', quantity: '', unitPrice: '', minStockLevel: '',
    parentId: null, supplierId: '', supplierSource: 'inherited'
  });

  // Adjust Stock Modal State
  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [adjustStockData, setAdjustStockData] = useState({
    adjustment: '', reason: ''
  });
  
  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPages, setTransactionPages] = useState(1);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('All'); // 'All', 'In Stock', 'Low Stock', 'Out of Stock'
  const [currentPage, setCurrentPage] = useState(1);

  const fetchInventoryItem = async (signal) => {
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      const data = await response.json();
      
      if (response.status === 404 || !data.success) {
        setError(data.error || 'Inventory item not found');
        setItem(null);
      } else if (data.success) {
        setItem(data.data);
        setError(null);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch inventory item:", error);
        setError("Failed to fetch inventory item.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchInventoryItem(controller.signal);
    return () => controller.abort();
  }, [id]);

  // Reset pagination when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, stockFilter]);

  const handleVariantInputChange = (e) => setVariantFormData({ ...variantFormData, [e.target.name]: e.target.value });

  // VARIANT MANAGEMENT
  const resetVariantForm = () => {
    setIsVariantModalOpen(false);
    setEditingVariant(null);
    setVariantFormData({ name: '', sku: '', quantity: '', unitPrice: '', minStockLevel: '', parentId: null, supplierId: '', supplierSource: 'inherited' });
  };

  const handleAddVariantClick = (parentId = null) => {
    setEditingVariant(null);
    setVariantFormData({ name: '', sku: '', quantity: '', unitPrice: '', minStockLevel: '', parentId: parentId && typeof parentId === 'string' ? parentId : null, supplierId: '', supplierSource: 'inherited' });
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
      supplierId: variant.supplierId || '',
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
        fetchInventoryItem();
        resetVariantForm();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Failed to save variant:", error);
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm("Are you sure you want to deactivate this variant?")) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory/${id}/variants/${variantId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchInventoryItem();
      }
    } catch (error) {
      console.error("Failed to deactivate variant:", error);
    }
  };

  // STOCK ADJUSTMENT
  const handleAdjustStockClick = (variant) => {
    setEditingVariant(variant._id);
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
        fetchInventoryItem();
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
  const handleViewHistory = (variant) => {
    setHistoryTarget(variant._id);
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

  // Filtering
  const activeVariants = useMemo(() => item?.variants?.filter(v => v.isActive) || [], [item]);
  
  const buildVariantTree = (variants) => {
    const map = {};
    const roots = [];
    const vars = JSON.parse(JSON.stringify(variants));
    
    vars.forEach(v => {
      map[v._id] = { ...v, children: [] };
    });
    
    vars.forEach(v => {
      if (v.parentId && map[v.parentId]) {
        map[v.parentId].children.push(map[v._id]);
      } else {
        roots.push(map[v._id]);
      }
    });
    return roots;
  };

  const flattenVariantTree = (nodes) => {
    let result = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenVariantTree(node.children));
      }
    });
    return result;
  };
  
  const treeRoots = useMemo(() => buildVariantTree(activeVariants), [activeVariants]);
  const flattenedVariants = useMemo(() => flattenVariantTree(treeRoots), [treeRoots]);

  const filteredVariants = useMemo(() => {
    return flattenedVariants.filter(v => {
      // Search
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = 
        (v.name && v.name.toLowerCase().includes(searchLower)) ||
        (v.sku && v.sku.toLowerCase().includes(searchLower)) ||
        (item?.itemName && item.itemName.toLowerCase().includes(searchLower));

      if (!matchSearch) return false;

      // Stock Filter
      if (stockFilter === 'In Stock') return v.quantity > v.minStockLevel;
      if (stockFilter === 'Low Stock') return v.quantity > 0 && v.quantity <= v.minStockLevel;
      if (stockFilter === 'Out of Stock') return v.quantity <= 0;
      
      return true; // 'All'
    });
  }, [activeVariants, searchQuery, stockFilter, item]);

  // Pagination
  const totalPages = Math.ceil(filteredVariants.length / VARIANTS_PER_PAGE);
  const currentVariants = filteredVariants.slice((currentPage - 1) * VARIANTS_PER_PAGE, currentPage * VARIANTS_PER_PAGE);
  
  const totalStock = activeVariants.reduce((sum, v) => sum + (v.quantity || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50/50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="p-4 md:p-8 animate-fade-in-up max-w-4xl mx-auto">
        <button onClick={() => navigate('/admin/inventory')} className="text-gray-500 hover:text-dark flex items-center gap-2 mb-8 transition-colors">
          <ArrowLeft size={16} /> Back to Inventory
        </button>
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-12 text-center">
          <AlertTriangle className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold text-dark mb-2">Product Not Found</h2>
          <p className="text-gray-500">{error || "The inventory product you are looking for does not exist or has been deleted."}</p>
          <button onClick={() => navigate('/admin/inventory')} className="mt-6 bg-red-50 text-red-600 hover:bg-red-100 px-6 py-2 rounded-lg font-medium transition-colors">
            Return to Inventory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-fade-in-up max-w-7xl mx-auto">
      {/* Navigation */}
      <button onClick={() => navigate('/admin/inventory')} className="text-gray-500 hover:text-dark flex items-center gap-2 mb-6 transition-colors font-medium">
        <ArrowLeft size={16} /> Back to Inventory
      </button>

      {/* Header Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {item.category}
              </span>
              {item.supplierId && <span className="text-sm text-gray-500 flex items-center gap-2">Supplier: {item.supplierId.name} 
                <button onClick={() => {
                   const newId = prompt('Enter new Supplier ID to cascade (Feature preview - in production use EntityAutocomplete)');
                   if (newId) {
                      const token = localStorage.getItem('gsk_token');
                      fetch(`${import.meta.env.VITE_API_URL}/inventory/${id}`, {
                          method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ supplierId: newId })
                      }).then(() => fetchInventoryItem());
                   }
                }} className="text-primary hover:underline text-xs">Edit</button>
              </span>}
              {!item.supplierId && item.supplier && <span className="text-sm text-gray-500">Legacy Supplier: {item.supplier}</span>}
            </div>
            <h1 className="text-3xl font-bold text-dark tracking-tight">{item.itemName}</h1>
            
            <div className="flex items-center gap-6 mt-4">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">Active Variants</span>
                <span className="text-2xl font-bold text-dark flex items-center gap-2"><Box size={20} className="text-indigo-500"/> {activeVariants.length}</span>
              </div>
              <div className="w-px h-10 bg-gray-200"></div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">Total Stock</span>
                <span className="text-2xl font-bold text-dark flex items-center gap-2"><Package size={20} className="text-emerald-500"/> {totalStock}</span>
              </div>
            </div>
          </div>
          
          <div className="flex shrink-0">
            {canEdit && (
              <button onClick={handleAddVariantClick} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors shadow-sm shadow-red-200 w-full md:w-auto justify-center">
                <Plus size={18} /> Add Variant
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search variants, SKUs..." 
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

      {/* Variant List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Variant Hierarchy</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Min Stock</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Unit Price</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentVariants.map(variant => {
                const isLowStock = variant.quantity > 0 && variant.quantity <= variant.minStockLevel;
                const isOutOfStock = variant.quantity <= 0;
                
                return (
                  <tr key={variant._id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3" style={{ paddingLeft: `${((variant.level || 1) - 1) * 2}rem` }}>
                        {(variant.level || 1) > 1 && <CornerDownRight size={16} className="text-gray-300 flex-shrink-0" />}
                        <div className="flex-1">
                          <div className="font-medium text-dark">{variant.name}</div>
                          <div className="text-xs text-gray-500">{variant.sku || 'No SKU'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1 text-sm">
                         {variant.supplierSource === 'inherited' ? (
                             <span className="inline-flex items-center gap-1 text-gray-500" title="Inherits from parent or product">
                                 <ArrowDownToLine size={12}/> Inherited
                             </span>
                         ) : (
                             <span className="inline-flex items-center gap-1 text-primary" title="Explicitly overridden">
                                 <ShieldCheck size={12}/> Custom
                             </span>
                         )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded text-sm font-bold ${
                        isOutOfStock ? 'bg-red-100 text-red-700' : 
                        isLowStock ? 'bg-amber-100 text-amber-700' : 
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {variant.quantity}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center text-gray-500">{variant.minStockLevel}</td>
                    <td className="py-4 px-6 text-right font-medium text-dark">${(variant.unitPrice || 0).toFixed(2)}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {(variant.level || 1) < 3 && canEdit && (
                           <button onClick={() => handleAddVariantClick(variant._id)} className="p-1.5 text-gray-400 hover:text-primary transition-colors" title={`Add ${variant.level === 1 ? 'Sub-Variant' : 'Sub-Sub-Variant'}`}>
                               <Plus size={16} />
                           </button>
                        )}
                        {canView && <button onClick={() => handleViewHistory(variant)} className="text-xs font-medium text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded transition-colors flex items-center gap-1 shadow-sm">
                          <History size={14}/> History
                        </button>}
                        {canAdjustStock && <button onClick={() => handleAdjustStockClick(variant)} className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded transition-colors shadow-sm">
                          Adjust Stock
                        </button>}
                        {canEdit && <button onClick={() => handleEditVariantClick(variant)} className="p-1.5 text-gray-400 hover:text-indigo-500 rounded transition-colors" title="Edit Variant">
                          <Edit2 size={16} />
                        </button>}
                        {canDelete && <button onClick={() => handleDeleteVariant(variant._id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors" title="Deactivate">
                          <Trash2 size={16} />
                        </button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {currentVariants.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-16 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
                      <Box className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-dark mb-1">
                      {activeVariants.length === 0 ? "No variants found" : "No variants match your criteria"}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {activeVariants.length === 0 ? "This product doesn't have any variants yet." : "Try adjusting your search or stock filter."}
                    </p>
                    {activeVariants.length === 0 && canEdit && (
                       <button onClick={handleAddVariantClick} className="mt-4 text-red-500 font-medium hover:underline inline-flex items-center gap-1">
                         <Plus size={16}/> Add the first variant
                       </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 mb-8">
          <p className="text-xs text-gray-500 font-medium">
            Showing <span className="text-dark font-bold">{(currentPage - 1) * VARIANTS_PER_PAGE + 1}</span> to <span className="text-dark font-bold">{Math.min(currentPage * VARIANTS_PER_PAGE, filteredVariants.length)}</span> of <span className="text-dark font-bold">{filteredVariants.length}</span> variants
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold px-2">{currentPage} / {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      
      {/* Variant Modal */}
      {isVariantModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-dark">{editingVariant ? 'Edit Variant' : 'Add New Variant'}</h2>
              <button onClick={() => setIsVariantModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveVariant} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Variant Name *</label>
                  <input type="text" name="name" required value={variantFormData.name} onChange={handleVariantInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="e.g. Toyota Corolla / Ryco" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" name="sku" value={variantFormData.sku} onChange={handleVariantInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="e.g. RYCO-COR-001" />
                </div>
                {!editingVariant && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock *</label>
                    <input type="number" name="quantity" required min="0" value={variantFormData.quantity} onChange={handleVariantInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" />
                  </div>
                )}
                <div className={editingVariant ? 'col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level *</label>
                  <input type="number" name="minStockLevel" required min="0" value={variantFormData.minStockLevel} onChange={handleVariantInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($) *</label>
                  <input type="number" step="0.01" name="unitPrice" required min="0" value={variantFormData.unitPrice} onChange={handleVariantInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsVariantModalOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-red-200">
                  {editingVariant ? 'Save Variant' : 'Create Variant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustStockModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-dark">Adjust Stock</h2>
              <button onClick={() => setIsAdjustStockModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleAdjustStockSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Amount (e.g. 5, -2) *</label>
                  <input type="number" required value={adjustStockData.adjustment} onChange={e => setAdjustStockData({...adjustStockData, adjustment: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="+/- Qty" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <input type="text" required value={adjustStockData.reason} onChange={e => setAdjustStockData({...adjustStockData, reason: e.target.value})} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="e.g. Received new stock" />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAdjustStockModalOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-blue-200">
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h2 className="text-xl font-bold text-dark flex items-center gap-2"><History className="text-indigo-500"/> Stock History</h2>
              <button onClick={() => { setIsHistoryModalOpen(false); setHistoryTarget(null); }} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-0 overflow-y-auto bg-gray-50/30">
               {transactions.length === 0 ? (
                   <p className="text-center text-gray-500 py-10">No stock history available.</p>
               ) : (
                   <table className="w-full text-left text-sm">
                       <thead className="bg-gray-100/80 sticky top-0 border-b border-gray-200">
                           <tr>
                               <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                               <th className="px-4 py-3 font-semibold text-gray-600 text-center">Change</th>
                               <th className="px-4 py-3 font-semibold text-gray-600 text-center">Stock</th>
                               <th className="px-4 py-3 font-semibold text-gray-600">Reason / Job Card</th>
                               <th className="px-4 py-3 font-semibold text-gray-600">User</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                           {transactions.map(tx => (
                               <tr key={tx._id} className="hover:bg-white transition-colors">
                                   <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                   <td className="px-4 py-3 text-center">
                                       <span className={`font-bold ${tx.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                           {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                                       </span>
                                   </td>
                                   <td className="px-4 py-3 text-center text-gray-500 text-xs">
                                       {tx.previousQuantity} &rarr; <span className="font-bold text-dark">{tx.newQuantity}</span>
                                   </td>
                                   <td className="px-4 py-3">
                                       <div className="font-medium text-dark">{tx.reason}</div>
                                       {tx.jobCardId && <div className="text-xs text-blue-600">Job Card Reference</div>}
                                   </td>
                                   <td className="px-4 py-3 text-xs text-gray-500">
                                       {tx.performedBy?.name || 'Unknown'}
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               )}
            </div>
            {transactionPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>Page {transactionPage} of {transactionPages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={transactionPage <= 1} onClick={() => setTransactionPage((current) => current - 1)} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40">Previous</button>
                  <button type="button" disabled={transactionPage >= transactionPages} onClick={() => setTransactionPage((current) => current + 1)} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryDetail;
