import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Car, ClipboardList, FileText, CalendarRange,
  LogOut, X
} from 'lucide-react';

const CustomerSidebar = ({ mobileOpen, onClose }) => {
  const location = useLocation();
  const { logout, user } = useAuth();

  const mainNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/customer/dashboard' },
    { id: 'vehicles', label: 'My Vehicles', icon: Car, path: '/customer/vehicles' },
    { id: 'job-cards', label: 'Service Records', icon: ClipboardList, path: '/customer/job-cards' },
    { id: 'invoices', label: 'Invoices', icon: FileText, path: '/customer/invoices' },
    { id: 'bookings', label: 'Bookings', icon: CalendarRange, path: '/customer/bookings' },
    // Only show B2B features for non-regular customers
    ...(user?.customerType !== 'regular' ? [{ id: 'batches', label: 'Service Batches', icon: ClipboardList, path: '/customer/batches' }] : []),
    { id: 'service-history', label: 'History', icon: FileText, path: '/customer/service-history' }
  ];

  const isActive = (path) => location.pathname.startsWith(path);

  const NavItem = ({ item }) => (
    <Link
      to={item.path}
      onClick={onClose}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive(item.path)
          ? 'bg-primary text-white shadow-lg shadow-primary/20'
          : 'text-gray-500 hover:text-dark hover:bg-white/5'
      }`}
    >
      <item.icon size={18} strokeWidth={1.5} />
      <span className="flex-1">{item.label}</span>
    </Link>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] lg:hidden" onClick={onClose}></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-screen w-[240px] bg-white border-r border-gray-100
        flex flex-col z-[70]
        transition-transform duration-300 ease-out
        lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo Header */}
        <div className="px-5 py-6 flex items-center justify-between border-b border-gray-100">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/Logo.png" alt="GSK" className="w-10 h-10 object-contain" />
            <div>
              <span className="text-dark font-heading text-lg tracking-wide">GSK</span>
              <span className="text-gray-500 font-heading text-lg tracking-wide ml-1">PORTAL</span>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-dark">
            <X size={20} />
          </button>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {mainNav.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        {/* Logout Button */}
        <div className="px-3 pb-6 border-t border-gray-100 pt-4">
          <button
            onClick={() => {
              logout();
              onClose?.();
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-white/5 transition-all duration-200 w-full"
          >
            <LogOut size={18} strokeWidth={1.5} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default CustomerSidebar;
