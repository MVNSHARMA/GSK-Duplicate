import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Search, Filter, Clock, ChevronLeft, ChevronRight, Plus, Mail, Shield, AlertCircle, X, Users } from 'lucide-react';
import { useToast } from '../../components/ui/ToastContext';
import InviteEmployeeModal from '../../components/admin/InviteEmployeeModal';
import EmployeeDrawer from '../../components/admin/EmployeeDrawer';

const ITEMS_PER_PAGE = 15;

const TableSkeleton = ({ isPending }) => (
  <div className="w-full">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center justify-between p-4 border-b border-gray-100 animate-pulse bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-3 bg-gray-100 rounded w-48"></div>
          </div>
        </div>
        <div className="hidden sm:block h-6 bg-gray-200 rounded-full w-24"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
        <div className="h-8 bg-gray-200 rounded w-20"></div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ title, message, icon: Icon, action }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50/50">
    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm mb-4">
      <Icon size={24} className="text-gray-400" />
    </div>
    <h3 className="text-sm font-bold text-dark mb-1">{title}</h3>
    <p className="text-xs text-gray-500 max-w-sm mx-auto mb-6">{message}</p>
    {action && action}
  </div>
);

const Employees = () => {
  const toast = useToast();
  const { token, user: currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'pending'
  const [admins, setAdmins] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // all, super_admin, admin, mechanic
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, disabled

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Modals / Drawers State
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null); // Full user object

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [adminRes, inviteRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/admins`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/admins/invitations`, { headers })
      ]);

      const adminData = await adminRes.json();
      const inviteData = await inviteRes.json();

      if (adminData.success) setAdmins(adminData.data);
      if (inviteData.success) setInvitations(inviteData.data);
    } catch (err) {
      console.error('Failed to fetch employee data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, activeTab]);

  // Client-Side Filtering
  const filteredAdmins = useMemo(() => {
    return admins.filter(admin => {
      const matchesSearch = (admin.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (admin.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || admin.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || admin.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [admins, searchQuery, roleFilter, statusFilter]);

  const filteredInvites = useMemo(() => {
    return invitations.filter(invite => {
      const matchesSearch = (invite.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || invite.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [invitations, searchQuery, roleFilter]);

  // Pagination Logic
  const totalPages = Math.ceil((activeTab === 'active' ? filteredAdmins.length : filteredInvites.length) / ITEMS_PER_PAGE);
  const currentData = activeTab === 'active' 
    ? filteredAdmins.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : filteredInvites.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Invite Actions
  const handleRevokeInvite = async (id) => {
    if (!window.confirm("Are you sure you want to revoke this invitation?")) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/invitations/${id}/revoke`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to revoke invite');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResendInvite = async (id) => {
    if (!window.confirm("Are you sure you want to resend this invitation? This will invalidate the previous link.")) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/invitations/${id}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to resend invite');
      toast.success(data.message || 'Invitation resent successfully');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Sync selected employee changes if data refetches
  useEffect(() => {
    if (selectedEmployee) {
      const updated = admins.find(a => a._id === selectedEmployee._id);
      if (updated) setSelectedEmployee(updated);
    }
  }, [admins]);

  const handleEmployeeUpdated = (updatedEmployee) => {
    if (updatedEmployee && updatedEmployee._id) {
      setAdmins(prev => prev.map(a => a._id === updatedEmployee._id ? updatedEmployee : a));
      setSelectedEmployee(updatedEmployee);
    }
    fetchData();
  };

  const canInvite = currentUser?.role === 'super_admin';

  return (
    <div className="max-w-[1400px] mx-auto text-dark pb-20 px-4 sm:px-6 lg:px-8 mt-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b border-gray-100 pb-6">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl mb-1">Employees</h1>
          <p className="text-gray-500 text-sm">Manage dashboard access, roles, and staff privileges.</p>
        </div>
        {canInvite && (
          <button 
            onClick={() => setInviteModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={16} /> Invite Employee
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6">
        <button 
          onClick={() => setActiveTab('active')}
          className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'active' ? 'border-primary text-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Active Staff ({filteredAdmins.length})
        </button>
        <button 
          onClick={() => setActiveTab('pending')}
          className={`pb-2 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === 'pending' ? 'border-primary text-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Pending Invites ({filteredInvites.length})
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-dark outline-none focus:border-primary transition-colors focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 flex-1 lg:flex-none">
            <Filter size={14} className="text-gray-400 hidden sm:block" />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full lg:w-auto bg-gray-50 border border-gray-200 text-dark text-xs font-bold uppercase tracking-wider rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="mechanic">Mechanic</option>
            </select>
          </div>
          
          {activeTab === 'active' && (
            <div className="flex items-center gap-2 flex-1 lg:flex-none">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full lg:w-auto bg-gray-50 border border-gray-200 text-dark text-xs font-bold uppercase tracking-wider rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden w-full shadow-sm mb-6">
        {loading ? (
          <TableSkeleton isPending={activeTab === 'pending'} />
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="p-4 pl-6 text-xs font-bold text-gray-500 uppercase tracking-widest">{activeTab === 'active' ? 'Employee' : 'Invited Email'}</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Role</th>
                  <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{activeTab === 'active' ? 'Status' : 'Expires'}</th>
                  <th className="p-4 pr-6 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-0">
                      <EmptyState 
                        icon={searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? Search : Users}
                        title={searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? 'No matching employees' : 'No employees found'}
                        message={searchQuery || roleFilter !== 'all' || statusFilter !== 'all' 
                          ? 'Try adjusting your search or filters to find what you are looking for.' 
                          : 'There are no employees to display in this list.'}
                        action={(!searchQuery && roleFilter === 'all' && statusFilter === 'all' && canInvite) ? (
                          <button 
                            onClick={() => setInviteModalOpen(true)}
                            className="bg-white border border-gray-200 hover:border-primary hover:text-primary text-gray-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-colors"
                          >
                            Invite Employee
                          </button>
                        ) : null}
                      />
                    </td>
                  </tr>
                ) : activeTab === 'active' ? (
                  currentData.map(admin => (
                    <tr key={admin._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 flex-shrink-0">
                            <User size={18} className="text-gray-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate" title={admin.name}>{admin.name || 'Unnamed Employee'}</p>
                            <p className="text-xs text-gray-500 truncate" title={admin.email}>{admin.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          admin.role === 'super_admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {admin.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${admin.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-400'}`}></div>
                          <span className={`text-xs font-bold uppercase tracking-wider ${admin.status === 'active' ? 'text-gray-700' : 'text-gray-400'}`}>
                            {admin.status}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <button 
                          onClick={() => setSelectedEmployee(admin)}
                          className="bg-white border border-gray-200 hover:border-primary hover:text-primary text-gray-700 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  currentData.map(invite => (
                    <tr key={invite._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 pl-6 text-sm font-medium text-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 flex-shrink-0">
                            <Mail size={16} className="text-blue-500" />
                          </div>
                          <span className="truncate" title={invite.email}>{invite.email}</span>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          invite.role === 'super_admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {invite.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="text-yellow-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Clock size={10} /> Pending
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {new Date(invite.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-3 h-full">
                          <button 
                            onClick={() => handleResendInvite(invite._id)}
                            className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded"
                          >
                            Resend
                          </button>
                          <button 
                            onClick={() => handleRevokeInvite(invite._id)}
                            className="text-[10px] font-bold uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 pt-6 gap-4">
          <p className="text-xs text-gray-500 font-medium">
            Showing <span className="text-dark font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-dark font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, activeTab === 'active' ? filteredAdmins.length : filteredInvites.length)}</span> of <span className="text-dark font-bold">{activeTab === 'active' ? filteredAdmins.length : filteredInvites.length}</span> results
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors border border-gray-200"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold px-4">{currentPage} / {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors border border-gray-200"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modals and Drawers */}
      <InviteEmployeeModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setInviteModalOpen(false)} 
        token={token}
        onInvite={fetchData}
      />

      <EmployeeDrawer 
        isOpen={!!selectedEmployee}
        employee={selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        token={token}
        currentUser={currentUser}
        onUpdate={handleEmployeeUpdated}
      />

    </div>
  );
};

export default Employees;
