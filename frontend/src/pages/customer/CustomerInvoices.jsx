import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Search, Download, Filter, Eye } from 'lucide-react';

const CustomerInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const abortControllerRef = useRef(null);

  const fetchInvoices = useCallback(async () => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setError(null);
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/customer-portal/invoices?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data);
      } else {
        setError(data.error || 'Unable to load invoices.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Unable to load your invoices right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchInvoices]);

  const handleDownloadPdf = async (id, invoiceNumber) => {
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/customer-portal/invoices/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Failed to download invoice PDF.");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700';
      case 'Unpaid': return 'bg-red-100 text-red-700';
      case 'Partially Paid': return 'bg-amber-100 text-amber-700';
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Void': return 'bg-gray-100 text-gray-500 line-through';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
            <FileText size={24} className="text-red-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">Invoices</h1>
            <p className="text-gray-500 text-sm">View and download your invoices</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search by Invoice Number..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-sm focus:border-primary outline-none transition-colors shadow-sm"
          />
        </div>
        <div className="w-full md:w-64 relative">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-primary outline-none transition-colors text-dark appearance-none cursor-pointer shadow-sm"
          >
            <option value="">All Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Paid">Paid</option>
          </select>
          <Filter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading invoices...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <p className="text-red-700 font-medium text-sm">{error}</p>
          <button onClick={fetchInvoices} className="mt-4 text-sm text-red-600 underline hover:no-underline">Try Again</button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center shadow-sm">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-dark mb-2">No Invoices Found</h3>
          <p className="text-gray-500 text-sm">No invoices match your current search criteria.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice #</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Remaining</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-bold text-primary">{inv.invoiceNumber}</span>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {new Date(inv.date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 font-medium">
                      ${inv.totalAmount?.toFixed(2)}
                    </td>
                    <td className="py-4 px-6 font-bold text-dark">
                      ${inv.amountRemaining?.toFixed(2)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => handleDownloadPdf(inv._id, inv.invoiceNumber)}
                        className="text-gray-500 hover:text-primary transition-colors flex items-center justify-end gap-1 ml-auto text-xs font-bold"
                        title="Download PDF"
                      >
                        <Download size={16} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerInvoices;
