import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth(); // We won't use this directly, we'll manually set tokens

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing invitation token.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password }),
      });
      
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      // Store token and redirect
      localStorage.setItem('gsk_token', data.token);
      window.location.href = '/admin'; // Force full reload to update AuthContext

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <motion.div 
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 relative bg-[#0a0a0a] flex-col justify-between overflow-hidden"
      >
        <div className="absolute inset-0 z-0">
          <img src="/img11.jpg" alt="Performance car" className="w-full h-full object-cover object-[60%_center] sm:object-center opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/70 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/60 to-transparent"></div>
        </div>
        <div className="relative z-10 p-8 flex items-center gap-3">
          <img src="/Logo.png" alt="GSK Logo" className="w-14 h-14 object-contain" />
          <span className="text-white font-heading text-2xl tracking-wider">GSK <span className="text-white/80">AUTOMOTIVES</span></span>
        </div>
        <div className="relative z-10 px-12 pb-24 flex-1 flex flex-col justify-center">
          <h1 className="font-heading text-5xl xl:text-6xl text-white leading-[1] mb-2">
            WELCOME TO THE
          </h1>
          <h1 className="font-heading text-5xl xl:text-6xl text-primary leading-[1] mb-6 italic">
            ADMIN TEAM.
          </h1>
          <p className="text-gray-400 text-base max-w-md leading-relaxed">
            You've been invited to manage GSK Automotives. Please set up your account to access the dashboard.
          </p>
        </div>
      </motion.div>

      {/* Right Panel */}
      <motion.div 
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8 md:p-16"
      >
        <div className="w-full max-w-md">
          <h2 className="text-4xl font-heading text-dark mb-2 normal-case italic" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.5px' }}>
            Setup Account
          </h2>
          <p className="text-gray-500 text-base mb-10">
            Enter your details to accept your invitation
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {!token ? (
            <div className="text-center py-10">
              <ShieldCheck size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Invalid or missing invitation token.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center border-r border-gray-200">
                    <User size={20} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="w-full bg-white border border-gray-200 rounded-lg pl-16 pr-4 py-4 text-base text-dark outline-none focus:border-primary transition-colors placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center border-r border-gray-200">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-16 pr-12 py-4 text-base text-dark outline-none focus:border-primary transition-colors placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="mb-10">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center border-r border-gray-200">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    className="w-full bg-white border border-gray-200 rounded-lg pl-16 pr-12 py-4 text-base text-dark outline-none focus:border-primary transition-colors placeholder:text-gray-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold text-lg uppercase tracking-widest py-4 rounded-lg transition-all duration-300 hover:shadow-[0_8px_25px_rgba(230,0,0,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'CREATE ACCOUNT'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AcceptInvite;
