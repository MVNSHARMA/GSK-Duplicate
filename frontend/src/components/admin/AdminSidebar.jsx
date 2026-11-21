import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Package, Users, Car, Ship, TrendingUp,
  Key, ClipboardList, FileText, CarFront, MessageSquare,
  UserCog, Trash2, Settings, LogOut, X, CalendarRange, FileClock
} from 'lucide-react';
import { hasPageAccess } from '../../utils/pageAccess';

const ROUTE_PREFETCHERS = {
  '/admin/dashboard': () => import('../../pages/admin/Dashboard'),
  '/admin/communications': () => import('../../pages/admin/Communications'),
  '/admin/inventory': () => import('../../pages/admin/Inventory'),
  '/admin/suppliers': () => import('../../pages/admin/Suppliers'),
  '/admin/purchase-orders': () => import('../../pages/admin/PurchaseOrders'),
  '/admin/customers': () => import('../../pages/admin/Customers'),
  '/admin/vehicles': () => import('../../pages/admin/Vehicles'),
  '/admin/regular-customers': () => import('../../pages/admin/RegularCustomers'),
  '/admin/daily-sales': () => import('../../pages/admin/DailySales'),
  '/admin/rentals': () => import('../../pages/admin/Rentals'),
  '/admin/import-trackers': () => import('../../pages/admin/ImportTrackers'),
  '/admin/job-cards': () => import('../../pages/admin/JobCards'),
  '/admin/invoices': () => import('../../pages/admin/Invoices'),
  '/admin/dealer-cars': () => import('../../pages/admin/DealerCars'),
  '/admin/employees': () => import('../../pages/admin/Employees'),
  '/admin/booking-slots': () => import('../../pages/admin/BookingSlots'),
  '/admin/trash': () => import('../../pages/admin/Trash'),
  '/admin/settings': () => import('../../pages/admin/Settings'),
  '/admin/audit-logs': () => import('../../pages/admin/AuditLogs'),
};

const prefetchedPaths = new Set();
const prefetchRouteChunk = (path) => {
  if (!path || prefetchedPaths.has(path)) return;
  const loader = ROUTE_PREFETCHERS[path];
  if (loader) {
    prefetchedPaths.add(path);
    loader().catch(() => {
      prefetchedPaths.delete(path);
    });
  }
};

const AdminSidebar = ({ mobileOpen, onClose, unreadCount = 0 }) => {
  const location = useLocation();
  const { logout, user } = useAuth();

  const allMainNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { id: 'communications', label: 'Communications', icon: MessageSquare, path: '/admin/communications', badge: unreadCount },
    { id: 'inventory', label: 'Inventory', icon: Package, path: '/admin/inventory' },
    { id: 'suppliers', label: 'Suppliers', icon: Package, path: '/admin/suppliers' },
    { id: 'purchase-orders', pageKey: 'purchaseOrders', label: 'Purchase Orders', icon: ClipboardList, path: '/admin/purchase-orders' },
    { id: 'customers', label: 'Customers', icon: Users, path: '/admin/customers' },
    { id: 'vehicles', label: 'Vehicles', icon: Car, path: '/admin/vehicles' },
    { id: 'regular-customers', pageKey: 'regularCustomers', label: 'Regular Customers', icon: Users, path: '/admin/regular-customers' },
    { id: 'daily-sales', pageKey: 'dailySales', label: 'Daily Sales', icon: TrendingUp, path: '/admin/daily-sales' },
    { id: 'rentals', label: 'Rentals', icon: Key, path: '/admin/rentals' },
    { id: 'import-trackers', pageKey: 'importTrackers', label: 'Import Trackers', icon: Ship, path: '/admin/import-trackers' },
    { id: 'job-cards', pageKey: 'jobCards', label: 'Job Cards', icon: ClipboardList, path: '/admin/job-cards' },
    { id: 'invoices', label: 'Invoices', icon: FileText, path: '/admin/invoices' },
    { id: 'dealer-cars', pageKey: 'dealerCars', label: 'Dealer Cars', icon: CarFront, path: '/admin/dealer-cars' },
  ];

  const allManagementNav = [
    { id: 'employees', label: 'Employees', icon: UserCog, path: '/admin/employees' },
    { id: 'booking-slots', pageKey: 'bookingSlots', label: 'Booking Slots', icon: CalendarRange, path: '/admin/booking-slots' },
    { id: 'trash', label: 'Trash', icon: Trash2, path: '/admin/trash' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
    { id: 'audit-logs', pageKey: 'auditLogs', label: 'Audit Logs', icon: FileClock, path: '/admin/audit-logs' },
  ];

  const mainNav = allMainNav.filter(item => hasPageAccess(user, item.pageKey || item.id));
  const managementNav = allManagementNav.filter(item => hasPageAccess(user, item.pageKey || item.id));

  const isActive = (path) => location.pathname.startsWith(path);

  const NavItem = ({ item }) => (
    <Link
      to={item.path}
      onClick={onClose}
      onMouseEnter={() => prefetchRouteChunk(item.path)}
      onFocus={() => prefetchRouteChunk(item.path)}
      data-tour={`sidebar-${item.id}`}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive(item.path)
          ? 'bg-primary/10 text-primary font-bold'
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      <item.icon size={18} strokeWidth={1.5} />
      <span className="flex-1">{item.label}</span>
      {item.badge > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
          isActive(item.path) ? 'bg-primary text-white' : 'bg-red-500 text-white'
        }`}>
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
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
          <Link to="/" className="flex items-center gap-2 lg:gap-3 hover:opacity-80 transition-opacity shrink-0">
            <img src="/Logo.png" alt="GSK" className="w-12 h-12 lg:w-16 lg:h-16 object-contain shrink-0" />
            <div className="flex-1 whitespace-nowrap">
              <span className="text-dark font-heading text-xl tracking-wide">GSK</span>
              <span className="text-gray-500 font-heading text-xl tracking-wide ml-1">AUTOMOTIVE</span>
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

          {/* Management Section */}
          <div className="pt-6 mt-4 border-t border-gray-100">
            <p className="px-4 text-[10px] font-bold text-gray-600 uppercase tracking-[2px] mb-3">Management</p>
            {managementNav.map((item) => (
              <NavItem key={item.path} item={item} />
            ))}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="px-3 pb-6 border-t border-gray-100 pt-4">
          <button
            onClick={() => {
              logout();
              onClose?.();
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 w-full"
          >
            <LogOut size={18} strokeWidth={1.5} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
