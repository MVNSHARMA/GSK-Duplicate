import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import PageWrapper from '../components/PageWrapper';
import { Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';

const ResetPassword = () => {
  const { resettoken } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [status, setStatus] = useState({ loading: false, success: false, message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: false, message: '' });

    if (formData.password !== formData.confirmPassword) {
      setStatus({ loading: false, success: false, message: "Passwords do not match." });
      return;
    }

    if (formData.password.length < 6) {
      setStatus({ loading: false, success: false, message: "Password must be at least 6 characters." });
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/resetpassword/${resettoken}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: formData.password })
      });

      const data = await response.json();
      
      if (data.success) {
        setStatus({ loading: false, success: true, message: 'Password has been reset successfully!' });
        // Optionally save the new token if we want to log them in directly
        localStorage.setItem('gsk_token', data.token);
        localStorage.setItem('gsk_user', JSON.stringify(data.user));
        
        setTimeout(() => {
          navigate(data.user.role === 'user' ? '/' : '/admin');
        }, 2000);
      } else {
        setStatus({ loading: false, success: false, message: data.error || 'Failed to reset password. The link may have expired.' });
      }
    } catch (error) {
      setStatus({ loading: false, success: false, message: 'Server error. Please try again later.' });
    }
  };

  return (
    <PageWrapper className="bg-lightBg min-h-screen pt-24 pb-20 flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-gray-100">
          
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl mb-2 text-dark">Set New Password</h1>
            <p className="text-gray-500 text-sm">Please enter your new password below.</p>
          </div>

          {status.message && (
            <div className={`p-4 rounded-lg mb-6 text-sm font-bold flex items-center gap-2 ${status.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {status.success && <CheckCircle2 size={18} />}
              {status.message}
            </div>
          )}

          {!status.success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={18} className="text-gray-400" />
                  </div>
                  <input 
                    type="password" 
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Confirm New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={18} className="text-gray-400" />
                  </div>
                  <input 
                    type="password" 
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={status.loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
              >
                {status.loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {status.success ? (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">Redirecting to your account...</p>
            </div>
          ) : (
            <div className="mt-8 text-center">
              <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary font-bold transition-colors">
                <ArrowLeft size={16} /> Back to Login
              </Link>
            </div>
          )}
          
        </div>
      </div>
    </PageWrapper>
  );
};

export default ResetPassword;
