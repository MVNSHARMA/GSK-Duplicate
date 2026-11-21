import Inventory from '../models/Inventory.js';
import AuditLog from '../models/AuditLog.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import { AUDIT_EVENTS } from '../utils/auditEvents.js';
import { computeInventoryStock, getStockAggregationStages } from '../utils/inventoryStock.js';
import { escapeRegex } from '../utils/sanitize.js';

const sanitizeInventoryItemForRole = (item, role) => {
    if (!item) return item;
    const isRestrictedRole = role === 'mechanic' || role === 'user';
    if (!isRestrictedRole) return item;

    const obj = item.toObject ? item.toObject() : { ...item };
    if (Array.isArray(obj.variants)) {
        obj.variants = obj.variants.map(v => {
            const vObj = v?.toObject ? v.toObject() : { ...v };
            delete vObj.unitPrice;
            delete vObj.unitPurchasePrice;
            return vObj;
        });
    }
    return obj;
};

// @desc    Get all inventory items and metrics
// @route   GET /api/inventory
// @access  Private (Admin/SuperAdmin)

const cascadeSupplierUpdate = (variants, parentVariantId, newSupplierId) => {
    variants.forEach(v => {
        if (v.parentId && v.parentId.toString() === parentVariantId && v.supplierSource === 'inherited') {
            v.supplierId = newSupplierId;
            cascadeSupplierUpdate(variants, v._id.toString(), newSupplierId);
        }
    });
};

const cascadeDeactivate = (variants, parentVariantId) => {
    variants.forEach(v => {
        if (v.parentId && v.parentId.toString() === parentVariantId && v.isActive) {
            v.isActive = false;
            cascadeDeactivate(variants, v._id.toString());
        }
    });
};

export const getInventory = async (req, res) => {
    try {
        const { search, limit = 50 } = req.query;

        let query = {};
        if (search) {
            const safeSearch = escapeRegex(search);
            query.$or = [
                { itemName: { $regex: safeSearch, $options: 'i' } },
                { category: { $regex: safeSearch, $options: 'i' } },
                { 'variants.sku': { $regex: safeSearch, $options: 'i' } },
                { 'variants.name': { $regex: safeSearch, $options: 'i' } }
            ];
        }

        const [items, allItems] = await Promise.all([
            Inventory.find(query)
                .populate('supplierId', 'name isActive')
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .lean(),
            Inventory.find({}).select('variants').lean()
        ]);

        // Apply hierarchical stock to requested items
        const computedItems = items.map(item => computeInventoryStock(item));
        
        let totalUnits = 0;
        let inventoryValue = 0;
        let lowStockCount = 0;

        allItems.forEach(item => {
            const computedItem = computeInventoryStock(item);
            totalUnits += computedItem.totalStock || 0;
            
            if (computedItem.variants && computedItem.variants.length > 0) {
                computedItem.variants.forEach(v => {
                    if (v.isActive) {
                        // Only count leaf node values for inventory financial value and low stock
                        // Since physical leaf nodes hold the actual stock, we shouldn't double count value
                        // Wait, leaf nodes are nodes that don't have active children.
                        // computeInventoryStock sets the computed values. 
                        // Actually, if we only sum Level 3 (or nodes with no children) for value:
                        const hasActiveChildren = computedItem.variants.some(c => c.parentId && c.parentId.toString() === v._id.toString() && c.isActive);
                        if (!hasActiveChildren) {
                            inventoryValue += (v.quantity || 0) * (v.unitPrice || 0);
                        }
                        
                        // Low stock count can still apply to any node based on its aggregate
                        if ((v.quantity || 0) <= (v.minStockLevel || 0)) {
                            lowStockCount++;
                        }
                    }
                });
            }
        });

        const isRestrictedRole = req.user?.role === 'mechanic' || req.user?.role === 'user';

        res.status(200).json({
            success: true,
            data: computedItems.map(item => sanitizeInventoryItemForRole(item, req.user?.role)),
            metrics: {
                totalParts: allItems.length,
                totalUnits,
                ...(isRestrictedRole ? {} : { inventoryValue }),
                lowStockCount
            }
        });
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({ success: false, error: "Server Error fetching inventory" });
    }
};

// @desc    Get a single inventory item and its variants
// @route   GET /api/inventory/:id
// @access  Private (Admin/SuperAdmin/Mechanic)
export const getInventoryItem = async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id).populate('supplierId', 'name isActive').lean();

        if (!item) {
            return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }

        const computedItem = computeInventoryStock(item);

        res.status(200).json({
            success: true,
            data: sanitizeInventoryItemForRole(computedItem, req.user?.role)
        });
    } catch (error) {
        // Handle invalid ObjectId format gracefully without throwing a raw server error
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
            return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }
        console.error("Error fetching inventory item:", error);
        res.status(500).json({ success: false, error: "Server Error fetching inventory item" });
    }
};

// @desc    Create a new inventory item
// @route   POST /api/inventory
// @access  Private (Admin/SuperAdmin)
export const createInventoryItem = async (req, res) => {
    try {
        const { itemName, category, supplier, supplierId } = req.body;

        if (!itemName || !category) {
            return res.status(400).json({ success: false, error: 'Please provide all required fields' });
        }

        const newItem = await Inventory.create({
            itemName,
            category,
            supplier,
            supplierId: supplierId || undefined,
            variants: [] // Initialize with empty variants array
        });

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.INVENTORY_CREATED,
            target: newItem._id.toString(),
            metadata: { itemName },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            data: newItem
        });
    } catch (error) {
        console.error("Error creating inventory item:", error);
        res.status(500).json({ success: false, error: "Server Error creating inventory item" });
    }
};

// @desc    Update an inventory item
// @route   PUT /api/inventory/:id
// @access  Private (Admin/SuperAdmin)
export const updateInventoryItem = async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }

        const oldItem = item; // item was fetched above
        const updatedItem = await Inventory.findByIdAndUpdate(
            req.params.id,
            {
                itemName: req.body.itemName,
                category: req.body.category,
                supplier: req.body.supplier,
                supplierId: req.body.supplierId || undefined
            },
            { new: true, runValidators: true }
        ).populate('supplierId', 'name isActive');

        // Cascade supplier updates if changed
        const oldSupplierIdStr = oldItem.supplierId ? oldItem.supplierId.toString() : null;
        const newSupplierIdStr = req.body.supplierId ? req.body.supplierId.toString() : null;
        if (newSupplierIdStr && oldSupplierIdStr !== newSupplierIdStr) {
            let variantsChanged = false;
            updatedItem.variants.forEach(v => {
                if (v.level === 1 && v.supplierSource === 'inherited') {
                    v.supplierId = req.body.supplierId;
                    cascadeSupplierUpdate(updatedItem.variants, v._id.toString(), req.body.supplierId);
                    variantsChanged = true;
                }
            });
            if (variantsChanged) await updatedItem.save();
        }

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.INVENTORY_UPDATED,
            target: item._id.toString(),
            metadata: { itemName: updatedItem.itemName },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: updatedItem
        });
    } catch (error) {
        console.error("Error updating inventory item:", error);
        res.status(500).json({ success: false, error: "Server Error updating inventory item" });
    }
};

// @desc    Delete an inventory item
// @route   DELETE /api/inventory/:id
// @access  Private (Admin/SuperAdmin)
export const deleteInventoryItem = async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }

        await item.deleteOne();

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.INVENTORY_DELETED,
            target: item._id.toString(),
            metadata: { itemName: item.itemName },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error("Error deleting inventory item:", error);
        res.status(500).json({ success: false, error: "Server Error deleting inventory item" });
    }
};

// @desc    Add a variant to an inventory item
// @route   POST /api/inventory/:id/variants
// @access  Private (Admin/SuperAdmin)
export const addVariant = async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }

        const { name, sku, quantity, minStockLevel, unitPrice, isActive, parentId, supplierId, supplierSource } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: 'Variant name is required' });
        }
        
        if (Number(quantity) < 0 || Number(unitPrice) < 0 || Number(minStockLevel) < 0) {
            return res.status(400).json({ success: false, error: 'Quantity, Unit Price and Min Stock Level cannot be negative' });
        }

        let level = 1;
        let effectiveSupplierId = item.supplierId;
        
        if (parentId) {
            const parent = item.variants.id(parentId);
            if (!parent) return res.status(404).json({ success: false, error: 'Parent variant not found' });
            if (parent.level >= 3) return res.status(400).json({ success: false, error: 'Maximum variant depth reached. A Sub-Sub-Variant cannot contain another variant.' });
            if (parent.isActive === false) return res.status(400).json({ success: false, error: 'Parent variant is inactive' });
            level = parent.level + 1;
            effectiveSupplierId = parent.supplierId;
        }

        const source = supplierSource === 'explicit' ? 'explicit' : 'inherited';
        const finalSupplierId = source === 'explicit' ? supplierId : effectiveSupplierId;

        // Check SKU uniqueness across ALL active variants in the item
        if (sku && item.variants.some(v => v.sku === sku && v.isActive !== false)) {
            return res.status(409).json({ success: false, error: 'This SKU is already in use.' });
        }

        item.variants.push({
            name,
            sku,
            quantity: Number(quantity) || 0,
            minStockLevel: Number(minStockLevel) || 0,
            unitPrice: Number(unitPrice) || 0,
            isActive: isActive !== undefined ? isActive : true,
            parentId: parentId || null,
            level,
            supplierId: finalSupplierId,
            supplierSource: source
        });

        await item.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'ADD_VARIANT',
            target: item._id.toString(),
            metadata: { itemName: item.itemName, variantName: name },
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error("Error adding variant:", error);
        res.status(500).json({ success: false, error: "Server Error adding variant" });
    }
};

// @desc    Update a variant
// @route   PUT /api/inventory/:id/variants/:variantId
// @access  Private (Admin/SuperAdmin)
export const updateVariant = async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }

        const variant = item.variants.id(req.params.variantId);
        if (!variant) {
            return res.status(404).json({ success: false, error: 'Variant not found' });
        }

        const { name, sku, minStockLevel, unitPrice, isActive, supplierId, supplierSource } = req.body;

        if (name) variant.name = name;
        if (sku !== undefined) {
            // Check uniqueness if changing
            if (sku && sku !== variant.sku && item.variants.some(v => v.sku === sku && v._id.toString() !== variant._id.toString() && v.isActive !== false)) {
                return res.status(409).json({ success: false, error: 'This SKU is already in use.' });
            }
            variant.sku = sku;
        }
        
        if (req.body.quantity !== undefined && req.body.quantity !== variant.quantity) {
             return res.status(400).json({ success: false, error: 'Quantity cannot be updated directly. Please use the adjust-stock endpoint.' });
        }
        
        if (minStockLevel !== undefined) {
            if (Number(minStockLevel) < 0) return res.status(400).json({ success: false, error: 'Min Stock Level cannot be negative' });
            variant.minStockLevel = Number(minStockLevel);
        }
        
        if (unitPrice !== undefined) {
            if (Number(unitPrice) < 0) return res.status(400).json({ success: false, error: 'Unit Price cannot be negative' });
            variant.unitPrice = Number(unitPrice);
        }
        
        if (isActive !== undefined) variant.isActive = isActive;
        
        // Supplier updates
        if (supplierSource === 'explicit') {
            variant.supplierSource = 'explicit';
            variant.supplierId = supplierId || variant.supplierId;
            cascadeSupplierUpdate(item.variants, variant._id.toString(), variant.supplierId);
        } else if (supplierSource === 'inherited') {
            variant.supplierSource = 'inherited';
            if (variant.parentId) {
                const parent = item.variants.id(variant.parentId);
                variant.supplierId = parent ? parent.supplierId : item.supplierId;
            } else {
                variant.supplierId = item.supplierId;
            }
            cascadeSupplierUpdate(item.variants, variant._id.toString(), variant.supplierId);
        }

        await item.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'UPDATE_VARIANT',
            target: item._id.toString(),
            metadata: { itemName: item.itemName, variantName: variant.name },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: item });
    } catch (error) {
        console.error("Error updating variant:", error);
        res.status(500).json({ success: false, error: "Server Error updating variant" });
    }
};

// @desc    Deactivate a variant
// @route   DELETE /api/inventory/:id/variants/:variantId
// @access  Private (Admin/SuperAdmin)
export const deleteVariant = async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }

        const variant = item.variants.id(req.params.variantId);
        if (!variant) {
            return res.status(404).json({ success: false, error: 'Variant not found' });
        }

        // Soft delete by deactivating
        variant.isActive = false;
        cascadeDeactivate(item.variants, variant._id.toString());

        await item.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'DEACTIVATE_VARIANT',
            target: item._id.toString(),
            metadata: { itemName: item.itemName, variantName: variant.name },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: item });
    } catch (error) {
        console.error("Error deactivating variant:", error);
        res.status(500).json({ success: false, error: "Server Error deactivating variant" });
    }
};

// @desc    Adjust stock for a variant
// @route   POST /api/inventory/:id/variants/:variantId/adjust-stock
// @access  Private (Admin/SuperAdmin)
export const adjustStock = async (req, res) => {
    const session = await Inventory.startSession();
    session.startTransaction();
    try {
        const { adjustment, reason } = req.body;
        
        if (adjustment === undefined || adjustment === null || isNaN(adjustment)) {
            throw new Error('Valid adjustment amount is required');
        }
        if (!reason) {
            throw new Error('Reason is required for stock adjustment');
        }

        const delta = Number(adjustment);
        if (delta === 0) {
            throw new Error('Adjustment cannot be zero');
        }

        const item = await Inventory.findById(req.params.id).session(session);
        if (!item) {
            throw new Error('Inventory item not found');
        }

        const variant = item.variants.id(req.params.variantId);
        if (!variant) {
            throw new Error('Variant not found');
        }

        if (variant.quantity + delta < 0) {
            throw new Error(`Insufficient stock. Current stock is ${variant.quantity}`);
        }

        // Atomically update stock, ensuring it doesn't go below 0
        const updatedItem = await Inventory.findOneAndUpdate(
            { 
                _id: item._id, 
                "variants._id": variant._id,
                "variants.quantity": { $gte: delta < 0 ? Math.abs(delta) : 0 } 
            },
            { $inc: { "variants.$.quantity": delta } },
            { new: true, session }
        );

        if (!updatedItem) {
            throw new Error('Failed to update stock. Insufficient quantity or concurrent modification.');
        }

        const updatedVariant = updatedItem.variants.id(variant._id);

        // Record transaction
        await InventoryTransaction.create([{
            inventoryId: item._id,
            variantId: variant._id,
            type: 'ADJUSTMENT',
            quantity: delta,
            previousQuantity: variant.quantity,
            newQuantity: updatedVariant.quantity,
            reason: reason,
            performedBy: req.user._id
        }], { session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, data: updatedItem, newStock: updatedVariant.quantity });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error adjusting stock:", error);
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get stock transactions
// @route   GET /api/inventory/transactions
// @access  Private (Admin/SuperAdmin)
export const getTransactions = async (req, res) => {
    try {
        const { inventoryId, variantId, page = 1, limit = 50 } = req.query;
        let query = {};
        
        if (inventoryId) query.inventoryId = inventoryId;
        if (variantId) query.variantId = variantId;

        const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
        const [transactions, total] = await Promise.all([
            InventoryTransaction.find(query)
            .populate('inventoryId', 'itemName')
            .populate('jobCardId', 'bookingId status')
            .populate('performedBy', 'name email role')
            .sort({ createdAt: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit),
            InventoryTransaction.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: transactions,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                pages: Math.ceil(total / safeLimit),
                hasNext: safePage * safeLimit < total,
                hasPrevious: safePage > 1
            }
        });
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ success: false, error: "Server Error fetching transactions" });
    }
};

// @desc    Get paginated direct children of a variant or product
// @route   GET /api/inventory/:id/children
// @access  Private (Admin/SuperAdmin/Mechanic)
export const getVariantChildren = async (req, res) => {
    try {
        const inventoryId = req.params.id;
        const parentIdRaw = req.query.parentId;
        const parentId = (parentIdRaw === 'null' || !parentIdRaw) ? null : parentIdRaw;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 15;
        const skip = (page - 1) * limit;
        const search = req.query.search ? req.query.search.toLowerCase() : '';
        const stockStatus = req.query.stockStatus || 'All';

        const mongoose = (await import('mongoose')).default;

        if (!mongoose.Types.ObjectId.isValid(inventoryId)) {
            return res.status(404).json({ success: false, error: 'Invalid inventory ID' });
        }
        
        const inventoryObjId = new mongoose.Types.ObjectId(inventoryId);

        // First, validate the parent
        const Inventory = (await import('../models/Inventory.js')).default;
        const inventoryBase = await Inventory.findById(inventoryId).populate('supplierId', 'name isActive');
        if (!inventoryBase) {
            return res.status(404).json({ success: false, error: 'Inventory item not found' });
        }

        let parentNode = null;
        if (parentId) {
            // Recompute the parent node's quantity using the helper
            const computedBase = computeInventoryStock(inventoryBase);
            parentNode = computedBase.variants.find(v => v._id.toString() === parentId);
            if (!parentNode) {
                return res.status(404).json({ success: false, error: 'Parent variant not found in this inventory' });
            }
            if (parentNode.level >= 3) {
                 // Level 3 is the leaf. It has no children.
                 return res.status(200).json({
                     success: true,
                     parent: parentNode,
                     children: [],
                     pagination: { page, limit, total: 0, totalPages: 0 }
                 });
            }
        } else {
             parentNode = {
                  _id: inventoryBase._id,
                  name: inventoryBase.itemName,
                  category: inventoryBase.category,
                  supplierId: inventoryBase.supplierId,
                  supplier: inventoryBase.supplier,
                  level: 0,
                  quantity: computeInventoryStock(inventoryBase).totalStock
             };
        }

        // MongoDB Aggregation to get ONLY direct children
        let matchConditions = {
            "variants.isActive": true
        };

        if (parentId) {
            matchConditions["variants.parentId"] = new mongoose.Types.ObjectId(parentId);
        } else {
            matchConditions["variants.parentId"] = null;
        }

        if (search) {
             const safeSearch = escapeRegex(search);
             matchConditions["$or"] = [
                 { "variants.name": { $regex: safeSearch, $options: "i" } },
                 { "variants.sku": { $regex: safeSearch, $options: "i" } }
             ];
        }

        if (stockStatus === 'In Stock') {
            matchConditions["variants.quantity"] = { $gt: 0 };
        } else if (stockStatus === 'Out of Stock') {
            matchConditions["variants.quantity"] = { $lte: 0 };
        } else if (stockStatus === 'Low Stock') {
            matchConditions["$expr"] = {
                $and: [
                    { $gt: ["$variants.quantity", 0] },
                    { $lte: ["$variants.quantity", "$variants.minStockLevel"] }
                ]
            };
        }

        const aggregationPipeline = [
            { $match: { _id: inventoryObjId } },
            ...getStockAggregationStages(),
            { $unwind: "$variants" },
            { $match: matchConditions },
            {
                $lookup: {
                    from: "suppliers",
                    localField: "variants.supplierId",
                    foreignField: "_id",
                    as: "supplierDetails"
                }
            },
            {
                $addFields: {
                    "variants.supplierId": { $arrayElemAt: ["$supplierDetails", 0] }
                }
            },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: skip }, { $limit: limit }, { $replaceRoot: { newRoot: "$variants" } }]
                }
            }
        ];

        const result = await Inventory.aggregate(aggregationPipeline);
        const total = result[0].metadata.length > 0 ? result[0].metadata[0].total : 0;
        const isRestrictedRole = req.user?.role === 'mechanic' || req.user?.role === 'user';
        const children = isRestrictedRole
            ? result[0].data.map(child => {
                const cObj = { ...child };
                delete cObj.unitPrice;
                delete cObj.unitPurchasePrice;
                return cObj;
            })
            : result[0].data;

        if (isRestrictedRole && parentNode) {
            delete parentNode.unitPrice;
            delete parentNode.unitPurchasePrice;
        }

        res.status(200).json({
            success: true,
            parent: parentNode,
            children,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Error in getVariantChildren:", error);
        res.status(500).json({ success: false, error: "Server Error fetching variant children" });
    }
};

// @desc    Search inventory specifically for purchase order items (leaf nodes only)
// @route   GET /api/inventory/purchase-order-items
// @access  Private/Admin
export const searchPurchaseOrderItems = async (req, res) => {
    try {
        const { search, limit = 50 } = req.query;
        let query = {};
        
        if (search) {
            const regex = new RegExp(escapeRegex(search.trim()), 'i');
            query.$or = [
                { itemName: regex },
                { 'variants.sku': regex },
                { 'variants.name': regex }
            ];
        }

        const items = await Inventory.find(query)
            .populate('supplierId', 'name isActive')
            .lean();

        let results = [];

        items.forEach(item => {
            const computedItem = computeInventoryStock(item);

            computedItem.variants.forEach(variant => {
                if (!variant.isActive) return;

                // For PO, we ONLY allow leaf nodes (or legacy nodes with no children)
                const hasActiveChildren = computedItem.variants.some(v => 
                    v.parentId && v.parentId.toString() === variant._id.toString() && v.isActive
                );

                if (hasActiveChildren) return;

                // Match against search query if provided, since the DB query returns the whole doc
                if (search) {
                    const s = search.toLowerCase();
                    const matchesName = variant.name.toLowerCase().includes(s);
                    const matchesProduct = computedItem.itemName.toLowerCase().includes(s);
                    const matchesSku = variant.sku && variant.sku.toLowerCase().includes(s);
                    if (!matchesName && !matchesProduct && !matchesSku) {
                        return;
                    }
                }

                // Build hierarchy path
                const path = [];
                let current = variant;
                while (current) {
                    path.unshift(current.name);
                    if (current.parentId) {
                        current = computedItem.variants.find(v => v._id.toString() === current.parentId.toString());
                    } else {
                        break;
                    }
                }
                const hierarchyPath = path.join(' › ');

                // Supplier fallback: variant -> product
                const supplierId = variant.supplierId || (computedItem.supplierId ? computedItem.supplierId._id : null);

                results.push({
                    inventoryId: computedItem._id,
                    variantId: variant._id,
                    productName: computedItem.itemName,
                    variantName: variant.name,
                    hierarchyPath,
                    sku: variant.sku || '',
                    currentStock: variant.quantity,
                    unitPurchasePrice: variant.unitPurchasePrice || 0,
                    supplierId
                });
            });
        });

        // Sort by product name then hierarchy path
        results.sort((a, b) => {
            if (a.productName !== b.productName) return a.productName.localeCompare(b.productName);
            return a.hierarchyPath.localeCompare(b.hierarchyPath);
        });

        // Simple manual pagination for limited results
        const page = parseInt(req.query.page, 10) || 1;
        const limitInt = parseInt(limit, 10);
        const startIndex = (page - 1) * limitInt;
        const endIndex = page * limitInt;
        
        const paginatedResults = results.slice(startIndex, endIndex);

        res.status(200).json({
            success: true,
            data: paginatedResults,
            pagination: {
                page,
                limit: limitInt,
                total: results.length,
                totalPages: Math.ceil(results.length / limitInt)
            }
        });
    } catch (error) {
        console.error("Error in searchPurchaseOrderItems:", error);
        res.status(500).json({ success: false, error: "Server Error searching purchase order items" });
    }
};
