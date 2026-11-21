import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, FileText } from 'lucide-react';
import UnifiedHistoryTimeline from '../../components/admin/UnifiedHistoryTimeline';

const CustomerServiceHistory = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('all');

  const fetchVehicles = useCallback(async () => {
    try {
      const token = localStorage.getItem('gsk_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL}/customer-portal/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setVehicles(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
            <History size={24} className="text-purple-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">Service History</h1>
            <p className="text-gray-500 text-sm">View comprehensive history of all your vehicles</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <label className="text-sm font-bold text-gray-700 whitespace-nowrap">Filter by Vehicle:</label>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="w-full sm:w-64 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:border-primary outline-none text-dark appearance-none cursor-pointer"
          >
            <option value="all">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v._id} value={v._id}>
                {v.registrationNumber} - {v.brand} {v.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm">
        {selectedVehicle === 'all' ? (
          <div className="text-center py-12 text-gray-500">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p>Please select a specific vehicle to view its detailed service history.</p>
          </div>
        ) : (
          <UnifiedHistoryTimeline entityId={selectedVehicle} entityType="vehicle" userRole="user" />
        )}
      </div>
    </div>
  );
};

export default CustomerServiceHistory;
