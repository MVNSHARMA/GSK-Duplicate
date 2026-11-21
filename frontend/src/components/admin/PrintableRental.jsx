import React, { forwardRef, useState, useEffect } from 'react';
import { OFFICIAL_BUSINESS_NAME, OFFICIAL_BUSINESS_ADDRESS, OFFICIAL_BUSINESS_PHONE, resolveBusinessAddress, resolveBusinessPhone } from '../../config/businessInfo';

const PrintableRental = forwardRef(({ rental, settings }, ref) => {
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
    } else if (rental) {
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
  }, [settings, rental]);

  if (!rental) return null;

  const customer = rental.customerId || {};
  const vehicle = rental.vehicleId || {};
  
  const startDate = new Date(rental.startDate).toLocaleDateString();
  const endDate = new Date(rental.endDate).toLocaleDateString();

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
          <h2 className="text-3xl font-bold text-gray-800 uppercase mb-2">RENTAL AGREEMENT</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p><span className="font-bold">Agreement #:</span> {rental._id.slice(-6).toUpperCase()}</p>
            <p><span className="font-bold">Date Issued:</span> {new Date(rental.createdAt).toLocaleDateString()}</p>
            <p><span className="font-bold">Status:</span> 
              <span className="ml-2 font-bold text-dark uppercase">{rental.status}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-4 mb-8 text-center text-sm font-semibold border-y border-gray-300">
        This document serves as a binding rental agreement between {localSettings.businessName} and the Customer.
      </div>

      {/* Grid Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Renter Details</h3>
          <div className="text-sm text-gray-700 space-y-1.5">
            <p><span className="font-semibold text-gray-900 inline-block w-24">Name:</span> {customer.name || 'N/A'}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Phone:</span> {customer.phone || 'N/A'}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">ID/License:</span> {customer.idNumber || 'N/A'}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Address:</span> {customer.address || 'N/A'}</p>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Vehicle Details</h3>
          <div className="text-sm text-gray-700 space-y-1.5">
            <p><span className="font-semibold text-gray-900 inline-block w-24">Make/Model:</span> {vehicle.brand} {vehicle.model} {vehicle.year}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">Rego No:</span> {vehicle.registrationNumber}</p>
            <p><span className="font-semibold text-gray-900 inline-block w-24">VIN:</span> {vehicle.vin || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Rental Terms & Cost */}
      <div className="mb-12">
        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-3">Rental Terms</h3>
        <table className="w-full text-sm text-left border border-gray-300">
          <tbody className="divide-y divide-gray-300">
            <tr>
              <td className="py-3 px-4 font-semibold bg-gray-50 w-1/3">Rental Start Date</td>
              <td className="py-3 px-4">{startDate}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold bg-gray-50">Rental End Date</td>
              <td className="py-3 px-4">{endDate}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold bg-gray-50">Total Amount</td>
              <td className="py-3 px-4 font-bold">${(rental.totalAmount || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold bg-gray-50">Amount Paid</td>
              <td className="py-3 px-4 text-green-600 font-bold">${(rental.amountPaid || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold bg-gray-50">Balance Due</td>
              <td className="py-3 px-4 text-red-600 font-bold">${((rental.totalAmount || 0) - (rental.amountPaid || 0)).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* T&C */}
      <div className="mb-12">
        <h3 className="text-md font-bold text-gray-800 mb-2">Terms and Conditions</h3>
        <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
          <li>The renter agrees to return the vehicle in the same condition as it was rented.</li>
          <li>The renter is responsible for any traffic fines or tolls incurred during the rental period.</li>
          <li>In the event of an accident, the renter must notify {localSettings.businessName} immediately.</li>
          <li>Late returns will be subject to additional daily charges.</li>
        </ul>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-auto pt-8 border-t border-gray-300">
        <div>
          <p className="text-sm font-semibold mb-8">Authorized Representative</p>
          <div className="border-b border-gray-400 w-full mb-2"></div>
          <p className="text-xs text-gray-500">{localSettings.businessName}</p>
        </div>
        <div>
          <p className="text-sm font-semibold mb-8">Customer Signature</p>
          <div className="border-b border-gray-400 w-full mb-2"></div>
          <p className="text-xs text-gray-500">{customer.name || 'Customer'}</p>
        </div>
      </div>
    </div>
  );
});

export default PrintableRental;
