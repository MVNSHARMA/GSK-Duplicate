import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar as CalendarIcon, Clock, Edit, Save, X, Plus } from 'lucide-react';

const BookingSlots = () => {
    const { token } = useAuth();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(false);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const formattedDate = `${dayNames[selectedDate.getDay()]}, ${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

    const fetchSlots = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/slots?date=${encodeURIComponent(formattedDate)}&includePast=true`);
            const data = await res.json();
            if (data.success) {
                setSlots(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch slots:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSlots();
    }, [formattedDate]);

    const changeDate = (days) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const [editingSlot, setEditingSlot] = useState(null);
    const [editForm, setEditForm] = useState({ capacity: 3, isDisabled: false });
    
    const [isAdding, setIsAdding] = useState(false);
    const [newSlotTime, setNewSlotTime] = useState('10:00 AM');
    
    const handleSave = async (time, capacity, isDisabled) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/slots`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ date: formattedDate, time, capacity, isDisabled })
            });
            const data = await res.json();
            if (data.success) {
                fetchSlots();
                setEditingSlot(null);
                setIsAdding(false);
            } else {
                alert(data.message || 'Failed to update slot');
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred');
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-dark flex items-center gap-2">
                    <CalendarIcon className="text-primary" /> Booking Slots Management
                </h1>
            </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                        <button onClick={() => changeDate(-1)} className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded hover:bg-gray-50 font-bold text-sm text-gray-600">&larr; Previous Day</button>
                        <h2 className="text-xl font-bold text-dark text-center">{formattedDate}</h2>
                        <button onClick={() => changeDate(1)} className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded hover:bg-gray-50 font-bold text-sm text-gray-600">Next Day &rarr;</button>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Loading slots...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase">Time</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase">Bookings</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase">Capacity</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase">Remaining</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                                        <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {slots.map((slot, index) => (
                                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-sm font-bold text-dark flex items-center gap-2"><Clock size={14} className="text-gray-400" /> {slot.time}</td>
                                            <td className="py-3 px-4 text-sm text-gray-600">{slot.booked}</td>
                                            <td className="py-3 px-4 text-sm text-gray-600">
                                                {editingSlot === slot.time ? (
                                                    <input 
                                                        type="number" 
                                                        min="1"
                                                        value={editForm.capacity}
                                                        onChange={(e) => setEditForm({...editForm, capacity: parseInt(e.target.value)})}
                                                        className="border border-gray-300 rounded px-2 py-1 w-20 text-sm"
                                                    />
                                                ) : (
                                                    slot.capacity
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm font-bold text-primary">{slot.remaining}</td>
                                            <td className="py-3 px-4 text-sm">
                                                {editingSlot === slot.time ? (
                                                    <select 
                                                        value={editForm.isDisabled ? 'disabled' : 'enabled'}
                                                        onChange={(e) => setEditForm({...editForm, isDisabled: e.target.value === 'disabled'})}
                                                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                                                    >
                                                        <option value="enabled">Available / Normal</option>
                                                        <option value="disabled">Disabled</option>
                                                    </select>
                                                ) : (
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                        slot.status === 'Available' ? 'bg-green-100 text-green-700' : 
                                                        slot.status === 'Disabled' ? 'bg-red-100 text-red-700' :
                                                        slot.status === 'Past' ? 'bg-gray-100 text-gray-500' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {slot.status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {editingSlot === slot.time ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleSave(slot.time, editForm.capacity, editForm.isDisabled)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                                            <Save size={16} />
                                                        </button>
                                                        <button onClick={() => setEditingSlot(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => {
                                                        setEditingSlot(slot.time);
                                                        setEditForm({ capacity: slot.capacity, isDisabled: slot.isDisabled });
                                                    }} className="text-gray-400 hover:text-primary transition-colors">
                                                        <Edit size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}

                                    {isAdding && (
                                        <tr className="border-b border-gray-100 bg-red-50/30">
                                            <td className="py-3 px-4">
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. 10:00 AM"
                                                    value={newSlotTime}
                                                    onChange={(e) => setNewSlotTime(e.target.value)}
                                                    className="border border-gray-300 rounded px-2 py-1 w-24 text-sm"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600">0</td>
                                            <td className="py-3 px-4 text-sm text-gray-600">
                                                <input 
                                                    type="number" 
                                                    min="1"
                                                    value={editForm.capacity}
                                                    onChange={(e) => setEditForm({...editForm, capacity: parseInt(e.target.value)})}
                                                    className="border border-gray-300 rounded px-2 py-1 w-20 text-sm"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600">-</td>
                                            <td className="py-3 px-4 text-sm">
                                                <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">New</span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleSave(newSlotTime, editForm.capacity, false)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                                        <Save size={16} />
                                                    </button>
                                                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:bg-gray-100 p-1 rounded">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            
                            {!isAdding && (
                                <button 
                                    onClick={() => {
                                        setIsAdding(true);
                                        setEditForm({ capacity: 3, isDisabled: false });
                                    }} 
                                    className="mt-4 flex items-center gap-2 text-primary font-bold text-sm hover:underline px-4"
                                >
                                    <Plus size={16} /> Add Custom Time Slot
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
    );
};

export default BookingSlots;
