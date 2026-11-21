/**
 * Helper to compute bottom-up hierarchical stock on an inventory document in memory.
 * Level 3: actual physical stock
 * Level 2: SUM(active Level 3 children), fallback to stored if no children
 * Level 1: SUM(active Level 2 children), fallback to stored if no children
 * Product: SUM(active Level 1 children)
 */
export const computeInventoryStock = (inventoryDoc) => {
    if (!inventoryDoc || !inventoryDoc.variants) return inventoryDoc;
    
    // Safely clone if it's a mongoose document, or use as-is if lean
    const inv = typeof inventoryDoc.toObject === 'function' ? inventoryDoc.toObject() : JSON.parse(JSON.stringify(inventoryDoc));
    const variants = inv.variants;

    // Map parentId to children
    const childrenMap = new Map();
    variants.forEach(v => {
        if (v.parentId && v.isActive) {
            const parentIdStr = v.parentId.toString();
            if (!childrenMap.has(parentIdStr)) childrenMap.set(parentIdStr, []);
            childrenMap.get(parentIdStr).push(v);
        }
    });

    // Helper to calculate aggregate stock
    const computedStock = new Map();

    const getStock = (v) => {
        if (computedStock.has(v._id.toString())) return computedStock.get(v._id.toString());
        
        const children = childrenMap.get(v._id.toString()) || [];
        let stock = 0;
        
        if (children.length > 0) {
            stock = children.reduce((sum, child) => sum + getStock(child), 0);
        } else {
            stock = v.quantity || 0; // fallback to stored
        }
        
        computedStock.set(v._id.toString(), stock);
        return stock;
    };

    // Override quantity in the cloned object
    variants.forEach(v => {
        if (v.isActive) {
            v.quantity = getStock(v);
        }
    });

    // Compute Product total
    let productTotal = 0;
    variants.forEach(v => {
        if (!v.parentId && v.isActive) {
            productTotal += v.quantity;
        }
    });
    
    inv.totalStock = productTotal;
    return inv;
};

/**
 * Returns the MongoDB aggregation stages to dynamically compute hierarchical stock
 * prior to an $unwind operation.
 * 
 * It adds a `computedQuantity` to variants based on active children.
 * Replaces variant `quantity` with `computedQuantity`.
 */
export const getStockAggregationStages = () => {
    return [
        // Stage 1: Compute Level 2 stock from Level 3 children
        {
            $addFields: {
                variants: {
                    $map: {
                        input: "$variants",
                        as: "v2",
                        in: {
                            $mergeObjects: [
                                "$$v2",
                                {
                                    computedQuantity: {
                                        $cond: [
                                            { $eq: ["$$v2.level", 2] },
                                            {
                                                $let: {
                                                    vars: {
                                                        l3Children: {
                                                            $filter: {
                                                                input: "$variants",
                                                                as: "l3",
                                                                cond: { $and: [
                                                                    { $eq: ["$$l3.parentId", "$$v2._id"] },
                                                                    { $eq: ["$$l3.isActive", true] }
                                                                ]}
                                                            }
                                                        }
                                                    },
                                                    in: {
                                                        $cond: [
                                                            { $gt: [{ $size: "$$l3Children" }, 0] },
                                                            { $sum: "$$l3Children.quantity" },
                                                            "$$v2.quantity" // fallback
                                                        ]
                                                    }
                                                }
                                            },
                                            "$$v2.quantity" // For L1 and L3, pass through
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        // Stage 2: Compute Level 1 stock from Level 2 computedQuantity
        {
            $addFields: {
                variants: {
                    $map: {
                        input: "$variants",
                        as: "v1",
                        in: {
                            $mergeObjects: [
                                "$$v1",
                                {
                                    quantity: {
                                        $cond: [
                                            { $eq: ["$$v1.level", 1] },
                                            {
                                                $let: {
                                                    vars: {
                                                        l2Children: {
                                                            $filter: {
                                                                input: "$variants",
                                                                as: "l2",
                                                                cond: { $and: [
                                                                    { $eq: ["$$l2.parentId", "$$v1._id"] },
                                                                    { $eq: ["$$l2.isActive", true] }
                                                                ]}
                                                            }
                                                        }
                                                    },
                                                    in: {
                                                        $cond: [
                                                            { $gt: [{ $size: "$$l2Children" }, 0] },
                                                            { $sum: "$$l2Children.computedQuantity" },
                                                            "$$v1.quantity" // fallback
                                                        ]
                                                    }
                                                }
                                            },
                                            "$$v1.computedQuantity" // Apply L2 computed or L3 fallback
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        // Stage 3: Compute product totalStock based on L1 quantity
        {
            $addFields: {
                totalStock: {
                    $let: {
                        vars: {
                            l1Children: {
                                $filter: {
                                    input: "$variants",
                                    as: "l1",
                                    cond: { $and: [
                                        { $eq: ["$$l1.parentId", null] },
                                        { $eq: ["$$l1.isActive", true] }
                                    ]}
                                }
                            }
                        },
                        in: {
                            $cond: [
                                { $gt: [{ $size: "$$l1Children" }, 0] },
                                { $sum: "$$l1Children.quantity" },
                                { $sum: "$variants.quantity" } // Legacy fallback
                            ]
                        }
                    }
                }
            }
        }
    ];
};
