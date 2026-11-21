import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import PrintableInvoice from '../../components/admin/PrintableInvoice';
import { Printer, ArrowLeft } from 'lucide-react';

const InvoicePrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('gsk_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const [invoiceRes, settingsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/invoices/${id}`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/settings`, { headers })
        ]);
        
        const invoiceData = await invoiceRes.json();
        const settingsData = await settingsRes.json();
        
        if (invoiceData.success) {
          setInvoice(invoiceData.data);
        }
        if (settingsData.success) {
          setSettings(settingsData.data);
        }
      } catch (error) {
        console.error("Failed to fetch invoice:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // react-to-print v3 API — uses contentRef instead of content callback
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice_${invoice?.invoiceNo || id}`
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading Invoice...</div>;
  }

  if (!invoice) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">Invoice not found.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-10 print:bg-white print:py-0">
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button 
          onClick={() => navigate('/admin/invoices')}
          className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg shadow hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={18} /> Back to Invoices
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg shadow hover:bg-red-700 transition-colors"
        >
          <Printer size={18} /> Print Invoice
        </button>
      </div>
      
      <div className="max-w-4xl mx-auto bg-white shadow-xl print:shadow-none print:max-w-none">
        <PrintableInvoice ref={printRef} invoice={invoice} settings={settings} />
      </div>
    </div>
  );
};

export default InvoicePrint;
