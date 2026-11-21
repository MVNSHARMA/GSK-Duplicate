import React, { useState, useEffect } from 'react';
import { X, Clock, User, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '../ui/ToastContext';

const JobCardHistoryModal = ({ jobCardId, isOpen, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen || !jobCardId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('gsk_token');
        const res = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${jobCardId}/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.success) {
          // Filter out UPDATE_JOB_CARD actions that don't have a status change
          const statusChanges = data.data.filter(log => log.action === 'CREATE_JOB_CARD' || (log.action === 'UPDATE_JOB_CARD' && log.metadata?.status));
          setHistory(statusChanges);
        } else {
          toast.error(data.error || 'Failed to fetch history');
        }
      } catch (err) {
        toast.error('Network error');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [jobCardId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock size={20} className="text-blue-500" />
              Status Timeline
            </h2>
            <p className="text-xs text-gray-500 mt-1">Job Card #{jobCardId.slice(-4).toUpperCase()}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-sm text-gray-500">Loading timeline...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <AlertCircle size={24} className="text-gray-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">No History Found</h3>
              <p className="text-xs text-gray-500">There are no status changes recorded for this Job Card yet.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-100 ml-4 space-y-8">
              {history.map((log, index) => {
                const date = new Date(log.createdAt);
                const formatter = new Intl.DateTimeFormat('en-AU', {
                  timeZone: 'Australia/Sydney',
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true
                });
                const formattedDate = formatter.format(date);
                
                const isCreation = log.action === 'CREATE_JOB_CARD';
                const status = isCreation ? 'Created' : log.metadata?.status;

                return (
                  <div key={log._id} className="relative pl-6">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${index === 0 ? 'bg-blue-500 ring-4 ring-blue-50' : 'bg-gray-300'}`}></div>
                    
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${isCreation ? 'text-gray-700' : 'text-blue-700'}`}>
                          {status}
                        </span>
                        <span className="text-xs font-medium text-gray-400 font-mono">
                          {formattedDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <User size={12} />
                        <span>{log.actor?.name || 'Unknown User'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobCardHistoryModal;
