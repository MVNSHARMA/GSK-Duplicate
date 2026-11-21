import React, { useState, useEffect } from 'react';
import { Plus, FileText, Download, Trash2, Edit2, X, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasActionPermission } from '../../utils/pageAccess';
import { useToast } from '../ui/ToastContext';
import EmptyState from '../ui/EmptyState';

const VehicleDocumentation = ({ vehicleId }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '',
    documentType: 'Pink Slip',
    documentName: '',
    documentDate: '',
    expiryDate: '',
    notes: '',
    file: null
  });

  const { user } = useAuth();
  const toast = useToast();
  
  const canEdit = hasActionPermission(user, 'vehicles.edit');
  const canDelete = hasActionPermission(user, 'vehicles.delete');

  const API = import.meta.env.VITE_API_URL;
  const headers = { Authorization: `Bearer ${localStorage.getItem('gsk_token')}` };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/vehicles/${vehicleId}/documents`, { headers });
      const data = await res.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (err) {
      toast.error('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vehicleId) fetchDocuments();
  }, [vehicleId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, file: e.target.files[0] }));
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      documentType: 'Pink Slip',
      documentName: '',
      documentDate: '',
      expiryDate: '',
      notes: '',
      file: null
    });
    setIsEdit(false);
    setIsModalOpen(false);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (doc) => {
    setFormData({
      id: doc._id,
      documentType: doc.documentType,
      documentName: doc.documentName,
      documentDate: doc.documentDate ? new Date(doc.documentDate).toISOString().split('T')[0] : '',
      expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '',
      notes: doc.notes || '',
      file: null
    });
    setIsEdit(true);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.documentName) {
      toast.error('Document name is required');
      return;
    }
    
    try {
      if (isEdit) {
        const payload = {
          documentType: formData.documentType,
          documentName: formData.documentName,
          documentDate: formData.documentDate || null,
          expiryDate: formData.expiryDate || null,
          notes: formData.notes
        };
        const res = await fetch(`${API}/vehicles/documents/${formData.id}`, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Document updated');
          resetForm();
          fetchDocuments();
        } else {
          toast.error(data.error || 'Failed to update');
        }
      } else {
        if (!formData.file) {
          toast.error('File is required');
          return;
        }
        
        const form = new FormData();
        form.append('documentType', formData.documentType);
        form.append('documentName', formData.documentName);
        if (formData.documentDate) form.append('documentDate', formData.documentDate);
        if (formData.expiryDate) form.append('expiryDate', formData.expiryDate);
        if (formData.notes) form.append('notes', formData.notes);
        form.append('document', formData.file);

        const res = await fetch(`${API}/vehicles/${vehicleId}/documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('gsk_token')}` }, // Let browser set Content-Type
          body: form
        });
        const data = await res.json();
        if (data.success) {
          toast.success('Document uploaded');
          resetForm();
          fetchDocuments();
        } else {
          toast.error(data.error || 'Failed to upload');
        }
      }
    } catch (err) {
      toast.error('Network error while saving document');
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`${API}/vehicles/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('gsk_token')}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Document deleted');
        fetchDocuments();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const getStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Expired', color: 'bg-red-50 text-red-700 border-red-200' };
    if (diffDays <= 30) return { label: 'Expiring Soon', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Valid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-dark">Vehicle Documentation</h3>
        {canEdit && (
          <button 
            onClick={openAddModal}
            className="px-3 py-1.5 text-xs font-bold text-white bg-primary rounded hover:bg-primary-dark transition-colors flex items-center gap-1"
          >
            <Plus size={14} /> Add Document
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Loading documents...</div>
      ) : documents.length === 0 ? (
        <EmptyState 
          icon={FileText} 
          title="No Documents Found" 
          message="No documents have been added for this vehicle yet."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map(doc => {
            const status = getStatus(doc.expiryDate);
            return (
              <div key={doc._id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm flex flex-col hover:border-primary/30 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-dark text-sm">{doc.documentName}</h4>
                      <p className="text-xs text-gray-500">{doc.documentType}</p>
                    </div>
                  </div>
                  {status && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${status.color}`}>
                      {status.label}
                    </span>
                  )}
                </div>
                
                <div className="text-xs text-gray-500 space-y-1 mb-4 flex-1">
                  {doc.documentDate && <p>Document Date: {new Date(doc.documentDate).toLocaleDateString()}</p>}
                  {doc.expiryDate && <p>Expiry Date: {new Date(doc.expiryDate).toLocaleDateString()}</p>}
                  <p>Added: {new Date(doc.createdAt).toLocaleDateString()}</p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <a 
                    href={`${API}/vehicles/documents/${doc._id}/file?token=${localStorage.getItem('gsk_token')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                    title="View Document"
                  >
                    <FileText size={16} />
                  </a>
                  <a 
                    href={`${API}/vehicles/documents/${doc._id}/file?download=true&token=${localStorage.getItem('gsk_token')}`} 
                    download
                    className="p-1.5 text-gray-400 hover:text-dark transition-colors"
                    title="Download"
                  >
                    <Download size={16} />
                  </a>
                  {canEdit && (
                    <button 
                      onClick={() => openEditModal(doc)}
                      className="p-1.5 text-gray-400 hover:text-dark transition-colors"
                      title="Edit Metadata"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(doc._id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">{isEdit ? 'Edit Document' : 'Add Document'}</h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-dark transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Document Type *</label>
                <select 
                  name="documentType" 
                  value={formData.documentType} 
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                  required
                >
                  <option value="Pink Slip">Pink Slip</option>
                  <option value="Blue Slip">Blue Slip</option>
                  <option value="Compliance Certificate">Compliance Certificate</option>
                  <option value="Inspection Report">Inspection Report</option>
                  <option value="Arrival">Arrival</option>
                  <option value="Existing Damage">Existing Damage</option>
                  <option value="Completion">Completion</option>
                  <option value="Registration">Registration</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Service">Service</option>
                  <option value="Condition Report">Condition Report</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Document Name *</label>
                <input 
                  type="text" 
                  name="documentName" 
                  value={formData.documentName} 
                  onChange={handleInputChange}
                  placeholder={formData.documentType === 'Other' ? 'e.g., Insurance, Inspection Report' : formData.documentType}
                  className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>

              {!isEdit && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">File *</label>
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    required
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Accepted formats: PDF, JPG, PNG.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Document Date</label>
                  <input 
                    type="date" 
                    name="documentDate" 
                    value={formData.documentDate} 
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Expiry Date</label>
                  <input 
                    type="date" 
                    name="expiryDate" 
                    value={formData.expiryDate} 
                    onChange={handleInputChange}
                    className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Notes</label>
                <textarea 
                  name="notes" 
                  value={formData.notes} 
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm text-dark focus:ring-1 focus:ring-primary outline-none resize-none"
                ></textarea>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={resetForm} className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">
                  {isEdit ? 'Save Changes' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleDocumentation;
