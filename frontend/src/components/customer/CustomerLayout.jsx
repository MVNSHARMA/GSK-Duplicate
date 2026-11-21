import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import CustomerSidebar from './CustomerSidebar';

const CustomerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden relative">
      {/* Sidebar Component */}
      <CustomerSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-[240px] min-w-0 w-full max-w-[100vw]">
        {/* Mobile Topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/Logo.png" alt="GSK Logo" className="w-8 h-8 object-contain" />
            <span className="text-dark font-heading text-lg">GSK</span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-dark"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CustomerLayout;
