import React from 'react';
import { X, Package } from 'lucide-react';

const AddVehicleModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  isSubmitting = false,
  editingVehicle, 
  customerType, 
  customerName, 
  customerId 
}) => {
  if (!isOpen) return null;

  const isImport = customerType === 'import_company' || customerType === 'import';
  const isRental = customerType === 'rental_company' || customerType === 'rental';

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    const fd = new FormData(e.target);
    const vehicleData = {
      customerId,
      brand: fd.get('brand')?.trim(),
      model: fd.get('model')?.trim(),
      year: parseInt(fd.get('year')),
      registrationNumber: fd.get('registrationNumber')?.trim().toUpperCase() || '',
      vin: fd.get('vin')?.trim().toUpperCase() || '',
      mileage: fd.get('mileage') ? Number(fd.get('mileage')) : undefined,
      dailyRate: fd.get('dailyRate') ? Number(fd.get('dailyRate')) : undefined
    };
    onSave(vehicleData, editingVehicle?._id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={!isSubmitting ? onClose : undefined}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">
            {editingVehicle ? 'Edit Registered Vehicle' : 'Add Registered Vehicle'}
          </h2>
          <button onClick={onClose} disabled={isSubmitting} className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50">
            <X size={20}/>
          </button>
        </div>
        
        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
          {!editingVehicle && customerName && (
            <div className="bg-orange-50 text-orange-800 px-4 py-3 rounded-lg text-sm border border-orange-100 mb-4 flex gap-3">
              <Package className="shrink-0 mt-0.5" size={16} />
              <p>This registers a canonical vehicle to <strong>{customerName}</strong>.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {isImport ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VIN No *</label>
                  <input required name="vin" type="text" defaultValue={editingVehicle?.vin} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase" placeholder="VIN..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rego No</label>
                  <input name="registrationNumber" type="text" defaultValue={editingVehicle?.registrationNumber} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase" placeholder="ABC123" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rego No *</label>
                  <input required name="registrationNumber" type="text" defaultValue={editingVehicle?.registrationNumber} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase" placeholder="ABC123" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">VIN (Optional)</label>
                  <input name="vin" type="text" defaultValue={editingVehicle?.vin} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase" placeholder="VIN..." />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Make *</label>
              <input required name="brand" type="text" defaultValue={editingVehicle?.brand} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="Toyota" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model *</label>
              <input required name="model" type="text" defaultValue={editingVehicle?.model} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="Camry" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Year *</label>
            <input required name="year" type="number" min="1900" max={new Date().getFullYear() + 1} defaultValue={editingVehicle?.year || new Date().getFullYear()} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
          </div>

          {isRental && (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Daily Rate ($)</label>
                <input name="dailyRate" type="number" step="0.01" min="0" defaultValue={editingVehicle?.dailyRate} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="e.g. 75.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mileage (km)</label>
                <input name="mileage" type="number" min="0" defaultValue={editingVehicle?.mileage} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" placeholder="e.g. 50000" />
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark font-medium transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                editingVehicle ? 'Update Vehicle' : 'Save Vehicle'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVehicleModal;
