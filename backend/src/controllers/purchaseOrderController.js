import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import Inventory from '../models/Inventory.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Sequence from '../models/Sequence.js';
import AuditLog from '../models/AuditLog.js';
import { AUDIT_EVENTS } from '../utils/auditEvents.js';
import EmailService from '../services/EmailService.js';
import { getEmailDeliveryEvents } from '../utils/sendEmail.js';
import { generatePurchaseOrderPDF } from '../utils/generatePurchaseOrderPDF.js';

const CONFIRMED_PO_STATUSES = ['Ordered', 'Partially Received', 'Received'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inFlightPOEmails = new Map();

const generatePONumber = async () => {
    let sequence = await Sequence.findOne({ key: 'purchaseOrderNumber' });

    if (!sequence) {
        const existingNumbers = await PurchaseOrder.find({}, 'purchaseOrderNumber').lean();
        const maxExisting = existingNumbers.reduce((max, po) => {
            const number = Number.parseInt(po.purchaseOrderNumber?.split('-').pop(), 10);
            return Number.isNaN(number) ? max : Math.max(max, number);
        }, 999);

        try {
            sequence = await Sequence.create({ key: 'purchaseOrderNumber', value: maxExisting });
        } catch (error) {
            if (error.code !== 11000) throw error;
            sequence = await Sequence.findOne({ key: 'purchaseOrderNumber' });
        }
    }

    const nextSequence = await Sequence.findOneAndUpdate(
        { key: 'purchaseOrderNumber' },
        { $inc: { value: 1 } },
        { new: true }
    );

    return `PO-${nextSequence.value}`;
};

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private/Admin
export const getPurchaseOrders = async (req, res) => {
    try {
        const query = { isActive: { $ne: false } };
        
        if (req.query.status && req.query.status !== 'All') {
            query.status = req.query.status;
        }

        if (req.query.search) {
            const searchRegex = { $regex: req.query.search, $options: 'i' };
            
            // Search PO Number or Supplier Name
            const supplierMatches = await Supplier.find({ name: searchRegex }).select('_id');
            const supplierIds = supplierMatches.map(s => s._id);
            
            query.$or = [
                { purchaseOrderNumber: searchRegex },
                { 'items.productName': searchRegex },
                { 'items.variantName': searchRegex },
                { 'items.sku': searchRegex }
            ];
            
            if (supplierIds.length > 0) {
                query.$or.push({ supplierId: { $in: supplierIds } });
            }
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const [purchaseOrders, total] = await Promise.all([
            PurchaseOrder.find(query)
                .select('-emailHistory.htmlContent -emailHistory.textContent')
                .populate('supplierId', 'name contactPerson email phone address')
                .populate('createdBy', 'name email role')
                .populate('emailHistory.sentBy', 'name email role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PurchaseOrder.countDocuments(query)
        ]);

        res.json({
            purchaseOrders,
            page,
            pages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching purchase orders' });
    }
};

// @desc    Get PO by ID
// @route   GET /api/purchase-orders/:id
// @access  Private/Admin
export const getPurchaseOrderById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid Purchase Order ID' });
        }

        const po = await PurchaseOrder.findById(req.params.id)
            .populate('supplierId')
            .populate('createdBy', 'name email role')
            .populate('emailHistory.sentBy', 'name email role');
            
        if (!po) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }
        res.json(po);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching purchase order' });
    }
};

// @desc    Create new purchase order
// @route   POST /api/purchase-orders
// @access  Private/Admin
export const createPurchaseOrder = async (req, res) => {
    try {
        const { supplierId, items, notes, expectedDeliveryDate, gstRate = 10 } = req.body;

        if (!supplierId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Supplier and at least one item are required' });
        }

        const supplier = await Supplier.findById(supplierId);
        if (!supplier || !supplier.isActive) {
            return res.status(400).json({ message: 'Valid, active supplier is required' });
        }

        // Validate variants and calculate subtotal
        let subtotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const inventory = await Inventory.findById(item.inventoryId);
            if (!inventory) {
                return res.status(400).json({ message: `Inventory item ${item.inventoryId} not found` });
            }

            const variant = inventory.variants.id(item.variantId);
            if (!variant) {
                return res.status(400).json({ message: `Variant ${item.variantId} not found in inventory ${inventory.itemName}` });
            }

            if (!variant.isActive) {
                return res.status(400).json({ message: `Variant ${variant.name} is inactive and cannot be purchased.` });
            }

            const hasActiveChildren = inventory.variants.some(v => 
                v.parentId && v.parentId.toString() === variant._id.toString() && v.isActive
            );
            if (hasActiveChildren) {
                return res.status(400).json({ message: `Cannot purchase parent aggregate variant (${variant.name}). Select a specific leaf variant.` });
            }

            if (!Number.isInteger(Number(item.quantityOrdered)) || Number(item.quantityOrdered) <= 0) {
                return res.status(400).json({ message: 'Quantity ordered must be greater than 0' });
            }

            if (Number.isNaN(Number(item.unitPurchasePrice)) || Number(item.unitPurchasePrice) < 0) {
                return res.status(400).json({ message: 'Unit purchase price cannot be negative' });
            }

            // Compute hierarchy path securely
            const path = [];
            let current = variant;
            while (current) {
                path.unshift(current.name);
                if (current.parentId) {
                    current = inventory.variants.find(v => v._id.toString() === current.parentId.toString());
                } else {
                    break;
                }
            }
            const hierarchyPath = path.join(' › ');

            subtotal += item.quantityOrdered * item.unitPurchasePrice;

            validatedItems.push({
                inventoryId: inventory._id,
                variantId: variant._id,
                productName: inventory.itemName,
                variantName: variant.name,
                hierarchyPath,
                sku: variant.sku || '',
                quantityOrdered: item.quantityOrdered,
                quantityReceived: 0,
                unitPurchasePrice: item.unitPurchasePrice
            });
        }

        const taxAmount = (subtotal * gstRate) / 100;
        const totalAmount = subtotal + taxAmount;
        const purchaseOrderNumber = await generatePONumber();

        const po = await PurchaseOrder.create({
            purchaseOrderNumber,
            supplierId,
            status: 'Draft',
            items: validatedItems,
            notes,
            expectedDeliveryDate,
            subtotal,
            taxAmount,
            totalAmount,
            gstRate,
            createdBy: req.user._id
        });

        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.PURCHASE_ORDER_UPDATED,
            target: po._id.toString(),
            entityType: 'PurchaseOrder',
            entityId: po._id.toString(),
            entityDisplay: po.purchaseOrderNumber,
            description: `Created purchase order ${po.purchaseOrderNumber}`,
            metadata: { supplierId: po.supplierId, itemCount: po.items.length, totalAmount: po.totalAmount },
            ipAddress: req.ip
        });

        res.status(201).json(po);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error creating purchase order' });
    }
};

// @desc    Update purchase order (Draft only)
// @route   PUT /api/purchase-orders/:id
// @access  Private/Admin
export const updatePurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id);

        if (!po) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (po.status !== 'Draft') {
            return res.status(400).json({ message: 'Only Draft Purchase Orders can be edited directly' });
        }

        const { supplierId, items, notes, expectedDeliveryDate, gstRate = 10 } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'At least one item is required' });
        }

        const supplier = await Supplier.findById(supplierId);
        if (!supplier || !supplier.isActive) {
            return res.status(400).json({ message: 'Valid, active supplier is required' });
        }

        let subtotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const inventory = await Inventory.findById(item.inventoryId);
            if (!inventory) return res.status(400).json({ message: `Inventory item ${item.inventoryId} not found` });

            const variant = inventory.variants.id(item.variantId);
            if (!variant) return res.status(400).json({ message: `Variant ${item.variantId} not found` });

            if (!variant.isActive) {
                return res.status(400).json({ message: `Variant ${variant.name} is inactive and cannot be purchased.` });
            }

            const hasActiveChildren = inventory.variants.some(v => 
                v.parentId && v.parentId.toString() === variant._id.toString() && v.isActive
            );
            if (hasActiveChildren) {
                return res.status(400).json({ message: `Cannot purchase parent aggregate variant (${variant.name}). Select a specific leaf variant.` });
            }

            if (!Number.isInteger(Number(item.quantityOrdered)) || Number(item.quantityOrdered) <= 0 || Number.isNaN(Number(item.unitPurchasePrice)) || Number(item.unitPurchasePrice) < 0) {
                return res.status(400).json({ message: 'Each item requires a valid quantity and purchase price' });
            }

            // Compute hierarchy path securely
            const path = [];
            let current = variant;
            while (current) {
                path.unshift(current.name);
                if (current.parentId) {
                    current = inventory.variants.find(v => v._id.toString() === current.parentId.toString());
                } else {
                    break;
                }
            }
            const hierarchyPath = path.join(' › ');

            subtotal += Number(item.quantityOrdered) * Number(item.unitPurchasePrice);

            validatedItems.push({
                inventoryId: inventory._id,
                variantId: variant._id,
                productName: inventory.itemName,
                variantName: variant.name,
                hierarchyPath,
                sku: variant.sku || '',
                quantityOrdered: item.quantityOrdered,
                quantityReceived: 0,
                unitPurchasePrice: item.unitPurchasePrice
            });
        }

        po.supplierId = supplierId;
        po.items = validatedItems;
        po.notes = notes;
        po.expectedDeliveryDate = expectedDeliveryDate;
        po.subtotal = subtotal;
        po.gstRate = gstRate;
        po.taxAmount = (subtotal * gstRate) / 100;
        po.totalAmount = po.subtotal + po.taxAmount;

        const updatedPo = await po.save();
        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.PURCHASE_ORDER_CREATED,
            target: po._id.toString(),
            entityType: 'PurchaseOrder',
            entityId: po._id.toString(),
            entityDisplay: po.purchaseOrderNumber,
            description: `Updated draft purchase order ${po.purchaseOrderNumber}`,
            metadata: { itemCount: po.items.length, totalAmount: po.totalAmount },
            ipAddress: req.ip
        });
        res.json(updatedPo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error updating purchase order' });
    }
};

// @desc    Place purchase order
// @route   POST /api/purchase-orders/:id/place
// @access  Private/Admin
export const placePurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id);

        if (!po) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (po.status !== 'Draft') {
            return res.status(400).json({ message: 'Purchase Order is not in Draft state' });
        }

        po.status = 'Ordered';
        po.orderedAt = new Date();

        const placedPo = await po.save();
        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.PURCHASE_ORDER_PLACED,
            target: po._id.toString(),
            entityType: 'PurchaseOrder',
            entityId: po._id.toString(),
            entityDisplay: po.purchaseOrderNumber,
            description: `Placed purchase order ${po.purchaseOrderNumber}`,
            ipAddress: req.ip
        });
        res.json({ message: 'Purchase Order placed successfully', purchaseOrder: placedPo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error placing purchase order' });
    }
};

// @desc    Delete a Draft Purchase Order
// @route   DELETE /api/purchase-orders/:id
// @access  Private/Admin
export const deletePurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id);

        if (!po) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        po.isActive = false;
        await po.save();
        
        await AuditLog.create({
            actor: req.user._id,
            action: 'PURCHASE_ORDER_TRASHED',
            target: po._id.toString(),
            entityType: 'PurchaseOrder',
            entityId: po._id.toString(),
            entityDisplay: po.purchaseOrderNumber,
            description: `Moved purchase order ${po.purchaseOrderNumber} to trash`,
            ipAddress: req.ip
        });

        res.json({ message: 'Purchase Order moved to trash' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting purchase order' });
    }
};

// @desc    Cancel a Purchase Order
// @route   POST /api/purchase-orders/:id/cancel
// @access  Private/Admin
export const cancelPurchaseOrder = async (req, res) => {
    try {
        const po = await PurchaseOrder.findById(req.params.id);

        if (!po) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        if (po.status !== 'Draft' && po.status !== 'Ordered') {
            return res.status(400).json({ message: 'Cannot cancel Purchase Order in this state' });
        }

        po.status = 'Cancelled';

        const cancelledPo = await po.save();
        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.PURCHASE_ORDER_CANCELLED,
            target: po._id.toString(),
            entityType: 'PurchaseOrder',
            entityId: po._id.toString(),
            entityDisplay: po.purchaseOrderNumber,
            description: `Cancelled purchase order ${po.purchaseOrderNumber}`,
            ipAddress: req.ip
        });
        res.json(cancelledPo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error cancelling purchase order' });
    }
};

// @desc    Receive items against a PO
// @route   POST /api/purchase-orders/:id/receive
// @access  Private/Admin
export const receivePurchaseOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { itemId, quantityReceived } = req.body;
        
        if (!itemId || quantityReceived <= 0) {
            throw new Error('Valid itemId and quantity > 0 are required');
        }

        const po = await PurchaseOrder.findById(req.params.id).session(session);

        if (!po) throw new Error('Purchase Order not found');

        if (po.status !== 'Ordered' && po.status !== 'Partially Received') {
            throw new Error('Purchase Order cannot be received in its current state');
        }

        const item = po.items.id(itemId);
        if (!item) throw new Error('Item not found in Purchase Order');

        const outstanding = item.quantityOrdered - item.quantityReceived;
        if (quantityReceived > outstanding) {
            throw new Error(`Cannot receive ${quantityReceived}. Only ${outstanding} outstanding.`);
        }

        // Update inventory exact variant
        const inventory = await Inventory.findById(item.inventoryId).session(session);
        if (!inventory) throw new Error('Inventory document not found');

        const variant = inventory.variants.id(item.variantId);
        if (!variant) throw new Error('Variant not found in inventory');

        if (!variant.isActive) {
            throw new Error(`Variant ${variant.name} is no longer active and cannot be received.`);
        }

        const hasActiveChildren = inventory.variants.some(v => 
            v.parentId && v.parentId.toString() === variant._id.toString() && v.isActive
        );
        if (hasActiveChildren) {
            throw new Error(`Variant ${variant.name} has active sub-variants. Stock must be received into a specific physical leaf variant.`);
        }

        const previousQuantity = variant.quantity;
        const newQuantity = previousQuantity + quantityReceived;
        
        variant.quantity = newQuantity;
        await inventory.save({ session });

        // Update PO Item
        item.quantityReceived += quantityReceived;

        await InventoryTransaction.create([{
            inventoryId: inventory._id,
            variantId: variant._id,
            type: 'PURCHASE_RECEIPT',
            quantity: quantityReceived,
            unitPurchasePrice: item.unitPurchasePrice,
            previousQuantity,
            newQuantity,
            purchaseOrderId: po._id,
            performedBy: req.user._id,
            reason: `Purchase Receipt for ${po.purchaseOrderNumber}`
        }], { session });

        // Recalculate PO Status
        const isFullyReceived = po.items.every(i => i.quantityReceived === i.quantityOrdered);
        if (isFullyReceived) {
            po.status = 'Received';
            po.receivedAt = new Date();
        } else {
            po.status = 'Partially Received';
        }

        await po.save({ session });

        await session.commitTransaction();
        session.endSession();

        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.PURCHASE_ORDER_RECEIVED,
            target: po._id.toString(),
            entityType: 'PurchaseOrder',
            entityId: po._id.toString(),
            entityDisplay: po.purchaseOrderNumber,
            description: `Received ${quantityReceived} unit(s) for ${po.purchaseOrderNumber}`,
            metadata: { itemId, quantityReceived, status: po.status },
            ipAddress: req.ip
        });

        res.json(po);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(error);
        res.status(400).json({ message: error.message || 'Server error receiving purchase order' });
    }
};

// @desc    Send or Resend Purchase Order email to canonical Supplier email
// @route   POST /api/purchase-orders/:id/send-email
// @access  Private/Admin
export const sendPurchaseOrderEmail = async (req, res) => {
    const poId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(poId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid Purchase Order ID'
        });
    }

    const lockKey = String(poId);
    if (inFlightPOEmails.has(lockKey)) {
        return res.status(409).json({
            success: false,
            duplicatePrevented: true,
            message: 'An email send request for this Purchase Order is already in progress.'
        });
    }

    inFlightPOEmails.set(lockKey, Date.now());

    try {
        const po = await PurchaseOrder.findById(poId)
            .populate('createdBy', 'name email role')
            .populate('emailHistory.sentBy', 'name email role');

        if (!po || po.isActive === false) {
            return res.status(404).json({
                success: false,
                message: 'Purchase Order not found'
            });
        }

        // Validate confirmed status (only Ordered, Partially Received, Received allowed)
        if (!CONFIRMED_PO_STATUSES.includes(po.status)) {
            const statusReason = po.status === 'Draft'
                ? 'Purchase Order is currently in Draft status. Please confirm (Place Order) before sending an email to the supplier.'
                : po.status === 'Cancelled'
                    ? 'Cannot send a Purchase Order email for a Cancelled Purchase Order.'
                    : `Purchase Order cannot be emailed in '${po.status}' status.`;
            return res.status(400).json({
                success: false,
                message: statusReason
            });
        }

        // Always fetch canonical Supplier from database — never trust client-supplied supplier info
        const supplier = await Supplier.findById(po.supplierId);
        if (!supplier || supplier.isActive === false) {
            return res.status(400).json({
                success: false,
                message: 'Canonical supplier record was not found or is inactive.'
            });
        }

        const recipientEmail = String(supplier.email || '').trim().toLowerCase();
        if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Supplier does not have a valid registered email address. Please update the supplier record before sending.'
            });
        }

        const idempotencyKey = req.body?.idempotencyKey ? String(req.body.idempotencyKey).trim() : null;
        const isExplicitResend = Boolean(req.body?.resend);

        const successfulHistory = (po.emailHistory || []).filter(
            entry => entry.status && entry.status !== 'failed'
        );
        const hasBeenSentBefore = successfulHistory.length > 0;

        // Check idempotency key deduplication
        if (idempotencyKey) {
            const matchingEntry = successfulHistory.find(e => e.idempotencyKey === idempotencyKey);
            if (matchingEntry) {
                await po.populate('supplierId');
                return res.status(200).json({
                    success: true,
                    duplicatePrevented: true,
                    message: 'Duplicate request ignored; Purchase Order email was already sent for this request.',
                    emailLog: matchingEntry,
                    lastEmailStatus: po.lastEmailStatus,
                    purchaseOrder: po
                });
            }
        }

        // Prevent unintended duplicate sends unless administrator explicitly confirms resend
        if (hasBeenSentBefore && !isExplicitResend) {
            return res.status(409).json({
                success: false,
                requiresResendConfirmation: true,
                message: `Purchase Order ${po.purchaseOrderNumber} was already emailed to ${po.lastEmailStatus?.lastRecipientEmail || recipientEmail}. Please confirm resend to send it again.`,
                lastEmailStatus: po.lastEmailStatus
            });
        }

        const sentByName = req.user?.name || req.user?.email || 'GSK Automotive Admin';

        let emailResult;
        try {
            emailResult = await EmailService.sendPurchaseOrderEmail(po, supplier, {
                sentBy: req.user,
                sandbox: Boolean(req.body?.sandbox)
            });
        } catch (emailError) {
            const failedAt = new Date();
            const snapshot = emailError.emailSnapshot || {};
            const failedEntry = {
                purchaseOrderId: po._id,
                purchaseOrderNumber: po.purchaseOrderNumber,
                supplierId: supplier._id,
                supplierEmail: snapshot.recipientEmail || recipientEmail,
                senderName: snapshot.senderName || String(process.env.BREVO_SENDER_NAME || 'GSK Automotive').trim(),
                senderEmail: snapshot.senderEmail || String(process.env.BREVO_SENDER_EMAIL || '').trim(),
                subject: snapshot.subject || `Purchase Order #${po.purchaseOrderNumber} – GSK Automotive`,
                htmlContent: snapshot.htmlContent || '',
                textContent: snapshot.textContent || '',
                sentAt: failedAt,
                sentBy: req.user?._id || null,
                sentByName,
                brevoMessageId: '',
                status: 'failed',
                failureReason: emailError.message || 'Brevo rejected the email request',
                isResend: hasBeenSentBefore,
                pdfAttached: Boolean(snapshot.pdfAttached),
                pdfFilename: snapshot.pdfFilename || '',
                attachments: Array.isArray(snapshot.attachments) ? snapshot.attachments : [],
                idempotencyKey
            };

            po.emailHistory.push(failedEntry);
            po.lastEmailStatus = {
                status: hasBeenSentBefore ? (po.lastEmailStatus?.status || 'accepted') : 'failed',
                lastSentAt: po.lastEmailStatus?.lastSentAt || failedAt,
                lastRecipientEmail: po.lastEmailStatus?.lastRecipientEmail || recipientEmail,
                lastBrevoMessageId: po.lastEmailStatus?.lastBrevoMessageId || '',
                lastFailureReason: emailError.message || 'Brevo rejected the email request',
                sendCount: successfulHistory.length
            };

            await po.save();
            await po.populate('supplierId');
            await po.populate('emailHistory.sentBy', 'name email role');

            return res.status(502).json({
                success: false,
                message: `Failed to send Purchase Order email via Brevo: ${emailError.message}`,
                error: emailError.message,
                emailLog: po.emailHistory[po.emailHistory.length - 1],
                lastEmailStatus: po.lastEmailStatus,
                purchaseOrder: po
            });
        }

        const sentAt = new Date();
        const newSendCount = successfulHistory.length + 1;
        const successEntry = {
            purchaseOrderId: po._id,
            purchaseOrderNumber: po.purchaseOrderNumber,
            supplierId: supplier._id,
            supplierEmail: emailResult.recipientEmail,
            senderName: emailResult.senderName || '',
            senderEmail: emailResult.senderEmail || '',
            subject: emailResult.subject,
            htmlContent: emailResult.htmlContent || '',
            textContent: emailResult.textContent || '',
            sentAt,
            sentBy: req.user?._id || null,
            sentByName,
            brevoMessageId: emailResult.messageId || '',
            status: emailResult.deliveryStatus || 'accepted',
            failureReason: null,
            isResend: hasBeenSentBefore,
            pdfAttached: Boolean(emailResult.pdfAttached),
            pdfFilename: emailResult.pdfFilename || '',
            attachments: Array.isArray(emailResult.attachments) ? emailResult.attachments : [],
            idempotencyKey
        };

        po.emailHistory.push(successEntry);
        po.lastEmailStatus = {
            status: emailResult.deliveryStatus || 'accepted',
            lastSentAt: sentAt,
            lastRecipientEmail: emailResult.recipientEmail,
            lastBrevoMessageId: emailResult.messageId || '',
            lastFailureReason: null,
            sendCount: newSendCount
        };

        await po.save();

        await AuditLog.create({
            actor: req.user._id,
            action: AUDIT_EVENTS.PURCHASE_ORDER_EMAILED,
            target: po._id.toString(),
            entityType: 'PurchaseOrder',
            entityId: po._id.toString(),
            entityDisplay: po.purchaseOrderNumber,
            description: `${hasBeenSentBefore ? 'Resent' : 'Sent'} purchase order ${po.purchaseOrderNumber} email to ${emailResult.recipientEmail}`,
            metadata: {
                supplierId: supplier._id.toString(),
                supplierEmail: emailResult.recipientEmail,
                brevoMessageId: emailResult.messageId || '',
                isResend: hasBeenSentBefore,
                pdfAttached: Boolean(emailResult.pdfAttached)
            },
            ipAddress: req.ip
        });

        await po.populate('supplierId');
        await po.populate('emailHistory.sentBy', 'name email role');

        const latestLog = po.emailHistory[po.emailHistory.length - 1];

        return res.status(200).json({
            success: true,
            message: `Purchase Order email accepted by Brevo for ${emailResult.recipientEmail}`,
            emailLog: latestLog,
            lastEmailStatus: po.lastEmailStatus,
            purchaseOrder: po
        });
    } catch (error) {
        console.error('Error sending purchase order email:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while sending Purchase Order email'
        });
    } finally {
        inFlightPOEmails.delete(lockKey);
    }
};

// @desc    Get email sending history & optionally refresh Brevo delivery status for a PO
// @route   GET /api/purchase-orders/:id/email-history
// @access  Private/Admin
export const getPurchaseOrderEmailHistory = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid Purchase Order ID' });
        }

        const po = await PurchaseOrder.findById(req.params.id)
            .populate('supplierId', 'name contactPerson email phone address')
            .populate('emailHistory.sentBy', 'name email role');

        if (!po || po.isActive === false) {
            return res.status(404).json({ success: false, message: 'Purchase Order not found' });
        }

        // Optional live Brevo delivery event check when ?refreshDelivery=true
        if (req.query.refreshDelivery === 'true' && po.lastEmailStatus?.lastBrevoMessageId) {
            try {
                const events = await getEmailDeliveryEvents(po.lastEmailStatus.lastBrevoMessageId);
                if (Array.isArray(events) && events.length > 0) {
                    const eventNames = events.map(e => String(e.event || '').toLowerCase());
                    let resolvedStatus = null;
                    if (eventNames.includes('opened') || eventNames.includes('unique_opened')) {
                        resolvedStatus = 'opened';
                    } else if (eventNames.includes('delivered')) {
                        resolvedStatus = 'delivered';
                    } else if (eventNames.includes('hardbounces') || eventNames.includes('softbounces') || eventNames.includes('bounced')) {
                        resolvedStatus = 'bounced';
                    } else if (eventNames.includes('blocked')) {
                        resolvedStatus = 'blocked';
                    } else if (eventNames.includes('deferred')) {
                        resolvedStatus = 'deferred';
                    }

                    if (resolvedStatus && resolvedStatus !== po.lastEmailStatus.status) {
                        po.lastEmailStatus.status = resolvedStatus;
                        const matchingLog = [...po.emailHistory].reverse().find(
                            l => l.brevoMessageId === po.lastEmailStatus.lastBrevoMessageId
                        );
                        if (matchingLog) {
                            matchingLog.status = resolvedStatus;
                        }
                        await po.save();
                    }
                }
            } catch (eventErr) {
                console.warn('[PurchaseOrder] Could not refresh Brevo delivery events:', eventErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            purchaseOrderId: po._id,
            purchaseOrderNumber: po.purchaseOrderNumber,
            supplierEmail: po.supplierId?.email || '',
            lastEmailStatus: po.lastEmailStatus || { status: 'not_sent', sendCount: 0 },
            emailHistory: [...(po.emailHistory || [])].sort(
                (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
            )
        });
    } catch (error) {
        console.error('Error fetching purchase order email history:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching email history' });
    }
};

// @desc    Download / view generated Purchase Order PDF
// @route   GET /api/purchase-orders/:id/pdf
// @access  Private/Admin
export const downloadPurchaseOrderPDF = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid Purchase Order ID' });
        }

        const po = await PurchaseOrder.findById(req.params.id).populate('supplierId');
        if (!po || po.isActive === false) {
            return res.status(404).json({ message: 'Purchase Order not found' });
        }

        const settings = await EmailService.getSettings();
        const pdfBuffer = await generatePurchaseOrderPDF(po, po.supplierId || {}, settings);
        const safePoNum = String(po.purchaseOrderNumber || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `GSK_PO_${safePoNum}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating Purchase Order PDF:', error);
        return res.status(500).json({ message: 'Failed to generate Purchase Order PDF' });
    }
};
