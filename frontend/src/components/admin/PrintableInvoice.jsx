import React, { forwardRef, useState, useEffect } from 'react';
import { resolveBusinessAddress, resolveBusinessPhone } from '../../config/businessInfo';

const PrintableInvoice = forwardRef(({ invoice, settings: propSettings }, ref) => {
  const [settings, setSettings] = useState(propSettings || null);

  useEffect(() => {
    if (propSettings) {
      setSettings(propSettings);
    } else if (invoice) {
      fetch(`${import.meta.env.VITE_API_URL}/settings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) setSettings(data.data);
      })
      .catch(err => console.error(err));
    }
  }, [propSettings, invoice]);

  if (!invoice) return null;

  const liveCustomer = (invoice.customerId && typeof invoice.customerId === 'object') ? invoice.customerId : {};
  const customer = (invoice.customerSnapshot && invoice.customerSnapshot.name && invoice.status !== 'Draft')
    ? { ...liveCustomer, ...invoice.customerSnapshot }
    : (Object.keys(liveCustomer).length > 0 ? liveCustomer : (invoice.customerSnapshot || {}));
  const liveVehicle = (invoice.vehicleId && typeof invoice.vehicleId === 'object')
    ? invoice.vehicleId
    : ((invoice.trackerCarId && typeof invoice.trackerCarId === 'object') ? invoice.trackerCarId : {});
  const vehicle = (invoice.vehicleSnapshot && invoice.vehicleSnapshot.registrationNumber && invoice.status !== 'Draft')
    ? { ...liveVehicle, ...invoice.vehicleSnapshot }
    : (Object.keys(liveVehicle).length > 0 ? liveVehicle : (invoice.vehicleSnapshot || {}));
  const isTrackerCar = !!invoice.trackerCarId && !invoice.vehicleId;

  const subtotal = invoice.subtotal !== undefined ? invoice.subtotal : (invoice.partsAndLabour?.reduce((sum, item) => sum + ((item.qty || 1) * (item.price || 0)), 0) || 0);
  const gstRate = invoice.gstRate !== undefined ? invoice.gstRate : (settings?.gstRate || 10);
  const gstAmount = invoice.gstAmount !== undefined ? invoice.gstAmount : ((subtotal * gstRate) / 100);
  const total = invoice.totalAmount !== undefined ? invoice.totalAmount : (subtotal + gstAmount);

  const businessName = settings?.businessName || 'GSK Automotive';
  const businessAddress = resolveBusinessAddress(settings);
  const businessPhone = resolveBusinessPhone(settings);
  const businessEmail = settings?.businessEmail || 'gsksevenhill@gmail.com';
  const logoUrl = settings?.logoUrl || '';

  // All styles are inline for reliable html2canvas capture
  const s = {
    page: {
      width: '210mm',
      minHeight: '297mm',
      padding: '15mm 18mm',
      backgroundColor: '#ffffff',
      color: '#1a1a1a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '13px',
      lineHeight: '1.5',
      boxSizing: 'border-box',
      position: 'relative',
    },
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: '3px solid #dc2626',
      paddingBottom: '16px',
      marginBottom: '0',
    },
    logo: {
      maxHeight: '70px',
      maxWidth: '200px',
      objectFit: 'contain',
    },
    businessInfo: {
      textAlign: 'right',
      fontSize: '11px',
      color: '#4a4a4a',
      lineHeight: '1.6',
    },
    businessName: {
      fontSize: '11px',
      fontWeight: '700',
      color: '#1a1a1a',
      marginBottom: '2px',
    },
    invoiceHeader: {
      backgroundColor: '#dc2626',
      color: '#ffffff',
      padding: '14px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
    },
    invoiceTitle: {
      fontSize: '20px',
      fontWeight: '800',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      margin: 0,
    },
    invoiceNo: {
      fontSize: '16px',
      fontWeight: '700',
      margin: 0,
    },
    metaRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '16px',
      fontSize: '13px',
    },
    sectionTitle: {
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: '0',
    },
    detailsGrid: {
      display: 'flex',
      gap: '16px',
      marginBottom: '16px',
    },
    detailsBox: {
      flex: 1,
      border: '1px solid #e5e5e5',
      overflow: 'hidden',
    },
    detailsContent: {
      padding: '12px 14px',
      fontSize: '12px',
      lineHeight: '1.8',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: '8px',
      fontSize: '12px',
    },
    th: {
      backgroundColor: '#f3f4f6',
      padding: '10px 12px',
      textAlign: 'left',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: '2px solid #d1d5db',
      color: '#374151',
    },
    td: {
      padding: '10px 12px',
      borderBottom: '1px solid #e5e7eb',
      verticalAlign: 'top',
    },
    totalsContainer: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: '16px',
    },
    totalsBox: {
      width: '250px',
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 12px',
      fontSize: '13px',
      borderBottom: '1px solid #e5e7eb',
    },
    totalDue: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '12px',
      fontSize: '16px',
      fontWeight: '800',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
    },
    recommendations: {
      backgroundColor: '#fff7ed',
      border: '1px solid #fdba74',
      padding: '14px',
      marginBottom: '16px',
      borderRadius: '4px',
    },
    recTitle: {
      fontSize: '12px',
      fontWeight: '700',
      textTransform: 'uppercase',
      color: '#c2410c',
      marginBottom: '8px',
      letterSpacing: '0.5px',
    },
    terms: {
      fontSize: '11px',
      color: '#6b7280',
      borderTop: '1px solid #e5e7eb',
      paddingTop: '12px',
      marginBottom: '12px',
      lineHeight: '1.6',
    },
    thankYou: {
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: '600',
      color: '#dc2626',
      padding: '16px 0',
      borderTop: '2px solid #dc2626',
      borderBottom: '2px solid #dc2626',
      marginBottom: '16px',
    },
    footer: {
      textAlign: 'center',
      fontSize: '10px',
      color: '#9ca3af',
      paddingTop: '12px',
      borderTop: '1px solid #e5e7eb',
      lineHeight: '1.8',
    },
  };

  return (
    <div ref={ref} style={s.page}>
      {/* === TOP HEADER === */}
      <div style={s.headerRow}>
        <div>
          <img src={logoUrl || "/Logo.png"} alt={businessName} style={s.logo} crossOrigin="anonymous" />
        </div>
        <div style={s.businessInfo}>
          <div style={s.businessName}>Baba Tarandas Pty Ltd</div>
          <div>T/A {businessName}</div>
          <div>ABN: 13 165 526 143</div>
          <div>ACN: 165 526 143</div>
          <div>MVRL: MVRL61927</div>
          <div>{businessAddress}</div>
          <div>{businessPhone} | 0410 433 851</div>
          <div>{businessEmail}</div>
        </div>
      </div>

      {/* === RED INVOICE HEADER === */}
      <div style={s.invoiceHeader}>
        <h2 style={s.invoiceTitle}>Service Invoice</h2>
        <p style={s.invoiceNo}>{invoice.invoiceNo}</p>
      </div>

      {/* === DATE / STATUS ROW === */}
      <div style={s.metaRow}>
        <div>
          <span style={{ fontWeight: '600', color: '#6b7280' }}>Date: </span>
          <span style={{ fontWeight: '700' }}>{new Date(invoice.createdAt).toLocaleDateString('en-AU')}</span>
        </div>
        <div>
          <span style={{ fontWeight: '600', color: '#6b7280' }}>Status: </span>
          <span style={{
            fontWeight: '800',
            color: invoice.status === 'Paid' ? '#16a34a' : '#dc2626',
            textTransform: 'uppercase',
          }}>
            {invoice.status}
          </span>
        </div>
      </div>

      {/* === CUSTOMER + VEHICLE DETAILS === */}
      <div style={s.detailsGrid}>
        <div style={s.detailsBox}>
          <div style={s.sectionTitle}>Customer Details</div>
          <div style={s.detailsContent}>
            <div><strong>{customer.name || 'N/A'}</strong></div>
            {customer.phone && <div>Phone: {customer.phone}</div>}
            {customer.email && <div>Email: {customer.email}</div>}
            {customer.address && <div>Address: {customer.address}</div>}
          </div>
        </div>

        <div style={s.detailsBox}>
          <div style={s.sectionTitle}>Vehicle Details</div>
          <div style={s.detailsContent}>
            {(vehicle.brand || vehicle.make || vehicle.model) ? (
              <>
                <div>
                  <strong>
                    {vehicle.brand || vehicle.make} {vehicle.model} {vehicle.year || ''}
                    {isTrackerCar && ' (Fleet Vehicle)'}
                  </strong>
                </div>
                {vehicle.registrationNumber && <div>Rego No: {vehicle.registrationNumber}</div>}
                {(vehicle.vin || vehicle.chassisNo) && <div>VIN: {vehicle.vin || vehicle.chassisNo}</div>}
                {vehicle.mileage && <div>Odometer: {vehicle.mileage?.toLocaleString()} km</div>}
                {vehicle.finalOdometer && <div>Final Odometer: {vehicle.finalOdometer?.toLocaleString()} km</div>}
              </>
            ) : (
              <div style={{ color: '#9ca3af' }}>No vehicle linked</div>
            )}
          </div>
        </div>
        <div style={s.detailsBox}>
          <div style={s.sectionTitle}>Job Details</div>
          <div style={s.detailsContent}>
            {invoice.jobCardId ? (
              <>
                <div><strong>Job Card:</strong> JC-{(invoice.jobCardId._id || invoice.jobCardId).toString().slice(-4).toUpperCase()}</div>
                <div><strong>Mechanic:</strong> {invoice.mechanic || 'N/A'}</div>
              </>
            ) : (
              <div style={{ color: '#9ca3af' }}>No Job Card</div>
            )}
          </div>
        </div>
      </div>

      {/* === SERVICE WORK COMPLETED === */}
      {(invoice.checklist?.length > 0 || invoice.notes) && (
        <div style={{ marginBottom: '16px' }}>
          <div style={s.sectionTitle}>Service Work Completed</div>
          <div style={{ padding: '12px 14px', border: '1px solid #e5e5e5', borderTop: 'none', fontSize: '12px', lineHeight: '1.8' }}>
            {invoice.checklist?.length > 0 && (
              <ul style={{ margin: '0 0 8px 0', paddingLeft: '18px' }}>
                {invoice.checklist.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
            {invoice.notes && <div>{invoice.notes}</div>}
          </div>
        </div>
      )}

      {/* === PARTS & LABOUR TABLE === */}
      <div style={{ marginBottom: '8px' }}>
        <div style={s.sectionTitle}>Parts, Labour & Service Charges</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Description</th>
              <th style={{ ...s.th, textAlign: 'center', width: '60px' }}>Qty</th>
              <th style={{ ...s.th, textAlign: 'right', width: '100px' }}>Unit Price</th>
              <th style={{ ...s.th, textAlign: 'right', width: '100px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.partsAndLabour && invoice.partsAndLabour.length > 0 ? (
              invoice.partsAndLabour.map((item, idx) => (
                <tr key={idx}>
                  <td style={s.td}>{item.description}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>${Number(item.price).toFixed(2)}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>${(item.qty * item.price).toFixed(2)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ ...s.td, textAlign: 'center', color: '#9ca3af' }}>No parts or labour listed.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* === TOTALS === */}
      <div style={s.totalsContainer}>
        <div style={s.totalsBox}>
          <div style={s.totalRow}>
            <span style={{ fontWeight: '600', color: '#6b7280' }}>Subtotal</span>
            <span style={{ fontFamily: 'monospace' }}>${subtotal.toFixed(2)}</span>
          </div>
          <div style={s.totalRow}>
            <span style={{ fontWeight: '600', color: '#6b7280' }}>GST ({gstRate}%)</span>
            <span style={{ fontFamily: 'monospace' }}>${gstAmount.toFixed(2)}</span>
          </div>
          <div style={s.totalDue}>
            <span>TOTAL DUE</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* === RECOMMENDATIONS === */}
      {invoice.recommendations && invoice.recommendations.length > 0 && (
        <div style={s.recommendations}>
          <div style={s.recTitle}>Recommendations</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', lineHeight: '1.8' }}>
            {invoice.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* === TERMS & CONDITIONS === */}
      <div style={s.terms}>
        <div style={{ fontWeight: '700', color: '#374151', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase' }}>Terms & Conditions</div>
        <div style={{ whiteSpace: 'pre-line' }}>{settings?.invoiceTerms || 'Payment is due within 7 days of invoice date.'}</div>
      </div>

      {/* === THANK YOU === */}
      <div style={s.thankYou}>
        Thank you for choosing {businessName}!
      </div>

      {/* === FOOTER === */}
      <div style={s.footer}>
        <div><strong>Baba Tarandas Pty Ltd</strong> | ABN: 13 165 526 143</div>
        <div>{businessAddress}</div>
        <div>Phone: {businessPhone} | Email: {businessEmail}</div>
      </div>
    </div>
  );
});

export default PrintableInvoice;
