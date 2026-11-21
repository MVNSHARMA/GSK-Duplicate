import { DateTime } from 'luxon';
import Invoice from '../models/Invoice.js';
import DealerCar from '../models/DealerCar.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Sale from '../models/Sale.js'; // Legacy POS model
import { buildFinancialPipeline } from '../services/financialService.js';

// @desc    Get paginated and filtered daily sales (Financial Overview)
// @route   GET /api/daily-sales
// @access  Private (Admin/SuperAdmin)
export const getDailySales = async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            type = 'All', 
            search = '', 
            page = 1, 
            limit = 25 
        } = req.query;

        const safePage = Math.max(1, parseInt(page));
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit)));
        
        let matchDate = {};
        if (startDate || endDate) {
            matchDate = {};
            if (startDate) {
                matchDate.$gte = DateTime.fromISO(startDate, { zone: 'Australia/Sydney' }).startOf('day').toJSDate();
            }
            if (endDate) {
                matchDate.$lte = DateTime.fromISO(endDate, { zone: 'Australia/Sydney' }).endOf('day').toJSDate();
            }
        }

        const pipeline = buildFinancialPipeline({ matchDate, type, search });

        pipeline.push({ $sort: { date: -1 } });

        pipeline.push({
            $facet: {
                metadata: [ { $count: "total" } ],
                data: [ { $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit } ],
                kpi: [
                    {
                        $group: {
                            _id: null,
                            totalMoneyIn: { $sum: '$moneyIn' },
                            totalMoneyOut: { $sum: '$moneyOut' },
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
                ]
            }
        });

        const [results, outstandingInvoices] = await Promise.all([
            Invoice.aggregate(pipeline),
            Invoice.aggregate([
                { $match: { status: { $in: ['Unpaid', 'Partially Paid'] }, isActive: true } },
                { $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalAmount: { $sum: { $subtract: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$amountPaid', 0] }] } }
                }}
            ])
        ]);

        const total = results[0].metadata[0]?.total || 0;
        const data = results[0].data;
        const kpi = results[0].kpi[0] || { totalMoneyIn: 0, totalMoneyOut: 0, dealerCarProfit: 0 };
        const outstanding = outstandingInvoices[0] || { count: 0, totalAmount: 0 };

        res.status(200).json({
            success: true,
            data,
            metrics: {
                moneyIn: kpi.totalMoneyIn,
                moneyOut: kpi.totalMoneyOut,
                netMovement: kpi.totalMoneyIn - kpi.totalMoneyOut,
                dealerCarProfit: kpi.dealerCarProfit,
                outstandingCount: outstanding.count,
                outstandingAmount: outstanding.totalAmount
            },
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                pages: Math.ceil(total / safeLimit)
            }
        });

    } catch (error) {
        console.error("Error fetching daily sales:", error);
        res.status(500).json({ success: false, error: "Server Error fetching daily sales" });
    }
};

// @desc    Get single transaction source details
// @route   GET /api/daily-sales/:sourceType/:sourceId
// @access  Private (Admin/SuperAdmin)
export const getTransactionDetails = async (req, res) => {
    try {
        const { sourceType, sourceId } = req.params;

        let details = null;

        if (sourceType === 'Invoice') {
            details = await Invoice.findById(sourceId)
                .populate('customerId', 'name email phone')
                .populate('vehicleId', 'make model year registrationNumber')
                .populate('jobCardId', 'status jobCardNo')
                .populate('partsAndLabour.inventoryId', 'itemName sku category');
        } else if (sourceType === 'InventoryTransaction') {
            details = await InventoryTransaction.findById(sourceId)
                .populate('inventoryId', 'itemName sku')
                .populate({
                    path: 'purchaseOrderId',
                    populate: { path: 'supplierId', select: 'supplierName' }
                });
        } else if (sourceType === 'DealerCar') {
            details = await DealerCar.findById(sourceId);
        } else if (sourceType === 'Sale') {
            details = await Sale.findById(sourceId)
                .populate('customerId', 'name email')
                .populate('items.inventoryId', 'itemName category');
        } else {
            return res.status(400).json({ success: false, error: "Unknown source type" });
        }

        if (!details) {
            return res.status(404).json({ success: false, error: "Source record not found" });
        }

        res.status(200).json({
            success: true,
            data: details
        });
    } catch (error) {
        console.error("Error fetching transaction details:", error);
        res.status(500).json({ success: false, error: "Server Error fetching transaction details" });
    }
};
