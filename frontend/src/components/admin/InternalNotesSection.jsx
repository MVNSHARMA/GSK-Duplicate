import React, { useState, useEffect } from 'react';
import { Save, User as UserIcon, Loader } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

const InternalNotesSection = ({ 
  recordId, 
  type, 
  initialNotes, 
  initialAssigneeId, 
  token, 
  onSave 
}) => {
  const [notes, setNotes] = useState(initialNotes || '');
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId || '');
  const [staff, setStaff] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    // Keep internal state synced if props change
    setNotes(initialNotes || '');
    setAssigneeId(initialAssigneeId || '');
  }, [initialNotes, initialAssigneeId]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch(`${API}/admins`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          // Combine admins, super admins, mechanics (if needed, but /admins might just return admins)
          setStaff(data.data || []);
        } else if (res.status === 403) {
            // fallback if no permission to view all admins
            setStaff([{ _id: initialAssigneeId, name: 'Current Assignee (Access Restricted)' }]);
        }
      } catch (err) {
        console.error('Failed to fetch staff:', err);
      }
    };
    fetchStaff();
  }, [token, initialAssigneeId]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch(`${API}/communications/${type}/${recordId}/meta`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          internalNotes: notes,
          assignedTo: assigneeId === '' ? null : assigneeId
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ text: 'Saved successfully.', type: 'success' });
        if (onSave) {
          onSave(data.data);
        }
      } else {
        setMessage({ text: data.error || 'Unable to save changes.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Unable to save changes.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mt-6 mb-6">
      <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">
        <UserIcon size={20} className="text-gray-500" />
        Internal Notes & Assignment
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assigned To
          </label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-gray-500 transition-colors"
          >
            <option value="">Unassigned</option>
            {staff.map(user => (
              <option key={user._id} value={user._id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Internal Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes here... (Not visible to customers)"
            rows={3}
            className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-gray-500 transition-colors resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm">
          {message.text && (
            <span className={message.type === 'success' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {message.text}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-dark text-white px-5 py-2 rounded-lg font-medium hover:bg-black transition-colors disabled:opacity-70"
        >
          {isSaving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default InternalNotesSection;
