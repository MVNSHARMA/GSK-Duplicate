import { escapeRegex } from '../utils/sanitize.js';

export const buildFinancialPipeline = ({ matchDate = {}, type = 'All', search = '' }) => {
    const pipeline = [];
    const safeSearch = search ? escapeRegex(search.trim()) : '';

    // 1. INVOICE MATCH & PROJECT
    let invoiceMatch = { status: 'Paid' };
    if (safeSearch) {
        invoiceMatch.$or = [
            { invoiceNo: { $regex: safeSearch, $options: 'i' } }
        ];
    }

    if (Object.keys(matchDate).length > 0) {
        invoiceMatch.$or = invoiceMatch.$or ? invoiceMatch.$or.map(cond => ({
            $and: [
                cond,
                {
                    $or: [
                        { paidAt: matchDate },
                        { paidAt: null, updatedAt: matchDate },
                        { paidAt: { $exists: false }, updatedAt: matchDate }
                    ]
                }
            ]
        })) : [
            {
                $or: [
                    { paidAt: matchDate },
                    { paidAt: null, updatedAt: matchDate },
                    { paidAt: { $exists: false }, updatedAt: matchDate }
                ]
            }
        ];
    }

    const invoicePipeline = [
        { $match: invoiceMatch },
        {
            $addFields: {
                resolvedTotal: {
                    $ifNull: [
                        '$totalAmount',
                        {
                            $reduce: {
                                input: { $ifNull: ['$partsAndLabour', []] },
                                initialValue: 0,
                                in: {
                                    $add: [
                                        '$$value',
                                        {
                                            $multiply: [
                                                { $ifNull: ['$$this.qty', 1] },
                                                { $ifNull: ['$$this.price', 0] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    ]
                }
            }
        },
        { $project: {
            _id: { $concat: [{ $toString: '$_id' }, '_invoice'] },
            type: 'Invoice Paid',
            sourceType: 'Invoice',
            sourceId: '$_id',
            reference: '$invoiceNo',
            date: { $ifNull: ['$paidAt', '$updatedAt'] },
            description: { $concat: ['Invoice ', '$invoiceNo'] },
            moneyIn: '$resolvedTotal',
            moneyOut: { $literal: 0 },
            net: '$resolvedTotal',
            isLegacyFallback: { $cond: [{ $ifNull: ['$paidAt', false] }, false, true] },
            invoiceStatus: '$status',
            totalAmount: '$resolvedTotal'
        }}
    ];

    if (type === 'All' || type === 'Invoice Paid') {
        pipeline.push(...invoicePipeline);
    } else {
        pipeline.push({ $match: { _id: null } });
    }

    // 2. INVENTORY PURCHASE
    // 2. INVENTORY PURCHASE
    if (type === 'All' || type === 'Inventory Purchase') {
        const invMatch = {
            type: 'PURCHASE_RECEIPT'
        };

        if (Object.keys(matchDate).length > 0) {
            invMatch.createdAt = matchDate;
        }

        pipeline.push({
            $unionWith: {
                coll: 'inventorytransactions',
                pipeline: [
                    { $match: invMatch },

                    {
                        $lookup: {
                            from: 'purchaseorders',
                            localField: 'purchaseOrderId',
                            foreignField: '_id',
                            as: 'po'
                        }
                    },

                    {
                        $unwind: {
                            path: '$po',
                            preserveNullAndEmptyArrays: true
                        }
                    },

                    {
                        $project: {
                            _id: {
                                $concat: [
                                    { $toString: '$_id' },
                                    '_inv'
                                ]
                            },

                            type: 'Inventory Purchase',

                            sourceType: 'InventoryTransaction',

                            sourceId: '$_id',

                            reference: {
                                $ifNull: [
                                    '$po.purchaseOrderNumber',
                                    'Direct Receipt'
                                ]
                            },

                            date: '$createdAt',

                            description: {
                                $concat: [
                                    'Received ',
                                    {
                                        $toString: {
                                            $ifNull: ['$quantity', 0]
                                        }
                                    },
                                    ' item(s)'
                                ]
                            },

                            moneyIn: {
                                $literal: 0
                            },

                            moneyOut: {
                                $multiply: [
                                    {
                                        $ifNull: ['$quantity', 0]
                                    },
                                    {
                                        $ifNull: ['$unitPurchasePrice', 0]
                                    }
                                ]
                            },

                            net: {
                                $multiply: [
                                    {
                                        $multiply: [
                                            {
                                                $ifNull: ['$quantity', 0]
                                            },
                                            {
                                                $ifNull: ['$unitPurchasePrice', 0]
                                            }
                                        ]
                                    },
                                    -1
                                ]
                            },

                            poId: '$po._id',

                            quantity: '$quantity',

                            unitPurchasePrice: '$unitPurchasePrice',

                            inventoryId: '$inventoryId',

                            variantId: '$variantId'
                        }
                    }
                ]
            }
        });
        }
        // 3. DEALER CAR PURCHASE
        if (type === 'All' || type === 'Dealer Car Purchase') {
            let dcPurchaseMatch = { status: { $in: ['In Stock', 'Sold'] } };
            if (Object.keys(matchDate).length > 0) {
                dcPurchaseMatch.purchaseDate = matchDate;
            }
            if (safeSearch) {
                dcPurchaseMatch.$or = [
                    { registrationNumber: { $regex: safeSearch, $options: 'i' } },
                    { make: { $regex: safeSearch, $options: 'i' } },
                    { model: { $regex: safeSearch, $options: 'i' } },
                    { dealerName: { $regex: safeSearch, $options: 'i' } }
                ];
            }
            pipeline.push({
                $unionWith: {
                    coll: 'dealercars',
                    pipeline: [
                        { $match: dcPurchaseMatch },
                        { $project: {
                            _id: { $concat: [{ $toString: '$_id' }, '_dcpurchase'] },
                            type: 'Dealer Car Purchase',
                            sourceType: 'DealerCar',
                            sourceId: '$_id',
                            reference: { $ifNull: ['$registrationNumber', 'N/A'] },
                            date: '$purchaseDate',
                            description: { $concat: ['Purchase ', { $ifNull: ['$make', ''] }, ' ', { $ifNull: ['$model', ''] }] },
                            moneyIn: { $literal: 0 },
                            moneyOut: { $ifNull: ['$cost', 0] },
                            net: { $multiply: [{ $ifNull: ['$cost', 0] }, -1] },
                            cost: '$cost'
                        }}
                    ]
                }
            });
        }

    // 4. DEALER CAR SALE
    if (type === 'All' || type === 'Dealer Car Sale') {
        let dcSaleMatch = { status: 'Sold' };
        if (Object.keys(matchDate).length > 0) {
            dcSaleMatch.soldDate = matchDate;
        }
        if (safeSearch) {
            dcSaleMatch.$or = [
                { registrationNumber: { $regex: safeSearch, $options: 'i' } },
                { make: { $regex: safeSearch, $options: 'i' } },
                { model: { $regex: safeSearch, $options: 'i' } },
                { buyerName: { $regex: safeSearch, $options: 'i' } }
            ];
        }
        pipeline.push({
            $unionWith: {
                coll: 'dealercars',
                pipeline: [
                    { $match: dcSaleMatch },
                    { $project: {
                        _id: { $concat: [{ $toString: '$_id' }, '_dcsale'] },
                        type: 'Dealer Car Sale',
                        sourceType: 'DealerCar',
                        sourceId: '$_id',
                        reference: { $ifNull: ['$registrationNumber', 'N/A'] },
                        date: '$soldDate',
                        description: { $concat: ['Sale ', { $ifNull: ['$make', ''] }, ' ', { $ifNull: ['$model', ''] }] },
                        moneyIn: { $ifNull: ['$soldFor', 0] },
                        moneyOut: { $literal: 0 },
                        net: { $ifNull: ['$soldFor', 0] },
                        cost: '$cost',
                        soldFor: '$soldFor'
                    }}
                ]
            }
        });
    }

    // NOTE: Legacy POS Sales explicitly excluded as per Phase 43D

    return pipeline;
};
