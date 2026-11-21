import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    Calendar, DollarSign, TrendingUp, TrendingDown, ArrowRight,
    Search, Filter, ChevronLeft, ChevronRight, Eye, RefreshCw, AlertCircle, X,
    Car, FileText, ShoppingBag
} from 'lucide-react';
import { Link } from 'react-router-dom';


export default function DailySales() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState([]);
    const [metrics, setMetrics] = useState({
        moneyIn: 0,
        moneyOut: 0,
        netMovement: 0,
        dealerCarProfit: 0,
        outstandingCount: 0,
        outstandingAmount: 0
    });
    
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
    
    const [filterPreset, setFilterPreset] = useState('Today');
    const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
    const [typeFilter, setTypeFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchInput, setSearchInput] = useState('');
    
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [transactionDetails, setTransactionDetails] = useState(null);

    // Filter Options
    const datePresets = ['Today', 'Yesterday', 'This Week', 'This Month', 'All Time', 'Custom'];
    const typeOptions = ['All', 'Invoice Paid', 'Inventory Purchase', 'Dealer Car Sale', 'Dealer Car Purchase', 'Legacy POS Sale'];

    const getDateRange = useCallback((preset) => {
        const now = new Date();
        
        // Helper to format as YYYY-MM-DD string in Sydney time
        const getSydneyDateString = (date) => {
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Australia/Sydney',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(date);
        };

        const getSydneyStart = (date) => new Date(`${getSydneyDateString(date)}T00:00:00.000+10:00`); // Approximation, +11 for AEDT but server parses correctly if we just send the range bounds as ISO. Wait, if we send ISO, backend will parse it to UTC.
        // Better: Just send the date strings (YYYY-MM-DD) and let backend handle it, or send precise ISO bounds.
        // Actually, just sending precise bounds:
        const createBounds = (d) => {
            const dateStr = getSydneyDateString(d);
            // Constructing start of day and end of day in local time. 
            // In Australia/Sydney, the offset varies. It's safer to just let the backend parse, but our backend expects ISO string.
            // Let's create a Date object in the browser's timezone that corresponds to 00:00 and 23:59 of the Sydney day.
            // It's tricky to do perfectly without a library, but since it's just an admin dashboard, a decent approximation is fine:
            return {
                startDate: new Date(`${dateStr}T00:00:00`), 
                endDate: new Date(`${dateStr}T23:59:59.999`)
            };
        };

        switch (preset) {
            case 'Today':
                return createBounds(now);
            case 'Yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                return createBounds(yesterday);
            case 'This Week':
                const startOfWeek = new Date(now);
                const day = startOfWeek.getDay();
                const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
                startOfWeek.setDate(diff);
                const weekBounds = createBounds(startOfWeek);
                const todayBounds = createBounds(now);
                return { startDate: weekBounds.startDate, endDate: todayBounds.endDate };
            case 'This Month':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const monthBounds = createBounds(startOfMonth);
                const todayBounds2 = createBounds(now);
                return { startDate: monthBounds.startDate, endDate: todayBounds2.endDate };
            case 'All Time':
                return { startDate: null, endDate: null };
            default:
                return { startDate: null, endDate: null };
        }
    }, []);

    const abortControllerRef = useRef(null);

    const fetchDailySales = useCallback(async (page = pagination.page) => {
        setLoading(true);
        setError(null);
        try {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            abortControllerRef.current = new AbortController();

            let start = null;
            let end = null;
            
            if (filterPreset === 'Custom') {
                if (customRange.startDate) start = new Date(customRange.startDate).toISOString();
                if (customRange.endDate) end = new Date(customRange.endDate).toISOString();
            } else {
                const range = getDateRange(filterPreset);
                if (range.startDate) start = range.startDate.toISOString();
                if (range.endDate) end = range.endDate.toISOString();
            }

            const params = {
                page,
                limit: pagination.limit,
                type: typeFilter,
                search: searchTerm,
            };
            
            if (start) params.startDate = start;
            if (end) params.endDate = end;

            const token = localStorage.getItem('gsk_token');
            const queryParams = new URLSearchParams(params).toString();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/daily-sales?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: abortControllerRef.current.signal
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to load financial data');
            }
            const responseData = await response.json();
            setData(responseData.data);
            setMetrics(responseData.metrics);
            setPagination(responseData.pagination);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error fetching daily sales:', err);
                setError(err.message || 'Failed to load financial data');
            }
        } finally {
            setLoading(false);
        }
    }, [filterPreset, customRange, typeFilter, searchTerm, pagination.limit, getDateRange]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchTerm(searchInput);
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 500);
        return () => clearTimeout(handler);
    }, [searchInput]);

    useEffect(() => {
        fetchDailySales(pagination.page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterPreset, typeFilter, searchTerm, pagination.page]);

    // Handle Custom Date Search specifically on a button click or when both dates are set
    useEffect(() => {
        if (filterPreset === 'Custom' && customRange.startDate && customRange.endDate) {
            fetchDailySales(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customRange.startDate, customRange.endDate]);

    const handleFilterChange = (preset) => {
        setFilterPreset(preset);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleTypeChange = (e) => {
        setTypeFilter(e.target.value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const openDetails = async (transaction) => {
        setSelectedTransaction(transaction);
        setDetailsModalOpen(true);
        setDetailsLoading(true);
        setTransactionDetails(null);
        try {
            const token = localStorage.getItem('gsk_token');
            const response = await fetch(`${import.meta.env.VITE_API_URL}/daily-sales/${transaction.sourceType}/${transaction.sourceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch details');
            const responseData = await response.json();
            setTransactionDetails(responseData.data);
        } catch (error) {
            console.error('Error fetching transaction details:', error);
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetails = () => {
        setDetailsModalOpen(false);
        setSelectedTransaction(null);
        setTransactionDetails(null);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD'
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Intl.DateTimeFormat('en-AU', {
                timeZone: 'Australia/Sydney',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(new Date(dateString));
        } catch (e) {
            return dateString;
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'Invoice Paid': return <FileText className="h-5 w-5 text-blue-500" />;
            case 'Inventory Purchase': return <ShoppingBag className="h-5 w-5 text-orange-500" />;
            case 'Dealer Car Purchase': return <Car className="h-5 w-5 text-purple-500" />;
            case 'Dealer Car Sale': return <Car className="h-5 w-5 text-green-500" />;
            case 'Legacy POS Sale': return <DollarSign className="h-5 w-5 text-gray-500" />;
            default: return <DollarSign className="h-5 w-5 text-gray-500" />;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Daily Sales & Financial Overview</h1>
                    <p className="text-sm text-gray-500 mt-1">Read-only observational layer for authoritative financial activity.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fetchDailySales()}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col lg:flex-row gap-4 items-end">
                    <div className="w-full lg:w-1/3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search ref, desc, customer..."
                                className="pl-10 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="w-full lg:w-auto flex-1 flex flex-wrap gap-2">
                        <label className="block text-sm font-medium text-gray-700 w-full mb-1">Date Range</label>
                        <div className="flex flex-wrap gap-2">
                            {datePresets.map(preset => (
                                <button
                                    key={preset}
                                    onClick={() => handleFilterChange(preset)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        filterPreset === preset 
                                        ? 'bg-red-50 text-red-600 border border-red-200' 
                                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filterPreset === 'Custom' && (
                        <div className="w-full lg:w-auto flex items-center gap-2">
                            <input
                                type="date"
                                value={customRange.startDate}
                                onChange={(e) => setCustomRange({...customRange, startDate: e.target.value})}
                                className="p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                            />
                            <span className="text-gray-500">to</span>
                            <input
                                type="date"
                                value={customRange.endDate}
                                onChange={(e) => setCustomRange({...customRange, endDate: e.target.value})}
                                className="p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-red-500"
                            />
                        </div>
                    )}

                    <div className="w-full lg:w-1/4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                        <select
                            value={typeFilter}
                            onChange={handleTypeChange}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        >
                            {typeOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Money In</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 animate-pulse rounded mt-1"></div>
                        ) : (
                            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.moneyIn)}</h3>
                        )}
                    </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                        <TrendingDown className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Money Out</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 animate-pulse rounded mt-1"></div>
                        ) : (
                            <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.moneyOut)}</h3>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Net Movement</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 animate-pulse rounded mt-1"></div>
                        ) : (
                            <h3 className={`text-2xl font-bold ${metrics.netMovement >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {formatCurrency(metrics.netMovement)}
                            </h3>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 relative group">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                        <Car className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Dealer Car Profit</p>
                        {loading ? (
                            <div className="h-7 w-24 bg-gray-200 animate-pulse rounded mt-1"></div>
                        ) : (
                            <h3 className={`text-2xl font-bold ${metrics.dealerCarProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(metrics.dealerCarProfit)}
                            </h3>
                        )}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-2 bg-gray-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center pointer-events-none">
                        Workshop COGS and workshop profit are not included because the current inventory system does not maintain a reliable historical inventory cost basis. Profit calculated solely from Dealer Cars sold during the selected period.
                    </div>
                </div>
            </div>

            {/* Outstanding Summary */}
            {metrics.outstandingCount > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-orange-800">
                        <AlertCircle className="h-5 w-5" />
                        <div>
                            <span className="font-medium">Outstanding Invoices: </span>
                            <span>{metrics.outstandingCount} invoices pending payment ({formatCurrency(metrics.outstandingAmount)}). Not included in Money In.</span>
                        </div>
                    </div>
                    <Link to="/admin/invoices" className="text-orange-700 hover:text-orange-900 font-medium text-sm flex items-center gap-1">
                        View Invoices <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            )}

            {/* Transactions Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {error && (
                    <div className="p-4 bg-red-50 text-red-600 border-b border-red-100 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        {error}
                    </div>
                )}
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type & Ref</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Money In</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Money Out</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Net</th>
                                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div></td>
                                        <td className="py-4 px-6"><div className="h-8 bg-gray-200 rounded w-16 mx-auto"></div></td>
                                    </tr>
                                ))
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Calendar className="h-12 w-12 text-gray-300 mb-3" />
                                            <p className="text-lg font-medium">No financial transactions for this period.</p>
                                            <p className="text-sm">Try adjusting your filters or date range.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((tx) => (
                                    <tr key={tx._id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6 text-sm text-gray-600">
                                            {formatDate(tx.date)}
                                            {tx.isLegacyFallback && (
                                                <span className="block text-xs text-orange-500 italic mt-0.5">Estimated Date</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                {getIcon(tx.type)}
                                                <div>
                                                    <span className="block text-sm font-medium text-gray-900">{tx.type}</span>
                                                    <span className="block text-xs text-gray-500">Ref: {tx.reference}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-600 max-w-[200px] truncate" title={tx.description}>
                                            {tx.description}
                                        </td>
                                        <td className="py-4 px-6 text-sm font-medium text-right text-green-600">
                                            {tx.moneyIn > 0 ? formatCurrency(tx.moneyIn) : '-'}
                                        </td>
                                        <td className="py-4 px-6 text-sm font-medium text-right text-red-600">
                                            {tx.moneyOut > 0 ? formatCurrency(tx.moneyOut) : '-'}
                                        </td>
                                        <td className="py-4 px-6 text-sm font-bold text-right text-gray-900">
                                            {formatCurrency(tx.net)}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <button
                                                onClick={() => openDetails(tx)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                            >
                                                <Eye className="h-4 w-4" />
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            Showing page {pagination.page} of {pagination.pages} ({pagination.total} total)
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={pagination.page === 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                className="p-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                disabled={pagination.page === pagination.pages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                className="p-2 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {detailsModalOpen && selectedTransaction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        
                        {/* Header (Non-scrolling) */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Transaction Details</h2>
                                <p className="text-sm text-gray-500">{selectedTransaction.type}</p>
                            </div>
                            <button 
                                onClick={closeDetails}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="h-6 w-6 text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>

                        {/* Body (Scrolling) */}
                        <div className="p-6 overflow-y-auto flex-1 min-h-0 bg-gray-50/30">
                            {detailsLoading ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                                </div>
                            ) : transactionDetails ? (
                                <div className="space-y-6">
                                    
                                    {/* Primary Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white p-4 rounded-xl border border-gray-100">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Date</p>
                                            <p className="font-medium text-gray-900">{formatDate(selectedTransaction.date)}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-100">
                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Net Amount</p>
                                            <p className={`font-bold text-lg ${selectedTransaction.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(selectedTransaction.net)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Specific Details based on Source Type */}
                                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                        
                                        {/* INVOICE */}
                                        {selectedTransaction.sourceType === 'Invoice' && (
                                            <div className="divide-y divide-gray-100">
                                                <div className="p-4 grid grid-cols-2 gap-y-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Invoice No</p>
                                                        <p className="font-medium">{transactionDetails.invoiceNo}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Status</p>
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            {transactionDetails.status}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Customer</p>
                                                        <p className="font-medium">{transactionDetails.customerId?.name || 'N/A'}</p>
                                                        <p className="text-sm text-gray-500">{transactionDetails.customerId?.email}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Vehicle</p>
                                                        <p className="font-medium">{transactionDetails.vehicleId ? `${transactionDetails.vehicleId.make} ${transactionDetails.vehicleId.model}` : 'N/A'}</p>
                                                        {transactionDetails.vehicleId && <p className="text-sm text-gray-500">{transactionDetails.vehicleId.registrationNumber}</p>}
                                                    </div>
                                                    {transactionDetails.jobCardId && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Job Card Ref</p>
                                                            <p className="font-medium">{transactionDetails.jobCardId.jobCardNo || transactionDetails.jobCardId._id}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-4 bg-gray-50">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm text-gray-600">Subtotal</span>
                                                        <span className="font-medium">{formatCurrency(transactionDetails.subtotal)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm text-gray-600">GST ({transactionDetails.gstRate || 0}%)</span>
                                                        <span className="font-medium">{formatCurrency(transactionDetails.gstAmount)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                                                        <span>Total Amount</span>
                                                        <span>{formatCurrency(transactionDetails.totalAmount)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* INVENTORY TRANSACTION */}
                                        {selectedTransaction.sourceType === 'InventoryTransaction' && (
                                            <div className="p-4 space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">PO Number</p>
                                                        <p className="font-medium">{transactionDetails.purchaseOrderId?.purchaseOrderNumber || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Supplier</p>
                                                        <p className="font-medium">{transactionDetails.purchaseOrderId?.supplierId?.supplierName || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Item</p>
                                                        <p className="font-medium">{transactionDetails.inventoryId?.itemName}</p>
                                                        <p className="text-sm text-gray-500">SKU: {transactionDetails.inventoryId?.sku || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Received Qty</p>
                                                        <p className="font-medium">{transactionDetails.quantity}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Unit Purchase Price</p>
                                                        <p className="font-medium">{formatCurrency(selectedTransaction.unitPurchasePrice)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* DEALER CAR */}
                                        {selectedTransaction.sourceType === 'DealerCar' && (
                                            <div className="p-4 space-y-4">
                                                <div className="grid grid-cols-2 gap-y-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Vehicle</p>
                                                        <p className="font-medium">{transactionDetails.make} {transactionDetails.model} ({transactionDetails.year})</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Registration / VIN</p>
                                                        <p className="font-medium">{transactionDetails.registrationNumber || 'N/A'}</p>
                                                        <p className="text-sm text-gray-500">{transactionDetails.vin || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Purchase Date</p>
                                                        <p className="font-medium">{formatDate(transactionDetails.purchaseDate)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Purchase Cost</p>
                                                        <p className="font-medium text-red-600">{formatCurrency(transactionDetails.cost)}</p>
                                                    </div>
                                                    
                                                    {transactionDetails.status === 'Sold' && (
                                                        <>
                                                            <div>
                                                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Sold Date</p>
                                                                <p className="font-medium">{formatDate(transactionDetails.soldDate)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Sold For</p>
                                                                <p className="font-medium text-green-600">{formatCurrency(transactionDetails.soldFor)}</p>
                                                            </div>
                                                            <div className="col-span-2 mt-2 pt-4 border-t border-gray-100">
                                                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Buyer Snapshot</p>
                                                                <p className="font-medium">{transactionDetails.buyerName || 'N/A'}</p>
                                                                <p className="text-sm text-gray-600">{transactionDetails.buyerPhone} • {transactionDetails.buyerEmail}</p>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* LEGACY POS */}
                                        {selectedTransaction.sourceType === 'Sale' && (
                                            <div className="p-4 space-y-4">
                                                <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded">This is a legacy Point of Sale transaction.</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Payment Method</p>
                                                        <p className="font-medium">{transactionDetails.paymentMethod}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Total</p>
                                                        <p className="font-medium">{formatCurrency(transactionDetails.totalAmount)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    Could not load transaction details.
                                </div>
                            )}
                        </div>

                        {/* Footer (View Original) */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            {selectedTransaction.sourceType === 'Invoice' && (
                                <Link to={`/admin/invoices/${selectedTransaction.sourceId}`} className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                                    View Invoice <ArrowRight className="h-4 w-4" />
                                </Link>
                            )}
                            {selectedTransaction.sourceType === 'InventoryTransaction' && transactionDetails?.purchaseOrderId?._id && (
                                <Link to={`/admin/purchase-orders/${transactionDetails.purchaseOrderId._id}`} className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                                    View Purchase Order <ArrowRight className="h-4 w-4" />
                                </Link>
                            )}
                            {selectedTransaction.sourceType === 'DealerCar' && (
                                <Link to="/admin/dealer-cars" className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                                    View Dealer Cars <ArrowRight className="h-4 w-4" />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
