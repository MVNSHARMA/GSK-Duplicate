import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { name: 'HOME', path: '/' },
    { name: 'ABOUT US', path: '/about' },
    { name: 'CONTACT US', path: '/contact' },
    { name: 'SERVICES', path: '/services' },
    { name: 'REQUEST A QUOTE', path: '/request-quote' },
  ];

  const isLinkActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path.split('#')[0]) && path !== '/';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="flex justify-between items-center h-24">
          
          {/* Logo & Tagline */}
          <Link to="/" className="flex items-center gap-4 text-decoration-none group">
            <motion.img 
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
              src="/Logo.png" 
              alt="GSK Automotive Logo" 
              className="h-16 object-contain" 
            />
            <div className="hidden md:flex flex-col justify-center">
              <span className="font-heading text-[1.4rem] tracking-tight leading-none text-dark group-hover:text-primary transition-colors duration-300">
                QUALITY SERVICE
              </span>
              <span className="font-heading text-[1.4rem] tracking-tight leading-none text-primary">
                MAXIMUM PERFORMANCE
              </span>
            </div>
          </Link>

          {/* Desktop Links */}
          <ul className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.name} className="relative">
                <Link 
                  to={link.path}
                  className={`font-heading text-[1.1rem] tracking-wide transition-colors ${
                    isLinkActive(link.path) ? 'text-primary' : 'text-dark hover:text-primary'
                  }`}
                >
                  {link.name}
                </Link>
                {isLinkActive(link.path) && (
                  <motion.div 
                    layoutId="navbar-underline"
                    className="absolute -bottom-1 left-0 right-0 h-[2px] bg-primary"
                    initial={false}
                  />
                )}
              </li>
            ))}
          </ul>

          {/* Action Buttons & Mobile Toggle */}
          <div className="flex items-center gap-4">
            
            {/* Login / User Profile (Desktop) */}
            <div className="hidden lg:flex items-center gap-4">
              {isAuthenticated && ['admin', 'super_admin', 'mechanic'].includes(user?.role) && (
                <Link to="/admin">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-100 text-dark font-heading text-[1.1rem] px-5 py-2 rounded border border-gray-200 hover:bg-gray-200 transition-colors uppercase tracking-wider shadow-sm"
                  >
                    Admin Dashboard
                  </motion.button>
                </Link>
              )}

              {!isAuthenticated ? (
                <Link to="/login" className="text-dark hover:text-primary font-heading text-[1.1rem] transition-colors flex items-center gap-1 border-r border-gray-200 pr-4">
                  <User size={18} /> LOGIN
                </Link>
              ) : (
                <div className="flex items-center gap-4 border-r border-gray-200 pr-4">
                  <div className="flex items-center gap-2 text-dark font-heading text-[1.1rem]">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                      <User size={16} className="text-gray-500" />
                    </div>
                    <span>{user?.name?.split(' ')[0]}</span>
                  </div>
                  <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors" title="Logout">
                    <LogOut size={18} />
                  </button>
                </div>
              )}

              <Link to="/book-service">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-primary text-white font-heading text-[1.2rem] px-8 py-3 rounded uppercase tracking-wider hover:bg-primary-dark transition-colors"
                >
                  BOOK NOW
                </motion.button>
              </Link>
            </div>

            <button 
              className="lg:hidden p-2 text-dark"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="lg:hidden bg-white border-t border-gray-100 overflow-hidden shadow-lg"
          >
            <ul className="flex flex-col py-4 px-6 gap-4">
              {/* Mobile Profile / Login */}
              {isAuthenticated ? (
                <li className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3 text-dark">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <User size={20} className="text-gray-500" />
                    </div>
                    <span className="font-heading text-xl">{user?.name}</span>
                  </div>
                  <button onClick={logout} className="text-red-500">
                    <LogOut size={24} />
                  </button>
                </li>
              ) : (
                <li className="pb-4 border-b border-gray-100">
                  <Link 
                    to="/login"
                    className="flex items-center gap-2 font-heading text-[1.2rem] text-dark"
                  >
                    <User size={20} /> LOGIN
                  </Link>
                </li>
              )}

              {navLinks.map((link) => (
                <li key={link.name}>
                  <Link 
                    to={link.path}
                    className={`block font-heading text-[1.2rem] ${
                      isLinkActive(link.path) ? 'text-primary' : 'text-dark'
                    }`}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
              
              {isAuthenticated && ['admin', 'super_admin', 'mechanic'].includes(user?.role) && (
                <li className="pt-2">
                  <Link to="/admin" className="block w-full">
                    <button className="w-full bg-gray-100 text-dark font-heading text-[1.2rem] py-3 rounded border border-gray-200 uppercase tracking-wider text-left pl-4 hover:bg-gray-200 transition-colors">
                      ADMIN DASHBOARD
                    </button>
                  </Link>
                </li>
              )}

              <li className="pt-4 mt-2 border-t border-gray-100">
                <Link to="/book-service" className="block w-full">
                  <button className="w-full bg-primary text-white font-heading text-[1.2rem] py-3 rounded uppercase tracking-wider">
                    BOOK NOW
                  </button>
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;