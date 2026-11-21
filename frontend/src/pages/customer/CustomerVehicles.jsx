import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Car, Search, Eye, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

const CustomerVehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const abortControllerRef = useRef(null);

  const fetchVehicles = useCallback(async () => {
    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      setError(null);
      const token = localStorage.getItem('gsk_token');
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/customer-portal/vehicles?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: abortControllerRef.current.signal
      });
      const data = await res.json();
      if (data.success) {
        setVehicles(data.data);
      } else {
        setError(data.error || 'Unable to load vehicles.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Unable to load your vehicles right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVehicles();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchVehicles]);

  return (
    <div className="max-w-[1400px] mx-auto text-dark">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <Car size={24} className="text-blue-500" />
          </div>
          <div>
            <h1 className="font-heading text-3xl mb-1">My Vehicles</h1>
            <p className="text-gray-500 text-sm">View your registered fleet</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 relative w-full md:w-96">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input 
          type="text" 
          placeholder="Search by rego, make, model..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-lg pl-12 pr-4 py-3 text-sm focus:border-primary outline-none transition-colors shadow-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading vehicles...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <p className="text-red-700 font-medium text-sm">{error}</p>
          <button onClick={fetchVehicles} className="mt-4 text-sm text-red-600 underline hover:no-underline">Try Again</button>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center shadow-sm">
          <Car size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-dark mb-2">No Vehicles Found</h3>
          <p className="text-gray-500 text-sm">You have no vehicles registered or matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vehicles.map(vehicle => (
            <div key={vehicle._id} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <Link to={`/customer/service-history?vehicleId=${vehicle._id}`} className="text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 p-2 rounded-full inline-block" title="View Service History">
                  <Wrench size={18} />
                </Link>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Car size={24} className="text-gray-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-dark tracking-wide">{vehicle.registrationNumber}</h3>
                  <p className="text-sm text-gray-500">{vehicle.brand} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">VIN</p>
                  <p className="text-sm text-gray-700 font-medium truncate">{vehicle.vin || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Color</p>
                  <p className="text-sm text-gray-700 font-medium">{vehicle.color || 'N/A'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerVehicles;
