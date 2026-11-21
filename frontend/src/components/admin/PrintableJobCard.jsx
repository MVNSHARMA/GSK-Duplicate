import React, { forwardRef, useState, useEffect } from 'react';
import { OFFICIAL_BUSINESS_NAME, OFFICIAL_BUSINESS_ADDRESS, OFFICIAL_BUSINESS_PHONE, resolveBusinessAddress, resolveBusinessPhone } from '../../config/businessInfo';

const PrintableJobCard = forwardRef(({ jobCard, settings }, ref) => {
  const [localSettings, setLocalSettings] = useState(settings || {
    businessName: OFFICIAL_BUSINESS_NAME,
    businessAddress: OFFICIAL_BUSINESS_ADDRESS,
    businessPhone: OFFICIAL_BUSINESS_PHONE,
    businessEmail: 'info@gskautomotive.com'
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        ...settings,
        businessAddress: resolveBusinessAddress(settings),
        businessPhone: resolveBusinessPhone(settings)
      });
    } else if (jobCard) {
      fetch(`${import.meta.env.VITE_API_URL}/settings`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setLocalSettings({
            ...data.data,
            businessAddress: resolveBusinessAddress(data.data),
            businessPhone: resolveBusinessPhone(data.data)
          });
        }
      })
      .catch(err => console.error(err));
    }
  }, [settings, jobCard]);

  if (!jobCard) return null;

  const customer = jobCard.customerId || {};
  const vehicle = jobCard.vehicleId || jobCard.trackerCarId || {};
  const isTrackerCar = !!jobCard.trackerCarId && !jobCard.vehicleId;

  return (
    <div ref={ref} className="p-10 bg-white text-black font-sans w-full min-h-[1056px] relative box-border">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-red-600 pb-6 mb-8">
        <div>
          <h1 className="text-4xl font-black text-red-600 tracking-tighter uppercase mb-2">
            {localSettings.businessName}
          </h1>
          <div className="text-sm text-gray-700 space-y-1">
            <p>{localSettings.businessAddress}</p>
            <p>Tel: {localSettings.businessPhone}</p>
            <p>Email: {localSettings.businessEmail}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold text-gray-800 uppercase mb-2">JOB CARD</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p><span className="font-bold">Job #:</span> {jobCard._id.slice(-6).toUpperCase()}</p>
            <p><span className="font-bold">Date In:</span> {new Date(jobCard.createdAt).toLocaleDateString()}</p>
            <p><span className="font-bold">Status:</span> 
              <span className="ml-2 font-bold text-dark uppercase">{jobCard.status}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Customer & Vehicle Info Grid */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Customer Details</h3>
          <div className="text-sm text-gray-700 space-y-1.5">
            <p><span className="font-semibold text-gray-900 inline-block w-24">Name:</span> {customer.name || 'N/A'}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Phone:</span> {customer.phone || 'N/A'}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Email:</span> {customer.email || 'N/A'}</p>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Vehicle Details</h3>
          <div className="text-sm text-gray-700 space-y-1.5">
            <p>
                <span className="font-semibold text-gray-900 inline-block w-24">Make/Model:</span> 
                {vehicle.brand || vehicle.make} {vehicle.model} {vehicle.year}
                {isTrackerCar && ' (Fleet Vehicle)'}
            </p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Rego No:</span> {vehicle.registrationNumber}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">VIN:</span> {vehicle.vin || 'N/A'}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Mileage:</span> {jobCard.mileage ? `${jobCard.mileage} km` : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Faults & Notes */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Reported Faults & Instructions</h3>
        <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 border border-gray-200 rounded min-h-[100px]">
          {jobCard.faults || 'No faults recorded.'}
        </div>
      </div>

      {/* Parts Checklist for Mechanic */}
      <div className="mb-12">
        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Parts Required / Assigned</h3>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-800 font-bold border-y border-gray-300">
            <tr>
              <th className="py-3 px-4 w-12 text-center">Qty</th>
              <th className="py-3 px-4">Part Name</th>
              <th className="py-3 px-4 w-24 text-center">Checked</th>
            </tr>
          </thead>
          <tbody className="border-b border-gray-300">
            {jobCard.partsUsed?.length > 0 ? (
              jobCard.partsUsed.map((item, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-center">{item.quantity}</td>
                  <td className="py-3 px-4">
                    {item.inventoryId?.itemName || 'Unknown Part'}
                    {item.variantName ? ` - ${item.variantName}` : ''}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="w-5 h-5 border-2 border-gray-400 rounded mx-auto"></div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="py-4 text-center text-gray-500 italic">No parts assigned.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mechanic Sign-off */}
      <div className="grid grid-cols-2 gap-8 mb-8 mt-12">
        <div>
          <h3 className="text-md font-bold text-gray-800 mb-8">Mechanic Notes:</h3>
          <div className="border-b border-gray-400 w-full mb-6"></div>
          <div className="border-b border-gray-400 w-full mb-6"></div>
          <div className="border-b border-gray-400 w-full"></div>
        </div>
        <div>
          <h3 className="text-md font-bold text-gray-800 mb-8">Sign-off:</h3>
          <div className="flex gap-4 mb-4">
            <span className="font-semibold text-sm w-20">Name:</span>
            <div className="border-b border-gray-400 flex-1"></div>
          </div>
          <div className="flex gap-4 mb-4">
            <span className="font-semibold text-sm w-20">Signature:</span>
            <div className="border-b border-gray-400 flex-1"></div>
          </div>
          <div className="flex gap-4">
            <span className="font-semibold text-sm w-20">Date:</span>
            <div className="border-b border-gray-400 flex-1"></div>
          </div>
        </div>
      </div>

    </div>
  );
});

export default PrintableJobCard;
