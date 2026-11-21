import React, { useState, useEffect } from 'react';
import { X, Mail, CheckCircle, Shield, Wrench, AlertCircle } from 'lucide-react';

const InviteEmployeeModal = ({ isOpen, onClose, onInvite, token }) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInviteEmail('');
      setInviteRole('admin');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invite');
      }

      const successMsg = data.message || 'Invitation sent successfully';
      setSuccess(successMsg);
      const isPartialSuccess = successMsg.includes('could not be sent') || successMsg.includes('email configuration');
      setTimeout(() => {
        onInvite();
        onClose();
      }, isPartialSuccess ? 4000 : 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full relative shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          disabled={loading && !success}
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shadow-inner">
            <Mail size={22} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-heading tracking-wide text-dark">Invite Employee</h2>
            <p className="text-sm text-gray-500">Send an invitation to join the dashboard.</p>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-4 rounded-xl mb-6 flex items-center gap-3 shadow-sm">
            <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1">Email Address</label>
            <input 
              type="email" 
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-dark outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-gray-400"
              placeholder="employee@gskautomotive.com"
              disabled={loading || success}
            />
          </div>
          
          <div className="mb-8">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">System Role</label>
            <div className="flex flex-col gap-3">
              
              {/* Super Admin Card */}
              <label className={`
                border-2 rounded-xl p-4 cursor-pointer transition-all flex items-start gap-4
                ${inviteRole === 'super_admin' ? 'border-purple-500 bg-purple-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}
              `}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${inviteRole === 'super_admin' ? 'border-purple-500' : 'border-gray-300'}`}>
                  {inviteRole === 'super_admin' && <div className="w-3 h-3 rounded-full bg-purple-500"></div>}
                </div>
                <input type="radio" name="role" value="super_admin" className="hidden" checked={inviteRole === 'super_admin'} onChange={() => setInviteRole('super_admin')} disabled={loading || success} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield size={16} className={inviteRole === 'super_admin' ? 'text-purple-500' : 'text-gray-400'} />
                    <span className={`text-sm font-bold uppercase tracking-wider ${inviteRole === 'super_admin' ? 'text-purple-700' : 'text-gray-700'}`}>Super Admin</span>
                  </div>
                  <p className="text-xs text-gray-500">Full unrestricted access to all pages and configurations, including employee management.</p>
                </div>
              </label>

              {/* Admin Card */}
              <label className={`
                border-2 rounded-xl p-4 cursor-pointer transition-all flex items-start gap-4
                ${inviteRole === 'admin' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}
              `}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${inviteRole === 'admin' ? 'border-blue-500' : 'border-gray-300'}`}>
                  {inviteRole === 'admin' && <div className="w-3 h-3 rounded-full bg-blue-500"></div>}
                </div>
                <input type="radio" name="role" value="admin" className="hidden" checked={inviteRole === 'admin'} onChange={() => setInviteRole('admin')} disabled={loading || success} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield size={16} className={inviteRole === 'admin' ? 'text-blue-500' : 'text-gray-400'} />
                    <span className={`text-sm font-bold uppercase tracking-wider ${inviteRole === 'admin' ? 'text-blue-700' : 'text-gray-700'}`}>Admin</span>
                  </div>
                  <p className="text-xs text-gray-500">Standard administrative access. Permissions must be explicitly granted per page.</p>
                </div>
              </label>

              {/* Mechanic Card */}
              <label className={`
                border-2 rounded-xl p-4 cursor-pointer transition-all flex items-start gap-4
                ${inviteRole === 'mechanic' ? 'border-orange-500 bg-orange-50/30' : 'border-gray-100 bg-white hover:border-gray-200'}
              `}>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${inviteRole === 'mechanic' ? 'border-orange-500' : 'border-gray-300'}`}>
                  {inviteRole === 'mechanic' && <div className="w-3 h-3 rounded-full bg-orange-500"></div>}
                </div>
                <input type="radio" name="role" value="mechanic" className="hidden" checked={inviteRole === 'mechanic'} onChange={() => setInviteRole('mechanic')} disabled={loading || success} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench size={16} className={inviteRole === 'mechanic' ? 'text-orange-500' : 'text-gray-400'} />
                    <span className={`text-sm font-bold uppercase tracking-wider ${inviteRole === 'mechanic' ? 'text-orange-700' : 'text-gray-700'}`}>Mechanic</span>
                  </div>
                  <p className="text-xs text-gray-500">Limited access intended for workshop staff. Inherently grants access to Job Cards.</p>
                </div>
              </label>
              
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || success}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
            >
              {loading ? 'Sending Invite...' : success ? 'Sent!' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteEmployeeModal;
