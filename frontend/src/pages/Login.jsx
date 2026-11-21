import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Eye, EyeOff, ShieldCheck, Award } from 'lucide-react';
import { useToast } from '../components/ui/ToastContext';
import Button from '../components/ui/Button';

const Login = () => {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userResult = await login(email, password);
      const from = location.state?.from;
      if (from) {
        navigate(from);
      } else if (userResult?.user?.role === 'admin' || userResult?.user?.role === 'super_admin' || userResult?.user?.role === 'mechanic') {
        navigate('/admin');
      } else if (userResult?.user?.role === 'user') {
        navigate('/customer');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen m-0 p-0 overflow-x-hidden overflow-y-auto font-sans relative">
      
      {/* Full-Screen Background Image */}
      <div className="fixed inset-0 z-0 bg-[#000]">
        <img 
          src="/login-image.webp" 
          alt="GSK Automotive Background" 
          className="w-full h-full object-cover object-[85%_center] md:object-[75%_center] lg:object-center" 
          loading="eager"
          fetchPriority="high"
        />
        {/* Very subtle gradient strictly at the top/bottom edges to frame the image, no heavy tint over the car */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none"></div>
      </div>
      
      {/* Scrollable container for perfect centering with padding to prevent bottom clipping */}
      <div className="relative z-10 w-full min-h-full flex items-center justify-center p-6 md:p-12">
        
        {/* Single Centered Group for Form and Features */}
        <div className="w-full max-w-[500px] flex flex-col items-center">
          
          {/* Logo */}
          <div className="mb-6">
            <img 
              src="/Logo.png" 
              alt="GSK Automotive Logo" 
              className="h-16 object-contain drop-shadow-md" 
            />
          </div>

          {/* Welcome Text */}
          <div className="text-center mb-10 w-full">
            <h2 className="text-[34px] font-sans font-semibold text-white mb-2 tracking-tight drop-shadow-md">Welcome Back</h2>
            <p className="text-gray-100 text-[17px] font-light drop-shadow">Sign in to access your dashboard</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="w-full bg-red-500/20 border border-red-500/40 text-red-100 text-sm px-4 py-3 rounded mb-6 text-center backdrop-blur-sm shadow-md">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full">
            {/* Email */}
            <div className="mb-6">
              <label className="block text-[11px] font-bold text-gray-200 uppercase tracking-widest mb-2.5 drop-shadow">
                Email Address
              </label>
              <div className="relative flex items-center border border-gray-600 rounded bg-[#2a2a2a]/95 backdrop-blur-md overflow-hidden focus-within:border-gray-400 transition-colors shadow-lg">
                <div className="w-14 h-[54px] flex items-center justify-center border-r border-gray-600 shrink-0">
                  <User size={20} className="text-gray-400" strokeWidth={1.5} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  required
                  className="w-full bg-transparent h-[54px] px-4 text-[15px] text-white outline-none placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-[11px] font-bold text-gray-200 uppercase tracking-widest mb-2.5 drop-shadow">
                Password
              </label>
              <div className="relative flex items-center border border-gray-600 rounded bg-[#2a2a2a]/95 backdrop-blur-md overflow-hidden focus-within:border-gray-400 transition-colors shadow-lg">
                <div className="w-14 h-[54px] flex items-center justify-center border-r border-gray-600 shrink-0">
                  <Lock size={20} className="text-gray-400" strokeWidth={1.5} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-transparent h-[54px] pl-4 pr-12 text-[15px] text-white outline-none placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between mb-8">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className={`w-5 h-5 rounded-[4px] flex items-center justify-center transition-colors shadow-md ${rememberMe ? 'bg-[#ff0000]' : 'bg-black/40 border border-gray-400 backdrop-blur-sm'}`}>
                  {rememberMe && <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white fill-current"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                </div>
                <span className="text-gray-200 text-[11px] font-bold uppercase tracking-widest group-hover:text-white transition-colors mt-0.5 drop-shadow">Remember Me</span>
              </label>
              <Link to="/forgot-password" className="text-[#ff0000] text-[12px] font-medium hover:underline drop-shadow-md">
                Forgot Password?
              </Link>
            </div>

            {/* Submit */}
            <Button type="submit" loading={loading} size="lg" className="w-full py-[16px] text-[17px] shadow-xl">SIGN IN</Button>
            
            {/* Create Account Link */}
            <div className="mt-6 text-center">
              <span className="text-gray-400 text-sm drop-shadow">Don't have an account? </span>
              <Link to="/register" className="text-[#ff0000] text-sm font-bold hover:underline drop-shadow-md">
                Create Account
              </Link>
            </div>
          </form>

          {/* Spacer between Form and Footer to keep it in one block */}
          <div className="h-14"></div>

          {/* Bottom Footer & Features Section */}
          <div className="w-full flex flex-col items-center">
            <p className="text-gray-300 text-[11px] uppercase tracking-[0.2em] font-medium mb-8 text-center drop-shadow-md">
              GSK AUTOMOTIVE MANAGEMENT SYSTEM
            </p>
            
            <div className="flex flex-wrap justify-center gap-8 md:gap-14 w-full">
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-[48px] h-[48px] rounded-full border border-gray-400/80 flex items-center justify-center bg-black/40 backdrop-blur-sm shadow-lg">
                  <ShieldCheck size={22} className="text-[#ff0000]" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <div className="text-white text-[11px] font-bold uppercase tracking-wide drop-shadow-md">Trusted</div>
                  <div className="text-gray-300 text-[10px] drop-shadow">Professionals</div>
                </div>
              </div>
              
              {/* Vertical Divider line */}
              <div className="hidden sm:block w-[1px] h-12 bg-gray-500/50 my-auto shadow-sm"></div>

              <div className="flex flex-col items-center gap-2.5">
                <div className="w-[48px] h-[48px] rounded-full border border-gray-400/80 flex items-center justify-center bg-black/40 backdrop-blur-sm shadow-lg">
                  <Award size={22} className="text-[#ff0000]" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <div className="text-white text-[11px] font-bold uppercase tracking-wide drop-shadow-md">Quality</div>
                  <div className="text-gray-300 text-[10px] drop-shadow">Workmanship</div>
                </div>
              </div>

              {/* Vertical Divider line */}
              <div className="hidden sm:block w-[1px] h-12 bg-gray-500/50 my-auto shadow-sm"></div>

              <div className="flex flex-col items-center gap-2.5">
                <div className="w-[48px] h-[48px] rounded-full border border-gray-400/80 flex items-center justify-center bg-black/40 backdrop-blur-sm shadow-lg">
                  <ShieldCheck size={22} className="text-[#ff0000]" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <div className="text-white text-[11px] font-bold uppercase tracking-wide drop-shadow-md">Worry-Free</div>
                  <div className="text-gray-300 text-[10px] drop-shadow">Warranty</div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
    </div>
  );
};

export default Login;
