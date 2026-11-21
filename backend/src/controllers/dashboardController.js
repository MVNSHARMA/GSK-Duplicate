import { DateTime } from 'luxon';
import { getEffectivePageAccess } from '../middleware/permissions.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import Inventory from '../models/Inventory.js';
import Rental from '../models/RentalServiceEntry.js';
import JobCard from '../models/JobCard.js';
import Invoice from '../models/Invoice.js';
import Sale from '../models/Sale.js';
import Booking from '../models/Booking.js';
import Quote from '../models/Quote.js';
import Contact from '../models/Contact.js';
import ImportTracker from '../models/ImportTracker.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import { auditEventLabel } from '../utils/auditEvents.js';
import { buildFinancialPipeline } from '../services/financialService.js';

const TIMEZONE = 'Australia/Sydney';

// Short-lived in-memory cache for dashboard aggregations (15s TTL),
// automatically invalidated on any successful POST/PUT/PATCH/DELETE request.
const DASHBOARD_CACHE_TTL_MS = 15 * 1000;
const dashboardCache = new Map();

export const invalidateDashboardCache = () => {
    dashboardCache.clear();
};

const getDateBounds = (period, customStart, customEnd) => {
    let start, end;
    const now = DateTime.now().setZone(TIMEZONE);

    switch (period) {
        case 'yesterday':
            start = now.minus({ days: 1 }).startOf('day');
            end = now.minus({ days: 1 }).endOf('day');
            break;
        case '7days':
            start = now.minus({ days: 6 }).startOf('day');
            end = now.endOf('day');
            break;
        case '30days':
            start = now.minus({ days: 29 }).startOf('day');
            end = now.endOf('day');
            break;
        case 'this_month':
            start = now.startOf('month');
            end = now.endOf('month');
            break;
        case 'last_month':
            start = now.minus({ months: 1 }).startOf('month');
            end = now.minus({ months: 1 }).endOf('month');
            break;
        case 'custom':
            if (customStart && customEnd) {
                start = DateTime.fromISO(customStart, { zone: TIMEZONE }).startOf('day');
                end = DateTime.fromISO(customEnd, { zone: TIMEZONE }).endOf('day');
            } else {
                start = now.startOf('day');
                end = now.endOf('day');
            }
            break;
        case 'today':
        default:
            start = now.startOf('day');
            end = now.endOf('day');
    }
    return { startDate: start.toJSDate(), endDate: end.toJSDate() };
};

export const getDashboardStats = async (req, res) => {
    try {
        const { period, customStart, customEnd } = req.query;
        const { startDate, endDate } = getDateBounds(period, customStart, customEnd);
        const effectiveAccess = new Set(getEffectivePageAccess(req.user));
        const cacheKey = `${req.user._id}:${req.user.role}:${[...effectiveAccess].sort().join(',')}:${period || 'today'}:${customStart || ''}:${customEnd || ''}`;
        const now = Date.now();
        const cached = dashboardCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return res.status(200).json(cached.response);
        }

        const trendStart = DateTime.fromJSDate(endDate).setZone(TIMEZONE).minus({ days: 6 }).startOf('day').toJSDate();

        const financialPipelineBase = buildFinancialPipeline({
            matchDate: { $gte: startDate, $lte: endDate },
            type: 'All'
        });

        const financialAggPromise = Invoice.aggregate([
            ...financialPipelineBase,
            {
                $facet: {
                    totals: [
                        {
                            $group: {
                                _id: null,
                                moneyIn: { $sum: '$moneyIn' },
                                moneyOut: { $sum: '$moneyOut' },
                                dealerCarProfit: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ['$type', 'Dealer Car Sale'] },
                                            { $subtract: [{ $ifNull: ['$soldFor', 0] }, { $ifNull: ['$cost', 0] }] },
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    sources: [
                        {
                            $group: {
                                _id: '$type',
                                amount: {
                                    $sum: {
                                        $cond: [
                                            { $gt: ['$moneyIn', 0] }, '$moneyIn', '$moneyOut'
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    trend: [
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: TIMEZONE } },
                                moneyIn: { $sum: '$moneyIn' },
                                moneyOut: { $sum: '$moneyOut' }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ]
                }
            }
        ]);

        const [
            customerAgg,
            vehicleCount,
            bookingAgg,
            quoteAgg,
            jobCardFacetRaw,
            invoiceFacetRaw,
            inventoryFacetRaw,
            importAgg,
            rentalAgg,
            recentAuditLogs,
            unreadNotificationsCount,
            unreadMessagesCount,
            financialsRaw
        ] = await Promise.all([
            // 0: Customers
            Customer.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$customerType', count: { $sum: 1 } } }
            ]),
            // 1: Vehicles Total
            Vehicle.countDocuments({ isActive: true }),
            // 2: Bookings
            Booking.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            // 3: Quotes
            Quote.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            // 4: Job Cards (Status counts + In-Service distinct vehicles + 7-day trend in 1 query)
            JobCard.aggregate([
                { $match: { isActive: true } },
                {
                    $facet: {
                        byStatus: [
                            { $group: { _id: '$status', count: { $sum: 1 } } }
                        ],
                        inServiceVehicles: [
                            { $match: { status: { $in: ['Open', 'In Progress'] }, vehicleId: { $ne: null } } },
                            { $group: { _id: '$vehicleId' } }
                        ],
                        trend: [
                            { $match: { createdAt: { $gte: trendStart, $lte: endDate } } },
                            {
                                $group: {
                                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE } },
                                    count: { $sum: 1 }
                                }
                            },
                            { $sort: { _id: 1 } }
                        ]
                    }
                }
            ]),
            // 5: Invoices (Total Active + Current Period in 1 query)
            Invoice.aggregate([
                { $match: { isActive: true } },
                {
                    $facet: {
                        total: [
                            { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }
                        ],
                        period: [
                            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
                            { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }
                        ]
                    }
                }
            ]),
            // 6: Inventory (Summary + Low Stock Preview in 1 query)
            Inventory.aggregate([
                {
                    $project: {
                        itemName: 1,
                        itemsToProcess: {
                            $filter: {
                                input: { $ifNull: ['$variants', []] },
                                as: 'v',
                                cond: { $eq: ['$$v.isActive', true] }
                            }
                        }
                    }
                },
                { $unwind: '$itemsToProcess' },
                {
                    $facet: {
                        summary: [
                            {
                                $group: {
                                    _id: null,
                                    totalItems: { $sum: 1 },
                                    totalValue: { $sum: { $multiply: [{ $ifNull: ['$itemsToProcess.quantity', 0] }, { $ifNull: ['$itemsToProcess.unitPrice', 0] }] } },
                                    outOfStock: { $sum: { $cond: [{ $lte: [{ $ifNull: ['$itemsToProcess.quantity', 0] }, 0] }, 1, 0] } },
                                    lowStock: { $sum: { $cond: [{ $and: [{ $lte: [{ $ifNull: ['$itemsToProcess.quantity', 0] }, { $ifNull: ['$itemsToProcess.minStockLevel', 0] }] }, { $gt: [{ $ifNull: ['$itemsToProcess.quantity', 0] }, 0] }] }, 1, 0] } }
                                }
                            }
                        ],
                        lowStockItems: [
                            {
                                $match: {
                                    $expr: { $lte: [{ $ifNull: ['$itemsToProcess.quantity', 0] }, { $ifNull: ['$itemsToProcess.minStockLevel', 0] }] },
                                    'itemsToProcess.quantity': { $gt: 0 }
                                }
                            },
                            {
                                $project: {
                                    itemName: { $concat: ['$itemName', ' - ', '$itemsToProcess.name'] },
                                    quantity: { $ifNull: ['$itemsToProcess.quantity', 0] },
                                    minStockLevel: { $ifNull: ['$itemsToProcess.minStockLevel', 0] }
                                }
                            },
                            { $limit: 5 }
                        ]
                    }
                }
            ]),
            // 7: Import Trackers
            ImportTracker.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            // 8: Rentals
            Rental.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            // 9: Recent Activity - Fetched directly from canonical AuditLog
            AuditLog.find().sort({ createdAt: -1 }).limit(15).populate('actor', 'name role').lean(),
            // 10: Unread Notifications
            Notification.countDocuments({ isRead: false, recipient: req.user._id }),
            // 11: Unread Messages
            Contact.countDocuments({ status: 'Unread', isActive: true }),
            // 12: Financial Dashboard Data
            financialAggPromise
        ]);

        const jobCardFacet = jobCardFacetRaw[0] || { byStatus: [], inServiceVehicles: [], trend: [] };
        const jobCardAgg = jobCardFacet.byStatus;
        const inServiceVehicles = jobCardFacet.inServiceVehicles;
        const jobCardTrendAgg = jobCardFacet.trend;

        const invoiceFacet = invoiceFacetRaw[0] || { total: [], period: [] };
        const invoiceTotalAgg = invoiceFacet.total;
        const invoicePeriodAgg = invoiceFacet.period;

        const inventoryFacet = inventoryFacetRaw[0] || { summary: [], lowStockItems: [] };
        const inventoryAgg = inventoryFacet.summary;
        const lowStockItems = inventoryFacet.lowStockItems;
        const salesAgg = [];
        const salesCount = 0;

        // Process Aggregations
        const reduceAgg = (agg, keyField = '_id', valField = 'count') => 
            agg.reduce((acc, curr) => { acc[curr[keyField] || 'Total'] = curr[valField]; return acc; }, {});

        const customers = reduceAgg(customerAgg);
        customers.Total = Object.values(customers).reduce((a, b) => a + b, 0);

        const bookings = reduceAgg(bookingAgg);
        const quotes = reduceAgg(quoteAgg);
        const jobCards = reduceAgg(jobCardAgg);
        const imports = reduceAgg(importAgg);
        const rentals = reduceAgg(rentalAgg);
        
        // Invoices
        const invoiceTotalCount = reduceAgg(invoiceTotalAgg);
        const invoiceTotalAmount = reduceAgg(invoiceTotalAgg, '_id', 'amount');
        const invoicePeriodCount = reduceAgg(invoicePeriodAgg);
        const invoicePeriodAmount = reduceAgg(invoicePeriodAgg, '_id', 'amount');

        // Process Recent Activity directly from AuditLogs
        let recentActivity = recentAuditLogs.map(log => {
            let link = '/admin/audit-logs';
            switch (log.entityType) {
                case 'JobCard': link = `/admin/job-cards/${log.entityId}`; break;
                case 'Invoice': link = '/admin/invoices'; break;
                case 'Customer': link = `/admin/customers/${log.entityId}`; break;
                case 'Vehicle': link = `/admin/vehicles/${log.entityId}`; break;
                case 'PurchaseOrder': link = `/admin/purchase-orders/${log.entityId}`; break;
                case 'Booking': link = '/admin/communications?tab=bookings'; break;
                case 'Quote': link = '/admin/communications?tab=quotes'; break;
                case 'Contact': link = '/admin/communications?tab=messages'; break;
                case 'Inventory': link = '/admin/inventory'; break;
            }

            let actorName = log.actorName || (log.actor ? log.actor.name : 'System');
            let actorRole = log.actorRole || (log.actor ? log.actor.role : 'system');
            
            // Format type from action or entityType
            let typeStr = log.action ? log.action.replace(/_/g, ' ') : (log.entityType || 'Action');
            
            // Generate contextual title using the shared audit utility
            const actionLabel = auditEventLabel(log.action);
            const title = log.description || (actionLabel !== log.action ? actionLabel : `Action performed on ${log.entityType || 'Entity'}`);

            return {
                id: log._id,
                type: typeStr,
                title: title,
                date: log.createdAt,
                link,
                actor: { name: actorName, role: actorRole }
            };
        });

        // Format Financials
        const rawFin = financialsRaw[0] || { totals: [], sources: [], trend: [] };
        const financialTotals = rawFin.totals[0] || { moneyIn: 0, moneyOut: 0, dealerCarProfit: 0 };
        const financials = {
            totals: {
                moneyIn: financialTotals.moneyIn || 0,
                moneyOut: financialTotals.moneyOut || 0,
                netMovement: (financialTotals.moneyIn || 0) - (financialTotals.moneyOut || 0),
                dealerCarProfit: financialTotals.dealerCarProfit || 0
            },
            sources: rawFin.sources.map(s => ({ type: s._id, amount: s.amount })),
            trend: rawFin.trend.map(t => ({ date: t._id, moneyIn: t.moneyIn, moneyOut: t.moneyOut }))
        };

        // Calculate trends
        const salesTrendAgg = []; // Legacy POS zeroed out

        // Secure Financial Data if mechanic
        const salesRevenuePeriod = salesAgg[0]?.amount || 0;
        const invSummary = inventoryAgg[0] || { totalItems: 0, totalValue: 0, outOfStock: 0, lowStock: 0 };

        const payload = {
            customers,
            vehicles: {
                total: vehicleCount,
                inService: inServiceVehicles.length
            },
            serviceRequests: bookings,
            quotes,
            jobCards,
            invoices: {
                total: {
                    count: Object.values(invoiceTotalCount).reduce((a, b) => a + b, 0),
                    outstandingAmount: invoiceTotalAmount['Unpaid'] || 0
                },
                period: {
                    count: Object.values(invoicePeriodCount).reduce((a, b) => a + b, 0),
                    amount: Object.values(invoicePeriodAmount).reduce((a, b) => a + b, 0)
                }
            },
            sales: {
                periodAmount: salesRevenuePeriod,
                periodCount: salesCount
            },
            inventory: {
                totalItems: invSummary.totalItems,
                lowStock: invSummary.lowStock,
                outOfStock: invSummary.outOfStock,
                totalValue: invSummary.totalValue,
                lowStockPreview: lowStockItems
            },
            imports,
            rentals,
            communications: {
                unreadMessages: unreadMessagesCount,
                pendingQuotes: quotes['Pending'] || 0,
                newServiceRequests: bookings['Pending'] || 0,
                unreadNotifications: unreadNotificationsCount
            },
            recentActivity,
            trends: {
                sales: salesTrendAgg,
                jobCards: jobCardTrendAgg
            },
            financials
        };

        // RBAC: Nullify financial data based on actual user permissions
        if (!effectiveAccess.has('invoices')) {
            payload.invoices.total.count = null;
            payload.invoices.total.outstandingAmount = null;
            payload.invoices.period.count = null;
            payload.invoices.period.amount = null;
        }
        
        if (!effectiveAccess.has('dailySales')) {
            payload.sales.periodAmount = null;
            payload.sales.periodCount = null;
            payload.trends.sales = null;
            payload.financials = null;
        }

        if (!effectiveAccess.has('inventory')) {
            payload.inventory.totalValue = null;
        }

        const responsePayload = { success: true, data: payload, dateBounds: { startDate, endDate } };
        dashboardCache.set(cacheKey, {
            response: responsePayload,
            expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS
        });

        res.status(200).json(responsePayload);
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ success: false, error: "Server Error fetching dashboard stats" });
    }
};
