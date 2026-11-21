import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';

const RegisteredVehiclePickerModal = ({ isOpen, onClose, onAddVehicles, customerId, existingVehicleIds }) => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !customerId) return;
        
        const fetchVehicles = async () => {
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('gsk_token');
                const API = import.meta.env.VITE_API_URL;
                // Use existing vehicles endpoint with customerId filter
                const res = await fetch(`${API}/vehicles?customerId=${customerId}&limit=500`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) {
                    setVehicles(data.data);
                } else {
                    setError(data.error || 'Failed to load registered vehicles');
                }
            } catch (err) {
                setError(err.message || 'Error fetching vehicles');
            } finally {
                setLoading(false);
            }
        };

        fetchVehicles();
        setSelectedIds([]);
        setSearchQuery('');
    }, [isOpen, customerId]);

    if (!isOpen) return null;

    const availableVehicles = vehicles.filter(v => !existingVehicleIds.includes(v._id));
    
    const filteredVehicles = availableVehicles.filter(v => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (v.vin || '').toLowerCase().includes(q) ||
            (v.registrationNumber || '').toLowerCase().includes(q) ||
            (v.brand || '').toLowerCase().includes(q) ||
            (v.model || '').toLowerCase().includes(q)
        );
    });

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleConfirm = () => {
        if (selectedIds.length === 0) return;
        onAddVehicles(selectedIds);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Add Registered Vehicles</h2>
                        <p className="text-xs text-slate-500">Select vehicles to add to this entry</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
                </div>
                
                <div className="p-4 border-b border-slate-100 shrink-0">
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by VIN, Rego, Make or Model..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary focus:bg-white transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading registered vehicles...</div>
                    ) : error ? (
                        <div className="p-8 text-center text-red-500">{error}</div>
                    ) : availableVehicles.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                            No available registered vehicles found for this company.
                        </div>
                    ) : filteredVehicles.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                            No vehicles match your search.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredVehicles.map(vehicle => {
                                const isSelected = selectedIds.includes(vehicle._id);
                                return (
                                    <div 
                                        key={vehicle._id}
                                        onClick={() => toggleSelect(vehicle._id)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-blue-50 border-blue-400 shadow-[0_0_0_1px_rgba(96,165,250,1)]' 
                                                : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-md'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="pt-1">
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                    {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-800 truncate mb-1">
                                                    {vehicle.year} {vehicle.brand} {vehicle.model}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">VIN</span>
                                                        <span className="text-sm font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate">{vehicle.vin || 'NO VIN'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-8">REGO</span>
                                                        <span className="text-sm font-medium text-slate-600">{vehicle.registrationNumber || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-white flex items-center justify-between shrink-0">
                    <div className="text-sm font-medium text-slate-600">
                        {selectedIds.length} vehicle{selectedIds.length !== 1 ? 's' : ''} selected
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirm}
                            disabled={selectedIds.length === 0}
                            className={`px-6 py-2 rounded-xl font-bold transition-all ${
                                selectedIds.length > 0 
                                    ? 'bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg' 
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            Add to Entry
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisteredVehiclePickerModal;
