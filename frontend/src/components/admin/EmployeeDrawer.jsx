import React, { useState } from 'react';
import { X, Shield, Power, CheckCircle, ChevronDown, ChevronRight, Lock, Check } from 'lucide-react';
import {
  ACTION_REGISTRY,
  PAGE_REGISTRY,
  hasActionPermission,
  hasPageAccess,
  isGrantablePage,
  isGrantableAction
} from '../../utils/pageAccess';

const EmployeeDrawer = ({ isOpen, onClose, employee, token, currentUser, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, pages, actions
  const [updating, setUpdating] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Collapse state for action permissions (grouped by page)
  const [expandedGroups, setExpandedGroups] = useState({});

  if (!isOpen || !employee) return null;

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const handleToggleStatus = async () => {
    if (!window.confirm(`Are you sure you want to ${employee.status === 'active' ? 'disable' : 'reactivate'} this account?`)) return;
    
    const newStatus = employee.status === 'active' ? 'disabled' : 'active';
    setUpdating('status');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/${employee._id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to toggle status');
      
      showMessage(`Employee ${newStatus === 'active' ? 'reactivated' : 'disabled'} successfully`);
      if (typeof onUpdate === 'function') {
        onUpdate(data.data);
      }
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleChangeRole = async (newRole) => {
    if (newRole === employee.role) return;
    if (!window.confirm(`Are you sure you want to change this employee's role to ${newRole.replace('_', ' ')}?`)) return;

    setUpdating('role');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/${employee._id}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to change role');
      
      showMessage(`Role changed to ${newRole.replace('_', ' ')}`);
      if (typeof onUpdate === 'function') {
        onUpdate(data.data);
      }
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handlePageToggle = async (pageKey) => {
    if (employee.role === 'super_admin' || !isGrantablePage(pageKey)) return;
    
    const currentlyEnabled = hasPageAccess(employee, pageKey);
    setUpdating(`page_${pageKey}`);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/${employee._id}/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'page', page: pageKey, enabled: !currentlyEnabled })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to update page access');

      const pageObj = PAGE_REGISTRY.find(p => p.key === pageKey);
      showMessage(`${currentlyEnabled ? 'Revoked' : 'Granted'} access to ${pageObj?.label || pageKey}`);
      if (typeof onUpdate === 'function') {
        onUpdate(data.data);
      }
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleActionToggle = async (actionKey) => {
    if (employee.role === 'super_admin') return;

    const currentlyEnabled = hasActionPermission(employee, actionKey);
    setUpdating(`action_${actionKey}`);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/${employee._id}/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'action', permission: actionKey, enabled: !currentlyEnabled })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to update action permission');

      const actionObj = ACTION_REGISTRY.find(a => a.key === actionKey);
      showMessage(`${currentlyEnabled ? 'Revoked' : 'Granted'} permission: ${actionObj?.label || actionKey}`);
      if (typeof onUpdate === 'function') {
        onUpdate(data.data);
      }
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setUpdating(null);
    }
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Group actions by page
  const actionsByPage = PAGE_REGISTRY.reduce((acc, page) => {
    const actions = ACTION_REGISTRY.filter(a => a.page === page.key);
    if (actions.length > 0) {
      acc.push({ page, actions });
    }
    return acc;
  }, []);

  const canManageAccount = currentUser?.id !== employee._id && employee.role !== 'super_admin';

  return (
    <>
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      
      <div className={`fixed top-0 right-0 bottom-0 w-full lg:w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-lg font-heading text-dark truncate" title={employee.name}>{employee.name}</h2>
            <p className="text-xs text-gray-500 truncate" title={employee.email}>{employee.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Global Feedback Message */}
        {message.text && (
          <div className={`px-6 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border-b border-red-100' : 'bg-green-50 text-green-600 border-b border-green-100'}`}>
            {message.type === 'success' ? <CheckCircle size={14} /> : <X size={14} />}
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex px-6 border-b border-gray-100 bg-gray-50/30">
          {['overview', 'pages', 'actions'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pt-4 pb-3 mr-6 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.replace('pages', 'Page Access').replace('actions', 'Action Permissions')}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">Account Details</h3>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Account Status</span>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${employee.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${employee.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      {employee.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">System Role</span>
                    <span className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                      {employee.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {canManageAccount && (
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">Management Actions</h3>
                  
                  <div className="space-y-4">
                    {/* Role Change */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                          <Shield size={14} className="text-blue-500" />
                        </div>
                        <span className="text-sm font-bold text-dark">Change Role</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {['admin', 'super_admin', 'mechanic'].map(roleOpt => (
                          <button
                            key={roleOpt}
                            disabled={updating === 'role'}
                            onClick={() => handleChangeRole(roleOpt)}
                            className={`flex-1 py-2.5 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              employee.role === roleOpt 
                                ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-default shadow-sm flex items-center justify-center gap-1.5' 
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                            } disabled:opacity-50`}
                          >
                            {employee.role === roleOpt && <Check size={12} />}
                            {roleOpt.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status Toggle */}
                    <div className={`border rounded-2xl p-5 shadow-sm transition-colors ${employee.status === 'active' ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${employee.status === 'active' ? 'bg-red-50' : 'bg-green-50'}`}>
                              <Power size={14} className={employee.status === 'active' ? 'text-red-500' : 'text-green-500'} />
                            </div>
                            <span className="text-sm font-bold text-dark">{employee.status === 'active' ? 'Disable Account' : 'Reactivate Account'}</span>
                          </div>
                          <p className="text-xs text-gray-500 max-w-[240px]">
                            {employee.status === 'active' ? 'Immediately revokes all dashboard access for this user.' : 'Restores dashboard access with their previous permissions.'}
                          </p>
                        </div>
                        <button
                          disabled={updating === 'status'}
                          onClick={handleToggleStatus}
                          className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 whitespace-nowrap ${
                            employee.status === 'active' 
                              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' 
                              : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                          }`}
                        >
                          {updating === 'status' ? 'Processing...' : (employee.status === 'active' ? 'Disable' : 'Activate')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PAGES */}
          {activeTab === 'pages' && (
            <div className="space-y-3">
              <div className="mb-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Page Access controls which top-level tabs this employee can see. Some pages are <strong className="text-dark">inherently locked</strong> based on their role.
                </p>
              </div>
              {PAGE_REGISTRY.map(page => {
                const hasAccess = hasPageAccess(employee, page.key);
                const isSuperAdmin = employee.role === 'super_admin';
                const isNonGrantable = !isGrantablePage(page.key);
                const inherent = isSuperAdmin || isNonGrantable;
                const isUpdating = updating === `page_${page.key}`;

                // Determine styling based on permission state
                let stateStyle = 'bg-white border-gray-100'; // Default denied
                if (inherent) stateStyle = 'bg-gray-50 border-gray-200';
                else if (hasAccess) stateStyle = 'bg-green-50/30 border-green-100';

                return (
                  <div key={page.key} className={`flex items-center justify-between p-4 border rounded-xl transition-colors shadow-sm ${stateStyle}`}>
                    <div>
                      <p className="text-sm font-bold text-dark mb-1">{page.label}</p>
                      <p className="text-[10px] uppercase tracking-widest flex items-center gap-1.5 font-bold">
                        {inherent ? (
                          <span className="text-gray-500 flex items-center gap-1"><Lock size={10} /> Role Access</span>
                        ) : hasAccess ? (
                          <span className="text-green-600 flex items-center gap-1"><Check size={10} /> Active</span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1"><X size={10} /> Denied</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <button
                        disabled={inherent || isUpdating}
                        onClick={() => handlePageToggle(page.key)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                          hasAccess 
                            ? (inherent ? 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300' : 'bg-white text-red-600 border border-red-200 hover:bg-red-50')
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300 hover:text-green-700'
                        } disabled:opacity-70`}
                      >
                        {isUpdating ? 'Wait...' : hasAccess ? (inherent ? 'Locked' : 'Revoke') : 'Grant'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: ACTIONS */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              <div className="mb-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Action Permissions control specific capabilities within a page. <strong className="text-red-500">Requires page access</strong> to be functional.
                </p>
              </div>
              {actionsByPage.map(({ page, actions }) => {
                const isExpanded = expandedGroups[page.key];
                const pageAccess = hasPageAccess(employee, page.key);
                const isInherited = employee.role === 'super_admin';
                
                // Calculate how many are granted
                const grantedCount = actions.filter(a => isInherited || hasActionPermission(employee, a.key)).length;

                return (
                  <div key={page.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleGroup(page.key)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-transparent data-[expanded=true]:border-gray-100"
                      data-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-dark">{page.label}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${grantedCount === actions.length ? 'bg-green-100 text-green-700' : grantedCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {grantedCount} / {actions.length}
                        </span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center">
                        {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="divide-y divide-gray-100 bg-gray-50/50">
                        {actions.map(action => {
                          const actionAccess = hasActionPermission(employee, action.key);
                          const inherent = isInherited;
                          const isUpdating = updating === `action_${action.key}`;

                          return (
                            <div key={action.key} className="flex items-center justify-between p-4 pl-5 hover:bg-gray-50 transition-colors">
                              <div className="pr-4">
                                <p className="text-sm text-dark font-medium leading-tight mb-1">{action.label}</p>
                                {!pageAccess && !inherent && (
                                  <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest bg-red-50 inline-block px-1.5 py-0.5 rounded">Requires Page Access</p>
                                )}
                              </div>
                              <button
                                disabled={inherent || !pageAccess || isUpdating || !isGrantableAction(action.key)}
                                onClick={() => handleActionToggle(action.key)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border whitespace-nowrap ${
                                  actionAccess 
                                    ? (inherent ? 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed' : 'bg-white text-red-600 border-red-200 hover:bg-red-50')
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700'
                                } disabled:opacity-70`}
                              >
                                {isUpdating ? 'Wait...' : actionAccess ? (inherent ? 'Locked' : 'Revoke') : 'Grant'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default EmployeeDrawer;
