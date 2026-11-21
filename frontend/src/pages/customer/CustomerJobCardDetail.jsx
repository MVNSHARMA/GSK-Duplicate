import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Clock, MessageSquare, CheckCircle, AlertTriangle, Wrench, Loader2 } from 'lucide-react';

const getStatusColor = (status) => {
  if (status === 'Completed') return 'bg-green-100 text-green-700';
  if (status === 'Cancelled') return 'bg-red-100 text-red-700';
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700';
  if (status === 'Waiting For Parts' || status === 'Waiting for Parts') return 'bg-orange-100 text-orange-700';
  if (status === 'Stuck') return 'bg-yellow-100 text-yellow-700';
  if (status?.includes('Waiting')) return 'bg-amber-100 text-amber-700';
  if (status?.includes('Delayed') || status?.includes('Attention')) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
};

const getProgressStep = (status) => {
  if (status === 'Open') return 1;
  if (status === 'In Progress') return 2;
  if (status === 'Waiting For Parts' || status === 'Waiting for Parts') return 2;
  if (status === 'Stuck') return 2;
  if (status === 'Completed') return 4;
  if (status === 'Cancelled') return 0;
  
  // Legacy backups
  if (status?.includes('Scheduled') || status?.includes('Awaiting Work')) return 1;
  if (status?.includes('Work In Progress')) return 2;
  if (status?.includes('Delayed') || status?.includes('Attention')) return 2;
  if (status?.includes('Awaiting Final Review') || status?.includes('Waiting for Review')) return 3;
  return 1;
};

const progressSteps = [
  { label: 'Received', step: 1, icon: ClipboardList },
  { label: 'In Service', step: 2, icon: Wrench },
  { label: 'Review', step: 3, icon: CheckCircle },
  { label: 'Complete', step: 4, icon: CheckCircle },
];

const CustomerJobCardDetail = () => {
  const { id } = useParams();
  const [jobCard, setJobCard] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const token = localStorage.getItem('gsk_token');
        const [jcRes, updatesRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/customer-portal/job-cards/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${import.meta.env.VITE_API_URL}/customer-portal/job-cards/${id}/service-updates`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const jcData = await jcRes.json();
        const updatesData = await updatesRes.json();

        if (jcData.success) {
          setJobCard(jcData.data);
        } else {
          setError(jcData.error || 'Unable to load service record.');
        }

        if (updatesData.success) {
          setUpdates(updatesData.data || []);
        }
      } catch (err) {
        setError('Unable to load service record right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1000px] mx-auto text-dark">
        <Link to="/customer/job-cards" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary mb-6">
          <ArrowLeft size={16} /> Back to Service Records
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertTriangle size={32} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!jobCard) return null;

  const currentStep = getProgressStep(jobCard.status);
  const isCancelled = jobCard.status?.includes('Cancelled');

  return (
    <div className="max-w-[1000px] mx-auto text-dark">
      <Link to="/customer/job-cards" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary mb-6">
        <ArrowLeft size={16} /> Back to Service Records
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl mb-1">{jobCard.jobNumber}</h1>
            <p className="text-sm text-gray-500">
              {jobCard.vehicleId?.registrationNumber && (
                <span className="font-medium text-gray-700">{jobCard.vehicleId.registrationNumber}</span>
              )}
              {jobCard.vehicleId?.brand && <span> — {jobCard.vehicleId.brand} {jobCard.vehicleId.model} {jobCard.vehicleId.year}</span>}
            </p>
          </div>
          <span className={`inline-block px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(jobCard.status)}`}>
            {jobCard.status}
          </span>
        </div>
      </div>

      {/* Progress Indicator */}
      {!isCancelled && (
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-6">Service Progress</h2>
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0" />
            <div
              className="absolute top-5 left-0 h-0.5 bg-green-500 z-0 transition-all duration-500"
              style={{ width: `${Math.max(0, ((currentStep - 1) / (progressSteps.length - 1)) * 100)}%` }}
            />

            {progressSteps.map(({ label, step, icon: Icon }) => {
              const isActive = step <= currentStep;
              const isCurrent = step === currentStep;
              return (
                <div key={step} className="flex flex-col items-center z-10 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isActive
                      ? isCurrent
                        ? 'bg-green-500 border-green-500 text-white ring-4 ring-green-100'
                        : 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <span className={`text-xs mt-2 font-medium ${isActive ? 'text-green-700' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Service Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-4">Service Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Date Received</span>
              <span className="font-medium">{jobCard.dateIn ? new Date(jobCard.dateIn).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }) : 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Expected Completion</span>
              <span className="font-medium">{jobCard.expectedCompletionDate ? new Date(jobCard.expectedCompletionDate).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' }) : 'N/A'}</span>
            </div>
            {jobCard.assignedMechanic && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Assigned Technician</span>
                <span className="font-medium">{jobCard.assignedMechanic.firstName} {jobCard.assignedMechanic.lastName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Services Ordered */}
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-sm uppercase tracking-wider text-gray-500 mb-4">Services Ordered</h2>
          {jobCard.servicesOrdered && jobCard.servicesOrdered.length > 0 ? (
            <ul className="space-y-2">
              {jobCard.servicesOrdered.map((svc, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  <Wrench size={14} className="text-amber-500 flex-shrink-0" />
                  <span>{svc}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 italic">No specific services recorded.</p>
          )}
        </div>
      </div>

      {/* Customer Service Updates */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-blue-500" />
          <h2 className="font-bold text-sm uppercase tracking-wider text-gray-500">Service Updates</h2>
        </div>

        {updates.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No service updates yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {updates.map(update => (
              <div key={update._id} className="border-l-4 border-blue-400 bg-blue-50/50 rounded-r-lg p-4">
                <p className="text-sm text-gray-800">{update.message}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <Clock size={12} />
                  <span>{new Date(update.createdAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</span>
                  <span>— {update.author || 'Staff'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerJobCardDetail;
