import React from 'react';
import { X, Clock, User } from 'lucide-react';

const VehicleStatusHistoryModal = ({ isOpen, onClose, vehicleInfo, statusHistory }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Vehicle Status History</h2>
            {vehicleInfo && (
              <p className="text-sm font-medium text-slate-500 mt-1">
                {vehicleInfo.registrationNumber || vehicleInfo.vin || 'Vehicle'} - {vehicleInfo.brand} {vehicleInfo.model}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20}/>
          </button>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {(!statusHistory || statusHistory.length === 0) ? (
            <div className="text-center py-8 text-slate-500">
              <Clock size={32} className="mx-auto mb-3 opacity-20" />
              <p>No history records found.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
              {statusHistory.map((history, idx) => (
                <div key={idx} className="relative pl-6">
                  <div className="absolute w-4 h-4 bg-primary rounded-full -left-[9px] top-1 border-4 border-white shadow-sm"></div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-800 text-sm">{history.status}</span>
                      <span className="text-xs font-medium text-slate-500">
                        {new Date(history.timestamp).toLocaleString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {history.updatedBy && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-2">
                        <User size={12} />
                        {typeof history.updatedBy === 'object' ? history.updatedBy.name : 'System/Admin'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button onClick={onClose} className="px-5 py-2 rounded-xl text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 font-medium transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default VehicleStatusHistoryModal;
