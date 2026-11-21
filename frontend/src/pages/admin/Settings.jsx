import React, { useState, useEffect } from 'react';
import Input from '../../components/ui/Input';
import { User, Lock, Save, ShieldCheck, Image as ImageIcon, Building, Settings as SettingsIcon, CreditCard, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/ui/ToastContext';
import { useAuth } from '../../context/AuthContext';

const Settings = () => {
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isDirty, setIsDirty] = useState(false);
  
  // Profile State
  const [profileData, setProfileData] = useState({ name: '', email: '' });
  
  // Password State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Business Settings State
  const [settingsData, setSettingsData] = useState({
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    businessEmail: '',
    businessHours: [],
    timezone: 'Australia/Sydney',
    logoUrl: '',
    defaultBookingCapacity: 3,
    invoicePrefix: 'INV-',
    inventoryWarningThreshold: 5,
    gstRate: 10,
    standardLabourRate: 120,
    invoiceTerms: '',
    defaultEmployeePermissions: {
      admin: {
        pagePermissions: {
          dashboard: true,
          customers: true,
          regularCustomers: true,
          vehicles: true,
          importTrackers: false,
          dailySales: false,
          rentals: false,
          invoices: true,
          jobCards: true,
          inventory: true,
          dealerCars: false,
          communications: true,
          notifications: true,
          settings: false,
          auditLogs: false
        },
        additionalPageAccess: [],
        additionalActionPermissions: []
      },
      mechanic: {
        pagePermissions: {
          dashboard: true,
          customers: true,
          regularCustomers: true,
          vehicles: true,
          importTrackers: false,
          dailySales: false,
          rentals: false,
          invoices: true,
          jobCards: true,
          inventory: true,
          dealerCars: false,
          communications: true,
          notifications: true,
          settings: false,
          auditLogs: false
        },
        additionalPageAccess: [],
        additionalActionPermissions: []
      }
    }
  });
  
  const [employeeRoleTab, setEmployeeRoleTab] = useState('admin');
  
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchBusinessSettings();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProfileData({ name: data.data.name, email: data.data.email });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  };

  const fetchBusinessSettings = async () => {
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSettingsData(data.data);
        if (data.data.logoUrl) {
          setLogoPreview(data.data.logoUrl);
        }
      }
    } catch (error) {
      console.error("Failed to fetch business settings:", error);
    }
  };

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSettingsChange = (field, value) => {
    setSettingsData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleBusinessHoursChange = (index, field, value) => {
    const newHours = [...settingsData.businessHours];
    newHours[index] = { ...newHours[index], [field]: value };
    handleSettingsChange('businessHours', newHours);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setIsDirty(true);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setIsSaving(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/profile`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully' });
        setIsDirty(false);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Server error updating profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('gsk_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admins/password`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Password updated successfully' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setIsDirty(false);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Server error updating password' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDefaultPermissionChange = (page, value) => {
    setSettingsData(prev => ({
      ...prev,
      defaultEmployeePermissions: {
        ...prev.defaultEmployeePermissions,
        [employeeRoleTab]: {
          ...prev.defaultEmployeePermissions?.[employeeRoleTab],
          pagePermissions: {
            ...prev.defaultEmployeePermissions?.[employeeRoleTab]?.pagePermissions,
            [page]: value
          }
        }
      }
    }));
    setIsDirty(true);
  };

  const handleSettingsUpdate = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setIsSaving(true);
    
    try {
      const token = localStorage.getItem('gsk_token');
      
      const formData = new FormData();
      if (logoFile) {
        formData.append('logo', logoFile);
      }
      
      Object.keys(settingsData).forEach(key => {
        if (key === 'businessHours' || key === 'defaultEmployeePermissions') {
            formData.append(key, JSON.stringify(settingsData[key]));
        } else if (key !== 'logoUrl') {
            formData.append(key, settingsData[key]);
        }
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL}/settings`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Business settings updated successfully' });
        setSettingsData(data.data);
        if (data.data.logoUrl) {
            setLogoPreview(data.data.logoUrl);
        }
        setIsDirty(false);
        if (typeof refreshUser === 'function') {
          try {
            await refreshUser();
          } catch (e) {
            console.error("Error refreshing user after settings update:", e);
          }
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update settings (Check Permissions)' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Server error updating settings' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto text-dark">
      <div className="mb-8 flex justify-between items-end">
        <div>
            <h1 className="font-heading text-3xl mb-1 flex items-center gap-3">
            <SettingsIcon className="text-red-500" size={32} /> Settings & Profile
            </h1>
            <p className="text-gray-500 text-sm">Manage your account and global business configuration</p>
        </div>
        {isDirty && (
            <div className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-fade-in">
                <AlertTriangle size={16} /> Unsaved changes
            </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="md:w-64 flex-shrink-0">
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-l-4 ${
                activeTab === 'profile' 
                  ? 'bg-red-500/10 text-red-600 border-red-500' 
                  : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-dark'
              }`}
            >
              <User size={18} /> Profile
            </button>
            <button 
              onClick={() => setActiveTab('password')}
              className={`flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-l-4 ${
                activeTab === 'password' 
                  ? 'bg-red-500/10 text-red-600 border-red-500' 
                  : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-dark'
              }`}
            >
              <Lock size={18} /> Security
            </button>
            {['admin', 'super_admin'].includes(user?.role) && (
              <>
                <div className="px-6 py-3 bg-gray-50 border-y border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Global Configuration
                </div>
                <button 
                    onClick={() => setActiveTab('business_details')}
                    className={`flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-l-4 ${
                    activeTab === 'business_details' 
                        ? 'bg-red-500/10 text-red-600 border-red-500' 
                        : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-dark'
                    }`}
                >
                    <Building size={18} /> Business Details
                </button>
                <button 
                    onClick={() => setActiveTab('business_hours')}
                    className={`flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-l-4 ${
                    activeTab === 'business_hours' 
                        ? 'bg-red-500/10 text-red-600 border-red-500' 
                        : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-dark'
                    }`}
                >
                    <Clock size={18} /> Operating Hours
                </button>
                <button 
                    onClick={() => setActiveTab('system_defaults')}
                    className={`flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-l-4 ${
                    activeTab === 'system_defaults' 
                        ? 'bg-red-500/10 text-red-600 border-red-500' 
                        : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-dark'
                    }`}
                >
                    <ShieldCheck size={18} /> System Defaults
                </button>
                {(user?.role === 'super_admin' || user?.role === 'admin') && (
                  <button 
                      onClick={() => setActiveTab('employee_defaults')}
                      className={`flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-l-4 ${
                      activeTab === 'employee_defaults' 
                          ? 'bg-red-500/10 text-red-600 border-red-500' 
                          : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-dark'
                      }`}
                  >
                      <User size={18} /> Employee Defaults
                  </button>
                )}
                <button 
                    onClick={() => setActiveTab('billing_defaults')}
                    className={`flex items-center gap-3 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-colors border-l-4 ${
                    activeTab === 'billing_defaults' 
                        ? 'bg-red-500/10 text-red-600 border-red-500' 
                        : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-dark'
                    }`}
                >
                    <CreditCard size={18} /> Billing & Invoices
                </button>
                </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white border border-gray-100 rounded-xl p-8 shadow-sm">
          
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-bold flex items-center gap-3 animate-fade-in ${
              message.type === 'success' ? 'bg-green-500/10 text-green-700 border border-green-500/20' : 'bg-red-500/10 text-red-700 border border-red-500/20'
            }`}>
              {message.type === 'success' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
              {message.text}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><User size={20} className="text-gray-400" /> Personal Information</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
                  <input 
                    type="text" 
                    value={profileData.name} 
                    onChange={e => handleProfileChange('name', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:bg-white focus:border-red-500 outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={profileData.email} 
                    onChange={e => handleProfileChange('email', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:bg-white focus:border-red-500 outline-none transition-colors"
                    required
                  />
                </div>
                <div className="pt-6">
                  <button type="submit" disabled={isSaving || !isDirty} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-lg flex items-center justify-center w-full gap-2 transition-colors uppercase tracking-wider text-sm shadow-md">
                    {isSaving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Lock size={20} className="text-gray-400" /> Change Password</h2>
              <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Current Password</label>
                  <input 
                    type="password" 
                    value={passwordData.currentPassword} 
                    onChange={e => handlePasswordChange('currentPassword', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:bg-white focus:border-red-500 outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Password</label>
                  <input 
                    type="password" 
                    value={passwordData.newPassword} 
                    onChange={e => handlePasswordChange('newPassword', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:bg-white focus:border-red-500 outline-none transition-colors"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Confirm New Password</label>
                  <input 
                    type="password" 
                    value={passwordData.confirmPassword} 
                    onChange={e => handlePasswordChange('confirmPassword', e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:bg-white focus:border-red-500 outline-none transition-colors"
                    required
                    minLength={6}
                  />
                </div>
                <div className="pt-6">
                  <button type="submit" disabled={isSaving || !isDirty} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-lg flex items-center justify-center w-full gap-2 transition-colors uppercase tracking-wider text-sm shadow-md">
                    {isSaving ? 'Updating...' : <><Lock size={18} /> Update Password</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'business_details' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Building size={20} className="text-gray-400" /> Business Details</h2>
              <form onSubmit={handleSettingsUpdate} className="space-y-6 max-w-2xl">
                
                <div className="mb-8">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Business Logo</label>
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden flex items-center justify-center relative">
                            {logoPreview ? (
                                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                            ) : (
                                <ImageIcon size={32} className="text-gray-300" />
                            )}
                        </div>
                        <div className="flex-1">
                            <input 
                                type="file" 
                                id="logo-upload" 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleLogoChange}
                            />
                            <label 
                                htmlFor="logo-upload"
                                className="cursor-pointer bg-white border border-gray-200 text-dark hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors inline-block mb-2 shadow-sm"
                            >
                                Choose new logo
                            </label>
                            <p className="text-xs text-gray-500">Recommended size: 200x50px. Max 2MB.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Input label="Business Name" type="text" value={settingsData.businessName} onChange={e => handleSettingsChange('businessName', e.target.value)} />
                  </div>
                  <div>
                    <Input label="Business Phone" type="text" value={settingsData.businessPhone} onChange={e => handleSettingsChange('businessPhone', e.target.value)} />
                  </div>
                  <div>
                    <Input label="Business Email" type="email" value={settingsData.businessEmail} onChange={e => handleSettingsChange('businessEmail', e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Input label="Business Address" type="text" value={settingsData.businessAddress} onChange={e => handleSettingsChange('businessAddress', e.target.value)} />
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-100 flex justify-end">
                  <button type="submit" disabled={isSaving || !isDirty} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors uppercase tracking-wider text-sm shadow-md">
                    {isSaving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'business_hours' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Clock size={20} className="text-gray-400" /> Operating Hours</h2>
              <form onSubmit={handleSettingsUpdate} className="max-w-2xl">
                <div className="space-y-4 mb-8">
                    {settingsData.businessHours && settingsData.businessHours.map((dayConfig, index) => (
                        <div key={dayConfig.day} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between w-full sm:w-auto sm:flex-none gap-4">
                                <div className="w-24 sm:w-32 font-bold text-sm text-dark">{dayConfig.day}</div>
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" className="sr-only" checked={dayConfig.isOpen} onChange={(e) => handleBusinessHoursChange(index, 'isOpen', e.target.checked)} />
                                        <div className={`block w-10 h-6 rounded-full transition-colors ${dayConfig.isOpen ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${dayConfig.isOpen ? 'transform translate-x-4' : ''}`}></div>
                                    </div>
                                    <div className="ml-3 text-sm font-bold text-gray-500 uppercase tracking-wider w-16 text-right sm:text-left">
                                        {dayConfig.isOpen ? 'Open' : 'Closed'}
                                    </div>
                                </label>
                            </div>
                            
                            <div className={`flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 ${!dayConfig.isOpen ? 'opacity-30 pointer-events-none' : ''}`}>
                                <input 
                                    type="time" 
                                    value={dayConfig.openTime}
                                    onChange={(e) => handleBusinessHoursChange(index, 'openTime', e.target.value)}
                                    className="flex-1 sm:flex-none bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-red-500 w-full sm:w-auto"
                                />
                                <span className="text-gray-400 font-bold">-</span>
                                <input 
                                    type="time" 
                                    value={dayConfig.closeTime}
                                    onChange={(e) => handleBusinessHoursChange(index, 'closeTime', e.target.value)}
                                    className="flex-1 sm:flex-none bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-red-500 w-full sm:w-auto"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="pt-6 border-t border-gray-100 flex justify-end">
                  <button type="submit" disabled={isSaving || !isDirty} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors uppercase tracking-wider text-sm shadow-md">
                    {isSaving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'system_defaults' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ShieldCheck size={20} className="text-gray-400" /> System Defaults</h2>
              <form onSubmit={handleSettingsUpdate} className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Timezone</label>
                    <select 
                      value={settingsData.timezone} 
                      onChange={e => handleSettingsChange('timezone', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:bg-white focus:border-red-500 outline-none transition-colors appearance-none font-bold"
                    >
                        <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                        {/* More timezones can be added here if needed */}
                    </select>
                  </div>
                  <div>
                    <Input label="Default Booking Slot Capacity" type="number" value={settingsData.defaultBookingCapacity} onChange={e => handleSettingsChange('defaultBookingCapacity', Number(e.target.value))}
                      min="1" />
                    <p className="text-xs text-gray-400 mt-2">Max concurrent bookings per 30m slot.</p>
                  </div>
                  <div>
                    <Input label="Inventory Warning Threshold" type="number" value={settingsData.inventoryWarningThreshold} onChange={e => handleSettingsChange('inventoryWarningThreshold', Number(e.target.value))}
                      min="0" />
                    <p className="text-xs text-gray-400 mt-2">Default low stock warning level for new parts.</p>
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-100 flex justify-end">
                  <button type="submit" disabled={isSaving || !isDirty} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors uppercase tracking-wider text-sm shadow-md">
                    {isSaving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'billing_defaults' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CreditCard size={20} className="text-gray-400" /> Billing & Invoices</h2>
              <form onSubmit={handleSettingsUpdate} className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Input label="Invoice Prefix" type="text" value={settingsData.invoicePrefix} onChange={e => handleSettingsChange('invoicePrefix', e.target.value)}
                      placeholder="e.g. INV-" />
                    <p className="text-xs text-gray-400 mt-2">Used for all new invoices (e.g. {settingsData.invoicePrefix}1001).</p>
                  </div>
                  <div>
                    <Input label="GST Rate (%)" type="number" value={settingsData.gstRate} onChange={e => handleSettingsChange('gstRate', Number(e.target.value))}
                      min="0"
                      step="0.1" />
                  </div>
                  <div>
                    <Input label="Standard Labour Rate ($/hr)" type="number" value={settingsData.standardLabourRate} onChange={e => handleSettingsChange('standardLabourRate', Number(e.target.value))}
                      min="0"
                      step="0.1" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Default Invoice Terms</label>
                    <textarea 
                      value={settingsData.invoiceTerms} 
                      onChange={e => handleSettingsChange('invoiceTerms', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-dark focus:bg-white focus:border-red-500 outline-none transition-colors"
                      rows="4"
                    ></textarea>
                    <p className="text-xs text-gray-400 mt-2">Appears at the bottom of generated PDF invoices.</p>
                  </div>
                </div>
                <div className="pt-6 border-t border-gray-100 flex justify-end">
                  <button type="submit" disabled={isSaving || !isDirty} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors uppercase tracking-wider text-sm shadow-md">
                    {isSaving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'employee_defaults' && (user?.role === 'super_admin' || user?.role === 'admin') && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><User size={20} className="text-gray-400" /> Employee Default Permissions</h2>
              <form onSubmit={handleSettingsUpdate} className="space-y-6 max-w-2xl">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <p className="text-sm text-gray-500 mb-6">Configure default page access for this role. Saving changes immediately updates and synchronizes all existing and future employees assigned to this role.</p>
                  
                  <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                    <button
                      type="button"
                      onClick={() => setEmployeeRoleTab('admin')}
                      className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors ${
                        employeeRoleTab === 'admin' ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Admin Defaults
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployeeRoleTab('mechanic')}
                      className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors ${
                        employeeRoleTab === 'mechanic' ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      Mechanic Defaults
                    </button>
                  </div>

                  <h3 className="text-lg font-bold mb-4 capitalize">{employeeRoleTab} Default Page Access</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(settingsData.defaultEmployeePermissions?.[employeeRoleTab]?.pagePermissions || {}).map(([page, value]) => (
                      <div key={page} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-sm font-bold capitalize">{page.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <label className="flex items-center cursor-pointer">
                          <div className="relative">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={value}
                              onChange={(e) => handleDefaultPermissionChange(page, e.target.checked)}
                            />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${value ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${value ? 'transform translate-x-4' : ''}`}></div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex justify-end">
                  <button type="submit" disabled={isSaving || !isDirty} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors uppercase tracking-wider text-sm shadow-md">
                    {isSaving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
