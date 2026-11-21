import React, { forwardRef, useState, useEffect } from 'react';
import { OFFICIAL_BUSINESS_NAME, OFFICIAL_BUSINESS_ADDRESS, OFFICIAL_BUSINESS_PHONE, resolveBusinessAddress, resolveBusinessPhone } from '../../config/businessInfo';

const PrintableSale = forwardRef(({ dealerCar, settings }, ref) => {
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
    } else if (dealerCar) {
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
  }, [settings, dealerCar]);

  if (!dealerCar) return null;

  const vehicle = dealerCar.vehicleId || {};

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
          <h2 className="text-3xl font-bold text-gray-800 uppercase mb-2">BILL OF SALE</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p><span className="font-bold">Sale #:</span> {dealerCar._id.slice(-6).toUpperCase()}</p>
            <p><span className="font-bold">Date:</span> {new Date(dealerCar.updatedAt || dealerCar.createdAt).toLocaleDateString()}</p>
            <p><span className="font-bold">Status:</span> 
              <span className="ml-2 font-bold text-dark uppercase">{dealerCar.status}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-4 mb-8 text-center text-sm font-semibold border-y border-gray-300">
        This document constitutes a formal Bill of Sale and receipt for the transaction described below.
      </div>

      {/* Grid Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Buyer (Customer) Details</h3>
          <div className="text-sm text-gray-700 space-y-1.5">
            <p><span className="font-semibold text-gray-900 inline-block w-24">Name:</span> ___________________</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Phone:</span> ___________________</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">ID/License:</span> ___________________</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Address:</span> ___________________</p>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Seller Details</h3>
          <div className="text-sm text-gray-700 space-y-1.5">
            <p><span className="font-semibold text-gray-900 inline-block w-24">Name:</span> {localSettings.businessName}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Address:</span> {localSettings.businessAddress}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Phone:</span> {localSettings.businessPhone}</p>
          </div>
        </div>
      </div>

      {/* Vehicle/Item Sold */}
      <div className="mb-12">
        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Item(s) Sold</h3>
        <table className="w-full text-sm text-left border border-gray-300">
          <thead className="bg-gray-50 border-b border-gray-300">
            <tr>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-center">Qty</th>
              <th className="py-3 px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-300">
            <tr>
              <td className="py-3 px-4">
                {vehicle.brand} {vehicle.model} {vehicle.year}
                <div className="text-xs text-gray-500 mt-1">
                  Rego No: {vehicle.registrationNumber || 'N/A'} | VIN: {vehicle.vin || 'N/A'}
                </div>
              </td>
              <td className="py-3 px-4 text-center">1</td>
              <td className="py-3 px-4 text-right font-medium">${(dealerCar.soldFor || dealerCar.sellPrice || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment Summary */}
      <div className="flex justify-end mb-12">
        <div className="w-1/2">
          <table className="w-full text-sm text-left border border-gray-300">
            <tbody className="divide-y divide-gray-300">
              <tr>
                <td className="py-3 px-4 font-semibold bg-gray-50 w-1/2">Total Amount</td>
                <td className="py-3 px-4 text-right font-bold text-lg">${(dealerCar.soldFor || dealerCar.sellPrice || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* T&C */}
      <div className="mb-12">
        <h3 className="text-md font-bold text-gray-800 mb-2">Terms and Conditions</h3>
        <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
          <li>The vehicle/item is sold "AS IS", unless otherwise stated in a separate warranty document.</li>
          <li>The seller represents that the vehicle is free of all liens and encumbrances.</li>
          <li>All sales are final.</li>
        </ul>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-auto pt-8 border-t border-gray-300">
        <div>
          <p className="text-sm font-semibold mb-8">Seller Signature</p>
          <div className="border-b border-gray-400 w-full mb-2"></div>
          <p className="text-xs text-gray-500">{localSettings.businessName}</p>
        </div>
        <div>
          <p className="text-sm font-semibold mb-8">Buyer Signature</p>
          <div className="border-b border-gray-400 w-full mb-2"></div>
          <p className="text-xs text-gray-500">Customer</p>
        </div>
      </div>
    </div>
  );
});

export default PrintableSale;
