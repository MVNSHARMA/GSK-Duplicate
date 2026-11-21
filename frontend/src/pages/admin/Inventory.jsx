import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Boxes, DollarSign, AlertTriangle, 
  Search, Filter, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, Eye, ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import { hasActionPermission } from '../../utils/pageAccess';
import { useToast } from '../../components/ui/ToastContext';
import { TableSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';

const ITEMS_PER_PAGE = 15;

const Inventory = () => {
  const { user } = useAuth();
  const { startTour } = useTour();
  const toast = useToast();
  const navigate = useNavigate();
  const canCreate = hasActionPermission(user, 'inventory.create');
  const canEdit = hasActionPermission(user, 'inventory.edit');
  const canDelete = hasActionPermission(user, 'inventory.delete');
  const canView = hasActionPermission(user, 'inventory.view');

  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState({
    totalParts: 0,
    totalUnits: 0,
    inventoryValue: 0,
    lowStockCount: 0
  });
  
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [itemFormData, setItemFormData] = useState({
    itemName: '', category: '', supplier: '', supplierId: ''
  });

  const fetchInventory = async (signal) => {
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      const data = await response.json();
      if (data.success) {
        setItems(data.data);
        setMetrics(data.metrics);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch inventory:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchInventory(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!canCreate && !canEdit) return;
    const token = localStorage.getItem('gsk_token');
    fetch(`${import.meta.env.VITE_API_URL}/suppliers?status=Active`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((response) => response.json())
      .then((data) => { if (Array.isArray(data)) setSuppliers(data); })
      .catch(() => setSuppliers([]));
  }, [canCreate, canEdit]);

  // Reset pagination when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const handleItemInputChange = (e) => setItemFormData({ ...itemFormData, [e.target.name]: e.target.value });

  // ITEM MANAGEMENT
  const resetItemForm = () => {
    setIsItemModalOpen(false);
    setEditingItem(null);
    setItemFormData({ itemName: '', category: '', supplier: '', supplierId: '' });
  };

  const handleEditItemClick = (item) => {
    setEditingItem(item._id);
    setItemFormData({
      itemName: item.itemName, category: item.category, 
      supplier: item.supplier || item.supplierId?.name || '',
      supplierId: item.supplierId?._id || item.supplierId || ''
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('gsk_token');
      const url = editingItem ? `${import.meta.env.VITE_API_URL}/inventory/${editingItem}` : `${import.meta.env.VITE_API_URL}/inventory`;
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(itemFormData)
      });
      const data = await response.json();
      
      if (data.success) {
        fetchInventory();
        resetItemForm();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Failed to save item:", error);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product? All variants will be permanently deleted.")) return;
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchInventory();
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  // FILTERING & SEARCH
  const categories = ['All Categories', ...new Set(items.map(i => i.category))];

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Category match
      const matchCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
      
      // Search match across parent and variants
      const searchLower = searchQuery.toLowerCase();
      const matchParent = item.itemName.toLowerCase().includes(searchLower) || 
                          (item.category && item.category.toLowerCase().includes(searchLower)) ||
                          (item.supplier && item.supplier.toLowerCase().includes(searchLower));
                          
      const matchVariants = item.variants && item.variants.some(v => 
          (v.name && v.name.toLowerCase().includes(searchLower)) ||
          (v.sku && v.sku.toLowerCase().includes(searchLower))
      );

      return matchCategory && (matchParent || matchVariants);
    });
  }, [items, selectedCategory, searchQuery]);

  // PAGINATION
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const currentData = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-dark tracking-tight">Inventory</h1>
              {user && (user.role === 'admin' || user.role === 'superadmin') && (
                <button
                  onClick={() => startTour('inventory')}
                  className="hidden md:flex items-center gap-1.5 text-xs font-bold bg-dark hover:bg-black text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                >
                  <Package size={14} /> Page Tour
                </button>
              )}
            </div>
          <p className="text-gray-500 mt-1">Manage products, variants, and stock levels</p>
        </div>
        <div className="flex gap-3">
          {canCreate && <button onClick={() => { resetItemForm(); setIsItemModalOpen(true); }} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors shadow-sm shadow-red-200">
            <Plus size={18} />
            <span className="hidden sm:inline">Add Product</span>
          </button>}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard icon={Package} title="Total Products" value={metrics.totalParts} color="blue" />
        <MetricCard icon={Boxes} title="Active Variants" value={items.reduce((acc, i) => acc + (i.variants?.filter(v=>v.isActive).length || 0), 0)} color="indigo" />
        <MetricCard icon={AlertTriangle} title="Low / Out of Stock" value={metrics.lowStockCount} color="amber" />
        <MetricCard icon={DollarSign} title="Inventory Value" value={`$${metrics.inventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} color="emerald" />
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search products, variants, SKUs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-sm"
          />
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-48">
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-2 focus:outline-none focus:border-red-500 transition-all text-sm text-dark cursor-pointer"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Variants</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Total Stock</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentData.map(item => {
                const activeVariants = item.variants?.filter(v => v.isActive) || [];
                const totalStock = item.totalStock ?? 0;
                
                return (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-semibold text-dark">{item.itemName}</div>
                      {item.supplier && <div className="text-xs text-gray-500 mt-1">Supplier: {item.supplier}</div>}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="text-sm text-gray-600 font-medium">{activeVariants.length} variants</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="text-sm font-bold text-dark">{totalStock}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {canView && (
                          <button 
                            onClick={() => navigate(`/admin/inventory/${item._id}`)} 
                            className="bg-white border border-gray-200 hover:border-primary hover:text-primary text-gray-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded transition-colors flex items-center gap-2"
                          >
                            <Eye size={14} /> View
                          </button>
                        )}
                        {canEdit && <button onClick={() => handleEditItemClick(item)} className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all" title="Edit Product">
                          <Edit2 size={16} />
                        </button>}
                        {canDelete && <button onClick={() => handleDeleteItem(item._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete Product">
                          <Trash2 size={16} />
                        </button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {currentData.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
                      <Package className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-dark mb-1">No products found</h3>
                    <p className="text-gray-500 text-sm">Try adjusting your search or filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-gray-500 font-medium">
            Showing <span className="text-dark font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-dark font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}</span> of <span className="text-dark font-bold">{filteredItems.length}</span> products
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold px-2">{currentPage} / {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-dark">{editingItem ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsItemModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveItem} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input type="text" name="itemName" required value={itemFormData.itemName} onChange={handleItemInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="e.g. Oil Filter" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <input type="text" name="category" required value={itemFormData.category} onChange={handleItemInputChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none" placeholder="e.g. Filters" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select name="supplierId" value={itemFormData.supplierId} onChange={(event) => {
                    const selected = suppliers.find((supplier) => supplier._id === event.target.value);
                    setItemFormData((current) => ({
                      ...current,
                      supplierId: event.target.value,
                      supplier: selected?.name || ''
                    }));
                  }} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none">
                    <option value="">No linked supplier</option>
                    {suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-red-200">
                  {editingItem ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

// Helper Component for Metrics
const MetricCard = ({ icon: Icon, title, value, color }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorMap[color]}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-dark mt-1">{value}</p>
      </div>
    </div>
  );
};

export default Inventory;
