import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import PageWrapper from '../components/PageWrapper';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';

const ForgotPassword = () => {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ loading: false });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true });

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgotpassword`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (data.success) {
        setStatus({ loading: false });
        toast.success(data.message || 'If an account exists, an email has been sent.');
        setEmail('');
      } else {
        setStatus({ loading: false });
        toast.error(data.error || 'Failed to send reset link.');
      }
    } catch (error) {
      setStatus({ loading: false });
      toast.error('Server error. Please try again later.');
    }
  };

  return (
    <PageWrapper className="bg-lightBg min-h-screen pt-24 pb-20 flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-gray-100">
          
          <div className="text-center mb-8">
            <h1 className="font-heading text-3xl mb-2 text-dark">Reset Password</h1>
            <p className="text-gray-500 text-sm">Enter your email and we'll send you a link to reset your password.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={status.loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
            >
              {status.loading ? 'Sending...' : (
                <>
                  <Send size={18} /> Send Reset Link
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary font-bold transition-colors">
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
          
        </div>
      </div>
    </PageWrapper>
  );
};

export default ForgotPassword;
