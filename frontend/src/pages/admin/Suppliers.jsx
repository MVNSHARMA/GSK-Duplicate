import React, { useState, useEffect } from 'react';
import { 
  Building2, Search, Plus, Edit2, Trash2, X, Phone, Mail, MapPin, Briefcase 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasActionPermission } from '../../utils/pageAccess';

const Suppliers = () => {
  const { user } = useAuth();
  const canCreate = hasActionPermission(user, 'suppliers.create');
  const canEdit = hasActionPermission(user, 'suppliers.edit');
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '', contactPerson: '', email: '', phone: '', address: '', notes: '', isActive: true
  });

  const fetchSuppliers = async (signal) => {
    try {
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'All') params.append('status', statusFilter);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/suppliers?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to fetch suppliers:', error);
      }
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      fetchSuppliers(abortController.signal);
    }, 300);
    return () => {
      clearTimeout(timeout);
      abortController.abort();
    };
  }, [searchQuery, statusFilter]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contactPerson: supplier.contactPerson || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        notes: supplier.notes || '',
        isActive: supplier.isActive
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: '', contactPerson: '', email: '', phone: '', address: '', notes: '', isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const saveSupplier = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Supplier name is required');
      return;
    }
    
    try {
      const token = localStorage.getItem('gsk_token');
      const url = editingSupplier 
        ? `${import.meta.env.VITE_API_URL}/suppliers/${editingSupplier._id}`
        : `${import.meta.env.VITE_API_URL}/suppliers`;
        
      const response = await fetch(url, {
        method: editingSupplier ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        fetchSuppliers();
      } else {
        const err = await response.json();
        alert(err.message || 'Failed to save supplier');
      }
    } catch (error) {
      console.error(error);
      alert('Error saving supplier');
    }
  };

  const deactivateSupplier = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this supplier?')) return;
    
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/suppliers/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ isActive: false })
      });
      
      if (response.ok) {
        fetchSuppliers();
      }
    } catch (error) {
      console.error(error);
      alert('Error deactivating supplier');
    }
  };

  const activeCount = suppliers.filter(s => s.isActive).length;
  const inactiveCount = suppliers.length - activeCount;

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <Briefcase size={24} className="text-blue-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">Suppliers</h1>
            <p className="text-gray-500 text-sm">Manage vendor details and contact info for Purchase Orders.</p>
          </div>
        </div>
        {canCreate && <button
          onClick={() => openModal()}
          className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> Add Supplier
        </button>}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-blue-500/20 p-6 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-3xl font-bold font-heading mb-1 text-blue-500">{activeCount}</p>
            <p className="text-xs text-blue-500/70 font-medium uppercase tracking-wider">Active Suppliers</p>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-3xl font-bold font-heading mb-1 text-gray-400">{inactiveCount}</p>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Inactive Suppliers</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <input 
            type="text" 
            placeholder="Search suppliers by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {['All', 'Active', 'Inactive'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier Details</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact Info</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-gray-500 text-sm">
                    No suppliers found matching your criteria.
                  </td>
                </tr>
              ) : (
                suppliers.map(supplier => (
                  <tr key={supplier._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-dark">{supplier.name}</div>
                      {supplier.contactPerson && (
                        <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                          <Building2 size={14} /> {supplier.contactPerson}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        {supplier.phone && (
                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <Phone size={14} className="text-gray-400" /> {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <Mail size={14} className="text-gray-400" /> {supplier.email}
                          </div>
                        )}
                        {supplier.address && (
                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <MapPin size={14} className="text-gray-400" /> {supplier.address}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
                        supplier.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {canEdit && <button
                          onClick={() => openModal(supplier)}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          title="Edit Supplier"
                        >
                          <Edit2 size={18} />
                        </button>}
                        {supplier.isActive && (
                          canEdit && <button
                            onClick={() => deactivateSupplier(supplier._id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Deactivate Supplier"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#f8f9fa] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-2xl font-bold font-heading text-dark">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form id="supplierForm" onSubmit={saveSupplier} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Company Name *</label>
                  <input 
                    type="text" name="name" value={formData.name} onChange={handleInputChange} required
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none transition-colors"
                    placeholder="e.g. Repco, Bursons"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Contact Person</label>
                    <input 
                      type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone</label>
                    <input 
                      type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                  <input 
                    type="email" name="email" value={formData.email} onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Address</label>
                  <input 
                    type="text" name="address" value={formData.address} onChange={handleInputChange}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</label>
                  <textarea 
                    name="notes" value={formData.notes} onChange={handleInputChange} rows="3"
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none transition-colors resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <input 
                    type="checkbox" id="isActive" name="isActive" 
                    checked={formData.isActive} onChange={handleInputChange}
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="isActive" className="text-sm font-bold text-gray-700">Active Supplier</label>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-white flex justify-end gap-3 sticky bottom-0">
              <button 
                type="button" onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" form="supplierForm" 
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
              >
                {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
