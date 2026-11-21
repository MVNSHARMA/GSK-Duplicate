import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const CorrectStatusModal = ({ isOpen, onClose, car, onSave }) => {
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !car) return null;

  const isRental = car.batchId?.type === 'RENTAL';
  const isImport = car.batchId?.type === 'IMPORT';

  const validRentalStatuses = ['Expected', 'Received', 'Inspection', 'Waiting for Approval', 'In Service', 'Waiting for Parts', 'Ready for Collection'];
  const validImportStatuses = ['Expected', 'Received', 'Inspection', 'Waiting for Approval', 'In Service', 'Waiting for Parts', 'Compliance', 'Ready for Collection'];

  const statusOptions = isRental ? validRentalStatuses : (isImport ? validImportStatuses : []);
  const modalTitle = isRental ? 'Correct Collected Status' : 'Correct Delivered Status';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newStatus) {
      setError('Please select a new status.');
      return;
    }

    if (!reason.trim()) {
      setError('A reason is required to correct a terminal status.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(newStatus, reason.trim());
      setNewStatus('');
      setReason('');
      onClose();
    } catch (err) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-amber-800">Status Correction</h3>
              <p className="text-sm text-amber-700 mt-1">
                This car is currently marked as <span className="font-bold">{car.status}</span>. You can reopen it if the status was entered incorrectly.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Status
          </label>
          <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 font-medium">
            {car.status}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Status <span className="text-red-500">*</span>
          </label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            disabled={isSubmitting}
            required
          >
            <option value="">Select New Status</option>
            {statusOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none min-h-[100px] resize-y"
            placeholder="Enter reason for correction..."
            disabled={isSubmitting}
            required
          />
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!newStatus || !reason.trim()}
          >
            Correct Status
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CorrectStatusModal;
