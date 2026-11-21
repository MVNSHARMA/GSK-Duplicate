import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Building2, Plus, Wrench, Search, Clock, FileText, Settings, Key, User, 
  MapPin, Phone, Mail, FileClock, Edit2, Shield, Trash2, ArrowRight, Car, X, LayoutTemplate
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTour } from '../../components/tour/TourContext';
import { hasActionPermission } from '../../utils/pageAccess';
import { JOB_CARD_STATUSES } from '../../utils/statusConstants';
import JobCardRow from '../../components/admin/JobCardRow';
import JobCardHistoryModal from '../../components/admin/JobCardHistoryModal';
import { useToast } from '../../components/ui/ToastContext';
import EmptyState from '../../components/ui/EmptyState';
import AddVehicleModal from '../../components/admin/AddVehicleModal';

const Rentals = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { startTour } = useTour();

  const canEdit = hasActionPermission(user, 'jobCards.edit');
  const canDelete = hasActionPermission(user, 'jobCards.delete');
  const canAddVehicle = canEdit || hasActionPermission(user, 'vehicles.create') || hasActionPermission(user, 'rentals.create') || ['admin', 'super_admin'].includes(user?.role);

  // URL state
  const selectedPillId = searchParams.get('companyId') || 'all';

  // Search state
  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedGlobalSearch, setDebouncedGlobalSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [debouncedVehicleSearch, setDebouncedVehicleSearch] = useState('');

  // Data state
  const [companies, setCompanies] = useState([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [selectedCompanyObj, setSelectedCompanyObj] = useState(null);

  // Job Cards (All Companies View)
  const [activeJobCards, setActiveJobCards] = useState([]);
  const [completedJobCards, setCompletedJobCards] = useState([]);
  const [isLoadingAllJobs, setIsLoadingAllJobs] = useState(false);

  // Individual Company View Data
  const [vehicles, setVehicles] = useState([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [companyJobCards, setCompanyJobCards] = useState([]);
  const [companyJobCardsTotal, setCompanyJobCardsTotal] = useState(0);
  const [isLoadingCompanyJobs, setIsLoadingCompanyJobs] = useState(false);
  const [jobCardsPage, setJobCardsPage] = useState(1);
  
  // JobCardRow props
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [deletingCard, setDeletingCard] = useState({});
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryCardId, setSelectedHistoryCardId] = useState(null);

  // Add Company Modal
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

  // Add Vehicle Modal
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);

  const companiesAbortRef = useRef(null);
  const jobsAbortRef = useRef(null);
  const vehiclesAbortRef = useRef(null);

  // Debouncing
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedGlobalSearch(globalSearch), 300);
    return () => clearTimeout(handler);
  }, [globalSearch]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedVehicleSearch(vehicleSearch), 300);
    return () => clearTimeout(handler);
  }, [vehicleSearch]);

  // Fetch Companies
  const fetchCompanies = useCallback(async (searchQuery = '') => {
    setIsLoadingCompanies(true);
    try {
      if (companiesAbortRef.current) companiesAbortRef.current.abort();
      companiesAbortRef.current = new AbortController();

      const url = `${import.meta.env.VITE_API_URL}/customers?customerType=rental_company&limit=100&search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }, signal: companiesAbortRef.current.signal });
      const data = await res.json();
      if (data.success) {
        setCompanies(data.data);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch companies:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies(debouncedGlobalSearch);
  }, [debouncedGlobalSearch, fetchCompanies]);

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (isSubmittingCompany) return;
    setIsSubmittingCompany(true);
    const fd = new FormData(e.target);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/customers`, {
        method: 'POST', 
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('gsk_token')}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          name: fd.get('name'), 
          email: fd.get('email'), 
          phone: fd.get('phone'), 
          address: fd.get('address'),
          customerType: 'rental_company' 
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Rental company created successfully');
        setShowAddCompany(false);
        fetchCompanies(debouncedGlobalSearch);
        if (data.data?._id) {
          setSearchParams({ companyId: data.data._id });
        }
      } else {
        toast.error(data.error || 'Failed to create rental company');
      }
    } catch (err) {
      toast.error('Network error creating rental company');
    } finally {
      setIsSubmittingCompany(false);
    }
  };

  const handleSaveVehicle = async (vehicleData) => {
    if (isSubmittingVehicle) return;
    setIsSubmittingVehicle(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/vehicles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('gsk_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...vehicleData,
          customerType: 'rental_company'
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Vehicle registered successfully');
        setShowAddVehicle(false);
        fetchCompanyVehicles();
      } else {
        toast.error(data.error || 'Failed to register vehicle');
      }
    } catch (err) {
      toast.error('Network error registering vehicle');
    } finally {
      setIsSubmittingVehicle(false);
    }
  };


  // Set selected company object
  useEffect(() => {
    if (selectedPillId && selectedPillId !== 'all') {
      const comp = companies.find(c => c._id === selectedPillId);
      if (comp) setSelectedCompanyObj(comp);
      else {
        // Fetch manually if not in current search list
        fetch(`${import.meta.env.VITE_API_URL}/customers/${selectedPillId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` } })
          .then(res => res.json())
          .then(data => { if (data.success) setSelectedCompanyObj(data.data); })
          .catch(console.error);
      }
    } else {
      setSelectedCompanyObj(null);
    }
  }, [selectedPillId, companies]);

  // Fetch ALL Companies consolidated Job Cards
  const fetchAllCompaniesJobs = useCallback(async () => {
    setIsLoadingAllJobs(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` };
      if (jobsAbortRef.current) jobsAbortRef.current.abort();
      jobsAbortRef.current = new AbortController();
      const signal = jobsAbortRef.current.signal;

      const [activeRes, completedRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/job-cards?customerType=rental_company&statusNot=Completed&limit=50`, { headers, signal }),
        fetch(`${import.meta.env.VITE_API_URL}/job-cards?customerType=rental_company&status=Completed&limit=50`, { headers, signal })
      ]);
      const activeData = await activeRes.json();
      const completedData = await completedRes.json();
      
      if (activeData.success) setActiveJobCards(activeData.data);
      if (completedData.success) setCompletedJobCards(completedData.data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch all companies jobs', err);
    } finally {
      setIsLoadingAllJobs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPillId === 'all') {
      fetchAllCompaniesJobs();
    }
  }, [selectedPillId, fetchAllCompaniesJobs]);

  // Fetch Individual Company Vehicles
  const fetchCompanyVehicles = useCallback(async () => {
    if (!selectedPillId || selectedPillId === 'all') return;
    setIsLoadingVehicles(true);
    try {
      if (vehiclesAbortRef.current) vehiclesAbortRef.current.abort();
      vehiclesAbortRef.current = new AbortController();

      const url = `${import.meta.env.VITE_API_URL}/vehicles?customerId=${selectedPillId}&limit=50&search=${encodeURIComponent(debouncedVehicleSearch)}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }, signal: vehiclesAbortRef.current.signal });
      const data = await res.json();
      if (data.success) setVehicles(data.data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch vehicles', err);
    } finally {
      setIsLoadingVehicles(false);
    }
  }, [selectedPillId, debouncedVehicleSearch]);

  useEffect(() => {
    if (selectedPillId !== 'all') {
      fetchCompanyVehicles();
    }
  }, [fetchCompanyVehicles, selectedPillId]);

  // Fetch Individual Company Job Cards
  const fetchCompanyJobCards = useCallback(async () => {
    if (!selectedPillId || selectedPillId === 'all') return;
    setIsLoadingCompanyJobs(true);
    try {
      if (jobsAbortRef.current) jobsAbortRef.current.abort();
      jobsAbortRef.current = new AbortController();

      const url = `${import.meta.env.VITE_API_URL}/job-cards?customerId=${selectedPillId}&page=${jobCardsPage}&limit=15`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }, signal: jobsAbortRef.current.signal });
      const data = await res.json();
      if (data.success) {
        setCompanyJobCards(data.data);
        if (data.pagination) setCompanyJobCardsTotal(data.pagination.pages);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch company job cards', err);
    } finally {
      setIsLoadingCompanyJobs(false);
    }
  }, [selectedPillId, jobCardsPage]);

  useEffect(() => {
    if (selectedPillId !== 'all') {
      fetchCompanyJobCards();
    }
  }, [fetchCompanyJobCards, selectedPillId]);

  // Shared Job Card actions
  const handleUpdateStatus = async (id, newStatus, currentStatus) => {
    if (newStatus === currentStatus) return;
    if (newStatus === 'Completed') {
      if (!window.confirm("Are you sure you want to set it to completed, this will reflect a change in inventory. Parts/quantities will be deducted.")) return;
    }

    setUpdatingStatus(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('gsk_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (data.success) {
        const updater = (prev) => prev.map(jc => jc._id === id ? { ...jc, status: data.data.status } : jc);
        if (selectedPillId === 'all') {
            // Need to refetch if moving between active/completed tabs for All Companies view
            fetchAllCompaniesJobs();
        } else {
            setCompanyJobCards(updater);
        }
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      toast.error('An error occurred while updating the status.');
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [id]: false }));
    }
  };

  const deleteCard = async (id) => {
    if (deletingCard[id]) return;
    if (!window.confirm("Are you sure you want to delete this job card?")) return;
    
    setDeletingCard(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/job-cards/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('gsk_token')}` }
      });
      if (!response.ok) {
        toast.error(`Error deleting job card`);
        return;
      }
      if (selectedPillId === 'all') {
          fetchAllCompaniesJobs();
      } else {
          fetchCompanyJobCards();
      }
    } catch (error) {
      toast.error(`Network error: ${error.message}`);
    } finally {
      setDeletingCard(prev => ({ ...prev, [id]: false }));
    }
  };

  const renderJobCardTable = (jobs) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-gray-50/50 border-b border-gray-100">
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID & Date</th>
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rego / VIN</th>
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vehicle</th>
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</th>
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mechanic</th>
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</th>
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Invoice</th>
            <th className="py-3 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(jc => (
            <JobCardRow 
              key={jc._id}
              jc={jc}
              canEdit={canEdit}
              canDelete={canDelete}
              updatingStatus={updatingStatus}
              handleUpdateStatus={handleUpdateStatus}
              deletingCard={deletingCard}
              deleteCard={deleteCard}
              setSelectedHistoryCardId={setSelectedHistoryCardId}
              setHistoryModalOpen={setHistoryModalOpen}
              VALID_STATUSES={JOB_CARD_STATUSES}
            />
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={9} className="p-8">
                <EmptyState icon={Wrench} title="No Job Cards Found" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 min-h-screen overflow-x-hidden">
      
      {/* Header & Global Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
            <LayoutTemplate size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold mb-0.5 text-dark">Rentals</h1>
            <p className="text-slate-500 text-sm">Manage rental companies, their registered vehicles, and associated job cards.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-slate-400" /></div>
            <input type="text" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Filter Companies or Rego..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-primary focus:ring-2 outline-none font-medium text-sm transition-all" />
          </div>
          {canEdit && (
            <button onClick={() => setShowAddCompany(true)} className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-bold shadow-sm shadow-primary/20 flex items-center justify-center gap-2 transition-all">
              <Plus size={16} /> Add Rental Company
            </button>
          )}
        </div>
      </div>

      {/* Company Pills */}
      <div className="mb-6 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto hide-scrollbar">
        <div className="flex gap-2 min-w-max pb-2">
          <button 
            onClick={() => setSearchParams({ companyId: 'all' })}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center shadow-sm ${
              selectedPillId === 'all' 
                ? 'bg-dark text-white ring-2 ring-dark/10' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 hover:border-slate-300'
            }`}
          >
            ALL COMPANIES
          </button>
          {companies.map(company => (
            <button 
              key={company._id}
              onClick={() => setSearchParams({ companyId: company._id })}
              className={`flex flex-col items-start justify-center px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm min-h-[44px] ${
                selectedPillId === company._id 
                  ? 'bg-dark text-white ring-2 ring-dark/10' 
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-2 leading-none">
                {company.name}
              </span>
              {company.matchedVehicle && (
                <span className="text-[10px] text-emerald-400 font-mono mt-1 leading-none">
                  Match: {company.matchedVehicle.registrationNumber}
                </span>
              )}
            </button>
          ))}
          {isLoadingCompanies && <span className="text-sm text-slate-400 px-4 flex items-center">Loading...</span>}
        </div>
      </div>

      {/* ALL COMPANIES VIEW */}
      {selectedPillId === 'all' && (
        <div className="space-y-8">
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></span>
              <h3 className="text-lg font-heading font-bold text-slate-800 tracking-wide">Active Job Cards</h3>
            </div>
            {isLoadingAllJobs ? <p className="text-sm text-slate-500 p-8">Loading...</p> : renderJobCardTable(activeJobCards)}
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-sm shadow-slate-400/20"></span>
              <h3 className="text-lg font-heading font-bold text-slate-800 tracking-wide">Completed Job Cards</h3>
            </div>
            {isLoadingAllJobs ? <p className="text-sm text-slate-500 p-8">Loading...</p> : renderJobCardTable(completedJobCards)}
          </section>
        </div>
      )}

      {/* INDIVIDUAL COMPANY VIEW */}
      {selectedPillId !== 'all' && selectedCompanyObj && (
        <div className="space-y-8">
          
          {/* Company Info */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-heading font-bold text-dark">{selectedCompanyObj.name}</h2>
              <button 
                onClick={() => navigate(`/admin/customers/${selectedCompanyObj._id}`)}
                className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-dark transition-colors flex justify-center items-center gap-2"
              >
                <User size={16} /> View Customer Details
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Phone size={14} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Phone</p>
                  <p className="text-sm font-bold text-slate-700">{selectedCompanyObj.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Mail size={14} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{selectedCompanyObj.email || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <MapPin size={14} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Address</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{selectedCompanyObj.address || 'N/A'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Registered Vehicles */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-heading text-slate-800 tracking-wide font-bold">Registered Vehicles</h3>
                {canAddVehicle && (
                  <button 
                    onClick={() => setShowAddVehicle(true)}
                    className="px-3.5 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-sm shadow-primary/20 flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={14} /> Add Vehicle
                  </button>
                )}
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search vehicles..."
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all font-medium text-slate-600"
                />
              </div>
            </div>

            {isLoadingVehicles ? (
              <p className="text-sm text-slate-500 py-4">Loading vehicles...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {vehicles.map(v => (
                  <div key={v._id} className="border border-slate-200 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                            <div className="font-bold font-heading text-dark text-lg mb-1">{v.year} {v.brand} {v.model}</div>
                            <div className="font-mono text-slate-500 text-xs bg-slate-100 px-2 py-1 rounded inline-block">{v.registrationNumber}</div>
                        </div>
                        {v.status && v.status !== 'Available' && (
                            <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${v.status === 'Rented' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                {v.status}
                            </span>
                        )}
                    </div>
                    {v.vin && <div className="text-xs text-slate-500 mb-4 font-mono truncate">VIN: {v.vin}</div>}
                    <div className="mt-auto pt-4 flex gap-2 border-t border-slate-100">
                        <button 
                            onClick={() => navigate(`/admin/vehicles/${v._id}`)} 
                            className="flex-[1] py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-dark transition-colors flex justify-center items-center"
                        >
                            View
                        </button>
                        <button 
                            onClick={() => navigate(`/admin/job-cards/new?customerId=${selectedCompanyObj._id}&vehicleId=${v._id}`)} 
                            className="flex-[1.5] py-2.5 text-xs font-bold text-white bg-primary rounded-xl shadow-sm hover:bg-primary-dark transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Plus size={14} /> Job Card
                        </button>
                    </div>
                  </div>
                ))}
                {vehicles.length === 0 && (
                  <div className="col-span-full">
                    <EmptyState
                      icon={Car}
                      title="No registered vehicles"
                      description="This rental company does not have any registered vehicles yet."
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Canonical Job Cards */}
          <section>
            <h3 className="text-lg font-heading text-slate-800 tracking-wide font-bold mb-4">Job Cards</h3>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {isLoadingCompanyJobs ? <p className="text-sm text-slate-500 p-8">Loading...</p> : renderJobCardTable(companyJobCards)}
              
              {/* Pagination for company job cards */}
              {!isLoadingCompanyJobs && companyJobCardsTotal > 1 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-sm text-slate-500 font-medium">
                    Page <span className="text-dark font-bold">{jobCardsPage}</span> of <span className="text-dark font-bold">{companyJobCardsTotal}</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setJobCardsPage(prev => Math.max(1, prev - 1))}
                      disabled={jobCardsPage === 1}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setJobCardsPage(prev => Math.min(companyJobCardsTotal, prev + 1))}
                      disabled={jobCardsPage === companyJobCardsTotal}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      )}

      <JobCardHistoryModal 
        isOpen={historyModalOpen} 
        onClose={() => {
          setHistoryModalOpen(false);
          setSelectedHistoryCardId(null);
        }}
        jobCardId={selectedHistoryCardId}
      />

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        isOpen={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
        onSave={handleSaveVehicle}
        isSubmitting={isSubmittingVehicle}
        customerType="rental_company"
        customerName={selectedCompanyObj?.name}
        customerId={selectedCompanyObj?._id}
      />
      {showAddCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold">Add Rental Company</h2>
              <button onClick={() => setShowAddCompany(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddCompany} className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1">Company Name *</label><input required name="name" type="text" className="w-full px-4 py-2.5 rounded-xl border outline-none border-slate-200 focus:border-primary focus:ring-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label><input name="email" type="email" className="w-full px-4 py-2.5 rounded-xl border outline-none border-slate-200 focus:border-primary focus:ring-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Phone *</label><input required name="phone" type="text" className="w-full px-4 py-2.5 rounded-xl border outline-none border-slate-200 focus:border-primary focus:ring-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Address</label><input name="address" type="text" className="w-full px-4 py-2.5 rounded-xl border outline-none border-slate-200 focus:border-primary focus:ring-2" /></div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowAddCompany(false)} disabled={isSubmittingCompany} className="px-4 py-2 font-bold text-sm text-slate-600 hover:text-dark disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isSubmittingCompany} className="px-5 py-2 font-bold text-sm bg-primary hover:bg-primary-dark transition-colors text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isSubmittingCompany ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Rentals;
