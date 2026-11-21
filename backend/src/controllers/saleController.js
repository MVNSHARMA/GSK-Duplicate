import Sale from '../models/Sale.js';
import Inventory from '../models/Inventory.js';
import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';
import { withTransaction } from '../utils/transaction.js';

// @desc    Get sales with date filter, search, pagination
// @route   GET /api/sales
// @access  Private (Admin/SuperAdmin)
export const getSales = async (req, res) => {
    try {
        const { from, to, search, page = 1, limit = 50 } = req.query;
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

        const filter = { isActive: true };

        // Date range filter
        if (from || to) {
            filter.createdAt = {};
            if (from) {
                const start = new Date(from);
                if (!isNaN(start.getTime())) {
                    start.setHours(0, 0, 0, 0);
                    filter.createdAt.$gte = start;
                }
            }
            if (to) {
                const end = new Date(to);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = end;
                }
            }
            if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
        }

        // Build query
        const [sales, total] = await Promise.all([
            Sale.find(filter)
                .populate('customerId', 'name email customerType')
                .populate('items.inventoryId', 'itemName category')
                .sort({ createdAt: -1 })
                .skip((safePage - 1) * safeLimit)
                .limit(safeLimit),
            Sale.countDocuments(filter)
        ]);

        // Calculate metrics for the filtered range
        const metricsAgg = await Sale.aggregate([
            { $match: filter },
            { $group: {
                _id: null,
                totalRevenue: { $sum: '$totalAmount' },
                totalTransactions: { $sum: 1 }
            }}
        ]);

        const metrics = {
            totalTransactions: metricsAgg[0]?.totalTransactions || 0,
            totalRevenue: metricsAgg[0]?.totalRevenue || 0
        };

        res.status(200).json({
            success: true,
            data: sales,
            metrics,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                pages: Math.ceil(total / safeLimit)
            }
        });
    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ success: false, error: "Server Error fetching sales" });
    }
};

// @desc    Create a new sale
// @route   POST /api/sales
// @access  Private (Admin/SuperAdmin)
export const createSale = async (req, res) => {
    try {
        const { customerId, items, paymentMethod, totalAmount } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one item is required' });
        }

        if (!paymentMethod) {
            return res.status(400).json({ success: false, error: 'Payment method is required' });
        }

        const newSale = await withTransaction(async (session) => {
            // Deduct inventory sequentially
            for (const item of items) {
                const inventoryItem = await Inventory.findById(item.inventoryId).session(session);
                
                if (!inventoryItem) {
                    throw new Error(`Inventory item not found: ${item.inventoryId}`);
                }

                if (inventoryItem.quantity < item.quantity) {
                    throw new Error(`Insufficient stock for ${inventoryItem.itemName}. Available: ${inventoryItem.quantity}`);
                }

                inventoryItem.quantity -= item.quantity;
                await inventoryItem.save({ session });
            }

            // Create sale record
            const createdSales = await Sale.create([{
                customerId: customerId || null,
                items,
                paymentMethod,
                totalAmount
            }], { session });

            const createdSale = createdSales[0];

            // Log action
            await AuditLog.create([{
                actor: req.user._id,
                action: 'CREATE_SALE',
                target: createdSale._id.toString(),
                metadata: { totalAmount, itemsCount: items.length },
                ipAddress: req.ip
            }], { session });

            return createdSale;
        });

        res.status(201).json({
            success: true,
            data: newSale
        });
    } catch (error) {
        console.error("Error creating sale:", error);
        const status = error.message.includes('Insufficient stock') || error.message.includes('not found') ? 400 : 500;
        res.status(status).json({ success: false, error: error.message || "Server Error creating sale" });
    }
};

// @desc    Update a sale
// @route   PUT /api/sales/:id
// @access  Private (Admin/SuperAdmin)
export const updateSale = async (req, res) => {
    try {
        const { customerId, items, paymentMethod, totalAmount } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one item is required' });
        }

        if (!paymentMethod) {
            return res.status(400).json({ success: false, error: 'Payment method is required' });
        }

        const updatedSale = await withTransaction(async (session) => {
            const sale = await Sale.findById(req.params.id).session(session);

            if (!sale) {
                throw new Error('Sale not found');
            }

            // Revert old items from inventory
            for (const oldItem of sale.items) {
                const inventoryItem = await Inventory.findById(oldItem.inventoryId).session(session);
                if (inventoryItem) {
                    inventoryItem.quantity += oldItem.quantity;
                    await inventoryItem.save({ session });
                }
            }

            // Deduct new items from inventory sequentially
            for (const item of items) {
                const inventoryItem = await Inventory.findById(item.inventoryId).session(session);
                
                if (!inventoryItem) {
                    throw new Error(`Inventory item not found: ${item.inventoryId}`);
                }

                if (inventoryItem.quantity < item.quantity) {
                    throw new Error(`Insufficient stock for ${inventoryItem.itemName}. Available: ${inventoryItem.quantity}`);
                }

                inventoryItem.quantity -= item.quantity;
                await inventoryItem.save({ session });
            }

            // Update sale record
            sale.customerId = customerId || null;
            sale.items = items;
            sale.paymentMethod = paymentMethod;
            sale.totalAmount = totalAmount;
            
            await sale.save({ session });

            // Log action
            await AuditLog.create([{
                actor: req.user._id,
                action: 'UPDATE_SALE',
                target: sale._id.toString(),
                metadata: { totalAmount, itemsCount: items.length },
                ipAddress: req.ip
            }], { session });

            return sale;
        });

        res.status(200).json({
            success: true,
            data: updatedSale
        });
    } catch (error) {
        console.error("Error updating sale:", error);
        const status = error.message.includes('Insufficient stock') || error.message.includes('not found') ? 400 : (error.message === 'Sale not found' ? 404 : 500);
        res.status(status).json({ success: false, error: error.message || "Server Error updating sale" });
    }
};

// @desc    Delete (soft delete) a sale
// @route   DELETE /api/sales/:id
// @access  Private (Admin/SuperAdmin)
export const deleteSale = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);

        if (!sale) {
            return res.status(404).json({ success: false, error: 'Sale not found' });
        }

        // For this MVP, we won't automatically restore inventory on delete, 
        // as the physical items might be damaged, returned, etc.
        // Can be added later as a 'refund' feature.
        
        sale.isActive = false;
        await sale.save();

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'DELETE_SALE',
            target: sale._id.toString(),
            metadata: { totalAmount: sale.totalAmount },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error("Error deleting sale:", error);
        res.status(500).json({ success: false, error: "Server Error deleting sale" });
    }
};
