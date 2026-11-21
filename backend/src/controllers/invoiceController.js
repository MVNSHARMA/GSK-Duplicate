import Invoice from '../models/Invoice.js';
import InvoiceEmailLog from '../models/InvoiceEmailLog.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import VehicleBatchMembership from '../models/VehicleBatchMembership.js';
import JobCard from '../models/JobCard.js';
import Quote from '../models/Quote.js';
import Inventory from '../models/Inventory.js';
import AuditLog from '../models/AuditLog.js';
import { withTransaction } from '../utils/transaction.js';
import EmailService from '../services/EmailService.js';
import { generateInvoicePDF } from '../utils/generateInvoicePDF.js';
import { computeAuthoritativeInvoiceAmounts } from '../utils/emailTemplates.js';
import { calculateTaxAndTotals } from '../utils/taxCalculator.js';
import {
    RETENTION_POLICY,
    SYDNEY_ZONE,
    getEffectiveInvoiceDate,
    buildCustomerSnapshot,
    buildVehicleSnapshot,
    computeInvoiceRetentionInfo,
    computeQuoteRetentionInfo,
    runBatchInvoiceArchival
} from '../utils/retentionPolicy.js';
import {
    createDatabaseBackup,
    listDatabaseBackups,
    pruneExpiredBackups,
    verifyBackupRestoration
} from '../utils/backupService.js';
import mongoose from 'mongoose';
import Sequence from '../models/Sequence.js';
import Setting from '../models/Setting.js';

const EMAIL_ELIGIBLE_INVOICE_STATUSES = ['Unpaid', 'Partially Paid', 'Paid'];
const MAX_CONSOLIDATED_INVOICE_COUNT = 25;
const IN_FLIGHT_LOCK_TTL_MS = 30000;
const inFlightConsolidatedEmailLocks = new Map();
const inFlightSingleEmailLocks = new Map();

const acquireTtlLock = (lockMap, key) => {
    const existingTs = lockMap.get(key);
    const now = Date.now();
    if (existingTs && now - existingTs < IN_FLIGHT_LOCK_TTL_MS) {
        return false;
    }
    lockMap.set(key, now);
    return true;
};

// Helper to generate sequential invoice number atomically
const generateInvoiceNo = async (session) => {
    let sequence = await Sequence.findOne({ key: 'invoiceNumber' }).session(session);

    if (!sequence) {
        // Determine the max numerical suffix across all invoices (migration fallback)
        const invoices = await Invoice.find({}, 'invoiceNo').lean();
        let maxNumber = 999;
        
        invoices.forEach(inv => {
            const parts = inv.invoiceNo?.split('-');
            if (parts && parts.length > 1) {
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            }
        });

        try {
            const created = await Sequence.create([{ key: 'invoiceNumber', value: maxNumber }], { session, ordered: true });
            sequence = created[0];
        } catch (error) {
            if (error.code !== 11000) throw error;
            sequence = await Sequence.findOne({ key: 'invoiceNumber' }).session(session);
        }
    }

    const nextSequence = await Sequence.findOneAndUpdate(
        { key: 'invoiceNumber' },
        { $inc: { value: 1 } },
        { new: true, session }
    );

    const settings = await Setting.findOne().session(session) || {};
    const prefix = settings.invoicePrefix || 'INV-';
    
    // Ensure prefix has a trailing dash if it doesn't already
    const finalPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;

    return `${finalPrefix}${nextSequence.value}`;
};

// @desc    Get all invoices and metrics
// @route   GET /api/invoices
// @access  Private (Admin/SuperAdmin)
import { DateTime } from 'luxon';

export const getInvoices = async (req, res) => {
    try {
        const {
            search,
            status,
            viewMode = 'active',
            jobCardId,
            customerId,
            customerType,
            datePreset,
            customFromDate,
            customToDate,
            page = 1,
            limit = 15
        } = req.query;

        const andConditions = [{ isActive: true }];
        const nowSydney = DateTime.now().setZone(SYDNEY_ZONE);

        // View mode filtering for Data Retention & Archival system
        if (viewMode === 'archived') {
            andConditions.push({ isArchived: true });
        } else if (viewMode === 'cancelled') {
            andConditions.push({ status: { $in: ['Cancelled', 'Voided'] } });
        } else if (viewMode === 'draft_review') {
            const draftCutoff = nowSydney.minus({ days: RETENTION_POLICY.DRAFT_REVIEW_INACTIVITY_DAYS }).toJSDate();
            andConditions.push({ status: 'Draft' });
            if (req.query.includeAllDrafts !== 'true') {
                andConditions.push({
                    $or: [
                        { lastMeaningfulActivityAt: { $lte: draftCutoff } },
                        { lastMeaningfulActivityAt: { $exists: false }, updatedAt: { $lte: draftCutoff } }
                    ]
                });
            }
        } else if (viewMode === 'retention_review') {
            const fiveYearCutoff = nowSydney.minus({ years: RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS }).toJSDate();
            andConditions.push({ status: { $in: ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled', 'Voided'] } });
            andConditions.push({
                $or: [
                    { invoiceDate: { $lte: fiveYearCutoff } },
                    { invoiceDate: { $exists: false }, createdAt: { $lte: fiveYearCutoff } },
                    { 'retentionMetadata.legalHold': true }
                ]
            });
        } else if (viewMode === 'active') {
            andConditions.push({ isArchived: { $ne: true } });
            if (!status || status === 'All') {
                andConditions.push({ status: { $nin: ['Cancelled', 'Voided'] } });
            }
        }

        if (status && status !== 'All') {
            andConditions.push({ status });
        }
        if (jobCardId) {
            andConditions.push({ jobCardId });
        }

        // Filter by canonical customerId and/or customerType (e.g. rental_company)
        if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
            andConditions.push({ customerId: new mongoose.Types.ObjectId(customerId) });
        } else if (customerType && customerType !== 'All' && customerType !== 'all') {
            const typeCustomerIds = await Customer.find({ customerType }).distinct('_id');
            andConditions.push({
                $or: [
                    { customerId: { $in: typeCustomerIds } },
                    { 'customerSnapshot.customerType': customerType }
                ]
            });
        }

        // --- Server-side Time Filter (Australia/Sydney) ---
        if (datePreset && datePreset !== 'all') {
            let start, end;
            
            if (datePreset === 'today') {
                start = nowSydney.startOf('day').toJSDate();
                end = nowSydney.endOf('day').toJSDate();
            } else if (datePreset === 'last_7_days') {
                start = nowSydney.minus({ days: 7 }).startOf('day').toJSDate();
                end = nowSydney.endOf('day').toJSDate();
            } else if (datePreset === 'last_30_days') {
                start = nowSydney.minus({ days: 30 }).startOf('day').toJSDate();
                end = nowSydney.endOf('day').toJSDate();
            } else if (datePreset === 'custom' && (customFromDate || customToDate)) {
                start = customFromDate
                    ? DateTime.fromISO(customFromDate, { zone: SYDNEY_ZONE }).startOf('day').toJSDate()
                    : new Date(0);
                end = customToDate
                    ? DateTime.fromISO(customToDate, { zone: SYDNEY_ZONE }).endOf('day').toJSDate()
                    : nowSydney.endOf('day').toJSDate();
            }

            if (start && end) {
                andConditions.push({
                    $or: [
                        { invoiceDate: { $gte: start, $lte: end } },
                        { createdAt: { $gte: start, $lte: end } }
                    ]
                });
            }
        }

        if (search) {
            const trimmedSearch = search.trim();
            const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // 1. Search canonical Customer records by name, email, or phone
            const customerFilter = {
                $or: [
                    { name: { $regex: escapedSearch, $options: 'i' } },
                    { email: { $regex: escapedSearch, $options: 'i' } },
                    { phone: { $regex: escapedSearch, $options: 'i' } }
                ]
            };
            if (customerType && customerType !== 'All' && customerType !== 'all') {
                customerFilter.customerType = customerType;
            }
            const customerIds = await Customer.find(customerFilter).distinct('_id');

            // 2. Search by vehicle registration number (regular Vehicle + fleet/rental VehicleBatchMembership)
            const [vehicleIds, trackerCarIds] = await Promise.all([
                Vehicle.find({
                    registrationNumber: { $regex: escapedSearch, $options: 'i' }
                }).distinct('_id'),
                VehicleBatchMembership.find({
                    registrationNumber: { $regex: escapedSearch, $options: 'i' }
                }).distinct('_id')
            ]);

            // 3. Search by Job Card number (JC-XXXX format → match last 4 hex chars of _id)
            let jobCardIds = [];
            const jcMatch = trimmedSearch.match(/^JC-?([A-Fa-f0-9]{1,4})$/i);
            if (jcMatch) {
                const suffix = jcMatch[1].toLowerCase();
                const allJobCardIds = await JobCard.find({ isActive: true }, '_id').lean();
                const matchingJcIds = allJobCardIds
                    .filter(jc => jc._id.toString().slice(-suffix.length).toLowerCase() === suffix)
                    .map(jc => jc._id);
                if (matchingJcIds.length > 0) {
                    jobCardIds = matchingJcIds;
                }
            }

            // Build $or conditions (including immutable customerSnapshot & vehicleSnapshot for archived/retained records)
            const orConditions = [
                { invoiceNo: { $regex: escapedSearch, $options: 'i' } },
                { 'customerSnapshot.name': { $regex: escapedSearch, $options: 'i' } },
                { 'customerSnapshot.email': { $regex: escapedSearch, $options: 'i' } },
                { 'customerSnapshot.phone': { $regex: escapedSearch, $options: 'i' } },
                { 'vehicleSnapshot.registrationNumber': { $regex: escapedSearch, $options: 'i' } }
            ];
            if (mongoose.Types.ObjectId.isValid(trimmedSearch)) {
                orConditions.push({ customerId: new mongoose.Types.ObjectId(trimmedSearch) });
                orConditions.push({ _id: new mongoose.Types.ObjectId(trimmedSearch) });
            }
            if (customerIds.length > 0) {
                orConditions.push({ customerId: { $in: customerIds } });
            }
            if (vehicleIds.length > 0) {
                orConditions.push({ vehicleId: { $in: vehicleIds } });
            }
            if (trackerCarIds.length > 0) {
                orConditions.push({ trackerCarId: { $in: trackerCarIds } });
            }
            if (jobCardIds.length > 0) {
                orConditions.push({ jobCardId: { $in: jobCardIds } });
            }

            andConditions.push({ $or: orConditions });
        }

        const query = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

        const parsedLimit = Math.min(Math.max(parseInt(limit) || 15, 1), 200);
        const parsedPage = Math.max(parseInt(page) || 1, 1);
        const skip = (parsedPage - 1) * parsedLimit;

        const [invoices, total, metricsAgg] = await Promise.all([
            Invoice.find(query)
                .select('-emailHistory.htmlContent -emailHistory.textContent')
                .populate('customerId', 'name phone email address customerType')
                .populate('vehicleId', 'brand model year registrationNumber mileage vin')
                .populate('jobCardId', 'status trackerId trackerCarId mechanic')
                .populate('trackerCarId', 'make model year registrationNumber vin finalOdometer')
                .populate('emailHistory.sentBy', 'name email role')
                .populate('archivedBy', 'name email role')
                .populate('cancellationDetails.cancelledBy', 'name email role')
                .sort({ invoiceDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            Invoice.countDocuments(query),
            // Calculate metrics using aggregation concurrently
            Invoice.aggregate([
                { $match: { isActive: true } },
                {
                    $group: {
                        _id: null,
                        unpaidCount: { $sum: { $cond: [{ $and: [{ $in: ['$status', ['Unpaid', 'Partially Paid']] }, { $ne: ['$isArchived', true] }] }, 1, 0] } },
                        paidCount: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Paid'] }, { $ne: ['$isArchived', true] }] }, 1, 0] } },
                        archivedCount: { $sum: { $cond: [{ $eq: ['$isArchived', true] }, 1, 0] } },
                        cancelledCount: { $sum: { $cond: [{ $in: ['$status', ['Cancelled', 'Voided']] }, 1, 0] } },
                        draftCount: { $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, 1, 0] } },
                        unpaidTotal: { 
                            $sum: { 
                                $cond: [
                                    { $and: [{ $in: ['$status', ['Unpaid', 'Partially Paid']] }, { $ne: ['$isArchived', true] }] }, 
                                    { $subtract: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$amountPaid', 0] }] }, 
                                    0
                                ] 
                            } 
                        },
                        paidTotal: { 
                            $sum: { 
                                $cond: [{ $and: [{ $eq: ['$status', 'Paid'] }, { $ne: ['$isArchived', true] }] }, { $ifNull: ['$totalAmount', 0] }, 0] 
                            } 
                        }
                    }
                }
            ])
        ]);

        const processedInvoices = invoices.map(inv => {
            const obj = inv.toObject ? inv.toObject() : { ...inv };
            if (obj.status === 'Paid' && !obj.amountPaid) {
                obj.amountPaid = obj.totalAmount;
            }
            obj.retentionInfo = computeInvoiceRetentionInfo(obj);
            return obj;
        });

        const metrics = metricsAgg.length > 0 ? {
            unpaidCount: metricsAgg[0].unpaidCount,
            paidCount: metricsAgg[0].paidCount,
            archivedCount: metricsAgg[0].archivedCount || 0,
            cancelledCount: metricsAgg[0].cancelledCount || 0,
            draftCount: metricsAgg[0].draftCount || 0,
            unpaidTotal: metricsAgg[0].unpaidTotal,
            paidTotal: metricsAgg[0].paidTotal
        } : { unpaidCount: 0, paidCount: 0, archivedCount: 0, cancelledCount: 0, draftCount: 0, unpaidTotal: 0, paidTotal: 0 };

        res.status(200).json({
            success: true,
            data: processedInvoices,
            pagination: {
                total,
                page: parsedPage,
                limit: parsedLimit,
                pages: Math.ceil(total / parsedLimit)
            },
            metrics
        });
    } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({ success: false, error: "Server Error fetching invoices" });
    }
};

// @desc    Get single invoice by ID
// @route   GET /api/invoices/:id
// @access  Private (Admin/SuperAdmin)
export const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customerId', 'name phone email address customerType')
            .populate('vehicleId', 'brand model year registrationNumber mileage vin')
            .populate('jobCardId', 'status trackerId trackerCarId mechanic')
            .populate('trackerCarId', 'make model year registrationNumber vin finalOdometer')
            .populate('emailHistory.sentBy', 'name email role')
            .populate('archivedBy', 'name email role')
            .populate('cancellationDetails.cancelledBy', 'name email role');

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        const obj = invoice.toObject();
        if (obj.status === 'Paid' && !obj.amountPaid) {
            obj.amountPaid = obj.totalAmount;
        }
        obj.retentionInfo = computeInvoiceRetentionInfo(obj);

        res.status(200).json({ success: true, data: obj });
    } catch (error) {
        console.error("Error fetching invoice:", error);
        res.status(500).json({ success: false, error: "Server Error fetching invoice" });
    }
};

// @desc    Create a new invoice
// @route   POST /api/invoices
// @access  Private (Admin/SuperAdmin)
export const createInvoice = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({
                success: false,
                error: 'Mechanics are not authorized to generate invoices.'
            });
        }

        const newInvoice = await withTransaction(async (session) => {
            const invoiceNo = await generateInvoiceNo(session);

            let finalCustomerId = req.body.customerId;
            let finalVehicleId = req.body.vehicleId;
            let jobCardDiscountAmount = 0;
            let jobCardFinalAmountOverride = null;
            let jobCardGstRate = null;

            if (req.body.jobCardId) {
                const existing = await Invoice.findOne({ jobCardId: req.body.jobCardId, isActive: true }).session(session);
                if (existing) {
                    throw new Error('An Invoice already exists for this Job Card.');
                }
                
                // Authoritative mapping from Job Card
                const jobCard = await JobCard.findById(req.body.jobCardId)
                    .populate('partsUsed.inventoryId', 'itemName partNumber')
                    .session(session);
                if (!jobCard || !jobCard.isActive) {
                    throw new Error('Job Card not found or is inactive.');
                }

                // Stage 5 Gate: Job Card must be Completed AND financially finalized by Admin / Super Admin
                if (jobCard.status !== 'Completed') {
                    throw new Error('Job Card must be marked as Completed before generating an invoice.');
                }
                if (!jobCard.financialsFinalized) {
                    throw new Error('Job Card financial amount must be reviewed and finalized by an Administrator before generating an invoice.');
                }

                // Validate ownership: if customer was provided, it must match the job card
                if (req.body.customerId && jobCard.customerId.toString() !== req.body.customerId.toString()) {
                    throw new Error('Job Card does not belong to the selected Customer.');
                }
                // Validate vehicle ownership if provided
                if (req.body.vehicleId && jobCard.vehicleId && jobCard.vehicleId.toString() !== req.body.vehicleId.toString()) {
                    throw new Error('Job Card does not belong to the selected Vehicle.');
                }

                finalCustomerId = jobCard.customerId;
                finalVehicleId = jobCard.vehicleId || undefined;
                    
                if (jobCard.trackerId && jobCard.trackerCarId) {
                    req.body.trackerId = jobCard.trackerId;
                    req.body.trackerCarId = jobCard.trackerCarId;
                }

                // Map parts, services, labour, and charges from finalized Job Card authoritative record
                const jobCardPartsAndLabour = [];
                if (jobCard.partsUsed && jobCard.partsUsed.length > 0) {
                    jobCard.partsUsed.forEach(p => {
                        const itemName = p.inventoryId?.itemName || 'Part';
                        jobCardPartsAndLabour.push({
                            inventoryId: p.inventoryId?._id || p.inventoryId,
                            variantId: p.variantId,
                            description: p.variantName ? `${itemName} - ${p.variantName}` : itemName,
                            qty: p.quantity,
                            price: p.unitPrice
                        });
                    });
                }
                if (jobCard.servicesProvided && jobCard.servicesProvided.length > 0) {
                    jobCard.servicesProvided.forEach(s => {
                        jobCardPartsAndLabour.push({
                            description: s.name,
                            qty: s.quantity,
                            price: s.cost
                        });
                    });
                }
                if (jobCard.labourHours && jobCard.hourlyRate) {
                    jobCardPartsAndLabour.push({
                        description: 'Labour',
                        qty: jobCard.labourHours,
                        price: jobCard.hourlyRate
                    });
                }
                if (jobCard.charges?.lubricantsOil) jobCardPartsAndLabour.push({ description: 'Lubricants/ Engine Oil', qty: 1, price: jobCard.charges.lubricantsOil });
                if (jobCard.charges?.transmission) jobCardPartsAndLabour.push({ description: 'Transmission', qty: 1, price: jobCard.charges.transmission });
                if (jobCard.charges?.differentialOil) jobCardPartsAndLabour.push({ description: 'Differential Oil', qty: 1, price: jobCard.charges.differentialOil });
                if (jobCard.charges?.brakeFluid) jobCardPartsAndLabour.push({ description: 'Brake Fluid', qty: 1, price: jobCard.charges.brakeFluid });
                if (jobCard.charges?.miscellaneous) jobCardPartsAndLabour.push({ description: 'Miscellaneous', qty: 1, price: jobCard.charges.miscellaneous });

                jobCardDiscountAmount = jobCard.discountAmount || 0;
                jobCardFinalAmountOverride = jobCard.finalAmount ?? jobCard.totalAmount ?? null;
                jobCardGstRate = jobCard.gstRate ?? null;

                req.body.partsAndLabour = jobCardPartsAndLabour;
                req.body.mechanic = jobCard.mechanic;
            }

            // Calculate exact tax breakdown
            const financialTotals = await calculateTaxAndTotals({
                partsAndLabour: req.body.partsAndLabour || [],
                discountAmount: jobCardDiscountAmount,
                finalAmountOverride: jobCardFinalAmountOverride,
                gstRate: jobCardGstRate
            });

            const requestedStatus = req.body.status === 'Draft' ? 'Draft' : (req.body.status === 'Paid' ? 'Paid' : 'Unpaid');
            const effectiveInvoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date();
            const retainUntilDate = DateTime.fromJSDate(effectiveInvoiceDate, { zone: SYDNEY_ZONE })
                .plus({ years: RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS })
                .toJSDate();

            const [customerDoc, vehicleDoc] = await Promise.all([
                finalCustomerId ? Customer.findById(finalCustomerId).session(session).lean() : null,
                finalVehicleId
                    ? Vehicle.findById(finalVehicleId).session(session).lean()
                    : (req.body.trackerCarId ? VehicleBatchMembership.findById(req.body.trackerCarId).session(session).lean() : null)
            ]);

            const customerSnapshot = buildCustomerSnapshot(customerDoc, effectiveInvoiceDate);
            const vehicleSnapshot = buildVehicleSnapshot(vehicleDoc);

            const created = await Invoice.create([{
                ...req.body,
                customerId: finalCustomerId,
                vehicleId: finalVehicleId || undefined,
                trackerId: req.body.trackerId || undefined,
                trackerCarId: req.body.trackerCarId || undefined,
                invoiceNo,
                status: requestedStatus,
                invoiceDate: effectiveInvoiceDate,
                issuedAt: requestedStatus === 'Draft' ? null : effectiveInvoiceDate,
                paidAt: requestedStatus === 'Paid' ? effectiveInvoiceDate : (req.body.paidAt || undefined),
                amountPaid: requestedStatus === 'Paid' ? financialTotals.totalAmount : (req.body.amountPaid || 0),
                customerSnapshot: customerSnapshot || undefined,
                vehicleSnapshot: vehicleSnapshot || undefined,
                lastMeaningfulActivityAt: new Date(),
                retentionMetadata: {
                    retentionPeriodYears: RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS,
                    retainUntil: retainUntilDate,
                    legalHold: Boolean(req.body.retentionMetadata?.legalHold),
                    legalHoldReason: req.body.retentionMetadata?.legalHoldReason || '',
                    reviewStatus: 'not_due',
                    draftReviewStatus: 'active'
                },
                subtotal: financialTotals.subtotal,
                gstRate: financialTotals.gstRate,
                gstAmount: financialTotals.gstAmount,
                totalAmount: financialTotals.totalAmount
            }], { session });

            const invoice = created[0];

            // Inventory Sync Logic for standalone Invoices (only deduct when issued, not for Drafts)
            if (invoice.status !== 'Draft' && !invoice.jobCardId && invoice.partsAndLabour && invoice.partsAndLabour.length > 0) {
                for (const part of invoice.partsAndLabour) {
                    if (part.inventoryId) {
                        const item = await Inventory.findById(part.inventoryId).session(session);
                        if (!item) throw new Error(`Inventory item not found`);

                        const qtyToDeduct = part.qty || 1;

                        if (part.variantId) {
                            const variant = item.variants.id(part.variantId);
                            if (!variant) throw new Error(`Inventory variant not found`);
                            if (variant.quantity - qtyToDeduct < 0) {
                                throw new Error(`Insufficient stock for ${item.itemName} - ${variant.name}. Available: ${variant.quantity}, Requested: ${qtyToDeduct}`);
                            }

                            await Inventory.updateOne(
                                { _id: part.inventoryId, "variants._id": part.variantId },
                                { $inc: { "variants.$.quantity": -qtyToDeduct } },
                                { session }
                            );
                        } else {
                            if (item.quantity - qtyToDeduct < 0) {
                                throw new Error(`Insufficient stock for ${item.itemName}. Available: ${item.quantity}, Requested: ${qtyToDeduct}`);
                            }

                            await Inventory.updateOne(
                                { _id: part.inventoryId },
                                { $inc: { quantity: -qtyToDeduct } },
                                { session }
                            );
                        }
                    }
                }
            }

            // Log action
            await AuditLog.create([{
                actor: req.user._id,
                action: 'CREATE_INVOICE',
                target: invoice._id.toString(),
                metadata: { invoiceNo, type: req.body.type },
                ipAddress: req.ip
            }], { session });

            return invoice;
        });

        // Send Invoice Email outside transaction (unless skipAutoEmail is requested or invoice is a Draft)
        if (!req.body.skipAutoEmail && newInvoice.status !== 'Draft') {
            try {
                const populatedInvoice = await Invoice.findById(newInvoice._id)
                    .populate('customerId')
                    .populate('vehicleId')
                    .populate('trackerCarId');
                
                if (populatedInvoice && populatedInvoice.customerId?.email && !populatedInvoice.invoiceEmailSent) {
                    const emailSent = await EmailService.sendInvoiceEmail(populatedInvoice);
                    if (emailSent) {
                        const sentAt = new Date();
                        await Invoice.updateOne(
                            { _id: populatedInvoice._id },
                            {
                                $set: {
                                    invoiceEmailSent: true,
                                    invoiceEmailSentAt: sentAt,
                                    lastEmailStatus: {
                                        status: 'accepted',
                                        mode: 'single',
                                        sentAt,
                                        recipientEmail: populatedInvoice.customerId.email.toLowerCase(),
                                        sentBy: req.user?._id || null,
                                        sentByName: req.user?.name || 'GSK Automotive Admin',
                                        brevoMessageId: emailSent.messageId || '',
                                        batchId: null,
                                        invoiceNumbersInBatch: [populatedInvoice.invoiceNo],
                                        invoiceCountInBatch: 1,
                                        failureReason: null
                                    }
                                },
                                $push: {
                                    emailHistory: {
                                        batchId: null,
                                        mode: 'single',
                                        customerId: populatedInvoice.customerId._id,
                                        recipientEmail: populatedInvoice.customerId.email.toLowerCase(),
                                        invoiceIds: [populatedInvoice._id],
                                        invoiceNumbers: [populatedInvoice.invoiceNo],
                                        invoiceCount: 1,
                                        combinedAmount: Number(populatedInvoice.totalAmount || 0),
                                        sentBy: req.user?._id || null,
                                        sentByName: req.user?.name || 'GSK Automotive Admin',
                                        sentAt,
                                        brevoMessageId: emailSent.messageId || '',
                                        status: 'accepted',
                                        failureReason: null,
                                        pdfFilename: emailSent.pdfFilename || `GSK-Automotive-Invoice-${populatedInvoice.invoiceNo}.pdf`,
                                        isResend: false
                                    }
                                }
                            }
                        );
                    }
                }
            } catch (emailErr) {
                console.error("Failed to send invoice email:", emailErr);
            }
        }

        res.status(201).json({
            success: true,
            data: newInvoice
        });
    } catch (error) {
        console.error("Error creating invoice:", error);
        const validationMessages = [
            'An Invoice already exists for this Job Card.',
            'Job Card not found or is inactive.',
            'Job Card must be marked as Completed before generating an invoice.',
            'Job Card financial amount must be reviewed and finalized by an Administrator before generating an invoice.',
            'Job Card does not belong to the selected Customer.',
            'Job Card does not belong to the selected Vehicle.'
        ];
        if (validationMessages.includes(error.message)) {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message && error.message.includes('Insufficient stock')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: "Server Error creating invoice" });
    }
};

// @desc    Update an invoice (e.g., mark as paid)
// @route   PUT /api/invoices/:id
// @access  Private (Admin/SuperAdmin)
export const updateInvoice = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({
                success: false,
                error: 'Mechanics are not authorized to modify invoices.'
            });
        }

        const updatedInvoice = await withTransaction(async (session) => {
            const invoice = await Invoice.findById(req.params.id).session(session);

            if (!invoice) {
                throw new Error('Invoice not found');
            }

            // 1. Read-Only Archive enforcement (>2 years archived records are strictly read-only)
            if (invoice.isArchived || invoice.archiveStatus === 'archived') {
                const err = new Error('Archived invoices are read-only and cannot be modified.');
                err.statusCode = 403;
                throw err;
            }

            // 2. Cancelled or Voided invoices are immutable audit records
            if (invoice.status === 'Cancelled' || invoice.status === 'Voided') {
                const err = new Error('Cancelled or voided invoices are immutable audit records and cannot be modified.');
                err.statusCode = 403;
                throw err;
            }

            // 3. Handle transition to Cancelled or Voided via updateInvoice
            if (req.body.status === 'Cancelled' || req.body.status === 'Voided') {
                const actionType = req.body.status;
                const cancelReason = (req.body.cancellationReason || req.body.reason || 'Administrative billing correction').trim();
                const cancelledAt = new Date();
                const actorName = req.user?.name || req.user?.email || 'Administrator';

                // Restore standalone inventory if previously deducted (i.e. was not a Draft)
                if (invoice.status !== 'Draft' && !invoice.jobCardId && invoice.partsAndLabour && invoice.partsAndLabour.length > 0) {
                    for (const part of invoice.partsAndLabour) {
                        if (part.inventoryId) {
                            const qtyToRestore = part.qty || 1;
                            if (part.variantId) {
                                await Inventory.updateOne(
                                    { _id: part.inventoryId, 'variants._id': part.variantId },
                                    { $inc: { 'variants.$.quantity': qtyToRestore } },
                                    { session }
                                );
                            } else {
                                await Inventory.updateOne(
                                    { _id: part.inventoryId },
                                    { $inc: { quantity: qtyToRestore } },
                                    { session }
                                );
                            }
                        }
                    }
                }

                // Ensure customerSnapshot is preserved on cancelled/voided invoice
                let snapshotToKeep = invoice.customerSnapshot;
                if (!snapshotToKeep || !snapshotToKeep.name) {
                    const cust = await Customer.findById(invoice.customerId).session(session).lean();
                    snapshotToKeep = buildCustomerSnapshot(cust, invoice.invoiceDate || invoice.createdAt || cancelledAt);
                }

                const existingHistory = invoice.cancellationDetails?.history || [];
                const updated = await Invoice.findByIdAndUpdate(
                    req.params.id,
                    {
                        $set: {
                            status: actionType,
                            customerSnapshot: snapshotToKeep,
                            lastMeaningfulActivityAt: cancelledAt,
                            cancellationDetails: {
                                cancelledAt,
                                cancelledBy: req.user?._id || null,
                                cancelledByName: actorName,
                                reason: cancelReason,
                                actionType,
                                originalStatus: invoice.status,
                                originalTotalAmount: Number(invoice.totalAmount || 0),
                                history: [
                                    ...existingHistory,
                                    {
                                        action: actionType === 'Voided' ? 'VOID_INVOICE' : 'CANCEL_INVOICE',
                                        status: actionType,
                                        performedBy: req.user?._id || null,
                                        performedByName: actorName,
                                        reason: cancelReason,
                                        performedAt: cancelledAt
                                    }
                                ]
                            }
                        }
                    },
                    { new: true, runValidators: true, session }
                );

                await AuditLog.create([{
                    actor: req.user._id,
                    action: actionType === 'Voided' ? 'VOID_INVOICE' : 'CANCEL_INVOICE',
                    target: invoice._id.toString(),
                    metadata: {
                        invoiceNo: invoice.invoiceNo,
                        actionType,
                        reason: cancelReason,
                        originalStatus: invoice.status,
                        originalTotalAmount: invoice.totalAmount
                    },
                    ipAddress: req.ip
                }], { session });

                return updated;
            }

            const partsAndLabour = req.body.partsAndLabour || invoice.partsAndLabour || [];
            const financialTotals = await calculateTaxAndTotals({
                partsAndLabour,
                gstRate: invoice.gstRate // Keep existing rate if it exists, otherwise it fetches current setting
            });

            // 4. Preserve original customerSnapshot on issued invoices; only refresh if invoice was Draft
            const safeBody = { ...req.body };
            delete safeBody.customerSnapshot;
            delete safeBody.isArchived;
            delete safeBody.archiveStatus;
            delete safeBody.archivedAt;
            delete safeBody.cancellationDetails;

            const updatePayload = {
                ...safeBody,
                lastMeaningfulActivityAt: new Date(),
                subtotal: financialTotals.subtotal,
                gstRate: financialTotals.gstRate,
                gstAmount: financialTotals.gstAmount,
                totalAmount: financialTotals.totalAmount
            };

            if (invoice.status === 'Draft') {
                const targetCustomerId = req.body.customerId || invoice.customerId;
                const cust = targetCustomerId ? await Customer.findById(targetCustomerId).session(session).lean() : null;
                if (cust) {
                    updatePayload.customerSnapshot = buildCustomerSnapshot(cust, new Date());
                }
                if (req.body.status && req.body.status !== 'Draft') {
                    updatePayload.issuedAt = new Date();
                    if (!invoice.invoiceDate) {
                        updatePayload.invoiceDate = new Date();
                    }
                }
                if (invoice.retentionMetadata?.draftReviewStatus === 'pending_review') {
                    updatePayload['retentionMetadata.draftReviewStatus'] = 'active';
                }
            } else if (!invoice.customerSnapshot || !invoice.customerSnapshot.name) {
                const cust = await Customer.findById(invoice.customerId).session(session).lean();
                if (cust) {
                    updatePayload.customerSnapshot = buildCustomerSnapshot(cust, invoice.invoiceDate || invoice.createdAt || new Date());
                }
            }
            
            // If the status is being set to Paid, ensure amountPaid reflects the total
            if (req.body.status === 'Paid') {
                updatePayload.amountPaid = financialTotals.totalAmount;
                if (invoice.status !== 'Paid' && !invoice.paidAt) {
                    updatePayload.paidAt = new Date();
                }
            } else if (req.body.status === 'Unpaid') {
                updatePayload.amountPaid = 0;
                if (invoice.status === 'Paid') {
                    updatePayload.paidAt = null; // Reset if transitioning away from Paid
                }
            } else if (req.body.status === 'Partially Paid' && invoice.status === 'Paid') {
                updatePayload.paidAt = null; // Reset if transitioning away from Paid
            }

            const updated = await Invoice.findByIdAndUpdate(
                req.params.id,
                updatePayload,
                { new: true, runValidators: true, session }
            );

            // --- Inventory Sync Logic for standalone Invoices ---
            if (!invoice.jobCardId && !updated.jobCardId) {
                const getPartsMap = (partsArray, statusVal) => {
                    if (!partsArray || statusVal === 'Draft') return {};
                    return partsArray.reduce((acc, part) => {
                        if (part.inventoryId) {
                            const id = part.variantId ? `${part.inventoryId.toString()}:${part.variantId.toString()}` : part.inventoryId.toString();
                            acc[id] = (acc[id] || 0) + (part.qty || 1);
                        }
                        return acc;
                    }, {});
                };

                const oldPartsMap = getPartsMap(invoice.partsAndLabour, invoice.status);
                const newPartsMap = getPartsMap(updated.partsAndLabour, updated.status);

                const inventoryDeltas = {};
                for (const [id, qty] of Object.entries(newPartsMap)) {
                    inventoryDeltas[id] = (inventoryDeltas[id] || 0) + qty;
                }
                for (const [id, qty] of Object.entries(oldPartsMap)) {
                    inventoryDeltas[id] = (inventoryDeltas[id] || 0) - qty;
                }

                for (const [key, delta] of Object.entries(inventoryDeltas)) {
                    if (delta !== 0) {
                        if (key.includes(':')) {
                            const [invId, varId] = key.split(':');
                            const item = await Inventory.findById(invId).session(session);
                            if (!item) throw new Error(`Inventory item not found`);
                            const variant = item.variants.id(varId);
                            if (!variant) throw new Error(`Inventory variant not found`);
                            if (variant.quantity - delta < 0) {
                                throw new Error(`Insufficient stock for ${item.itemName} - ${variant.name}. Available: ${variant.quantity}, Requested: ${delta}`);
                            }
                            
                            await Inventory.updateOne(
                                { _id: invId, "variants._id": varId },
                                { $inc: { "variants.$.quantity": -delta } },
                                { session }
                            );
                        } else {
                            const item = await Inventory.findById(key).session(session);
                            if (!item) throw new Error(`Inventory item not found`);
                            if (item.quantity - delta < 0) {
                                throw new Error(`Insufficient stock for ${item.itemName}. Available: ${item.quantity}, Requested: ${delta}`);
                            }
                            
                            await Inventory.updateOne(
                                { _id: key },
                                { $inc: { quantity: -delta } },
                                { session }
                            );
                        }
                    }
                }
            }
            // ----------------------------------------------------

            // Log action
            await AuditLog.create([{
                actor: req.user._id,
                action: 'UPDATE_INVOICE',
                target: invoice._id.toString(),
                metadata: { status: updated.status },
                ipAddress: req.ip
            }], { session });

            return updated;
        });

        res.status(200).json({
            success: true,
            data: updatedInvoice
        });
    } catch (error) {
        console.error("Error updating invoice:", error);
        if (error.message === 'Invoice not found') {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }
        if (error.statusCode === 403) {
            return res.status(403).json({ success: false, error: error.message });
        }
        if (error.message && error.message.includes('Insufficient stock')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: "Server Error updating invoice" });
    }
};

// @desc    Delete (soft delete) an invoice — enforced by Data Retention Policy
// @route   DELETE /api/invoices/:id
// @access  Private (Admin/SuperAdmin)
export const deleteInvoice = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({
                success: false,
                error: 'Mechanics are not authorized to delete invoices.'
            });
        }

        const invoice = await Invoice.findById(req.params.id).populate('jobCardId', 'status');

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        if (invoice.isArchived || invoice.archiveStatus === 'archived') {
            return res.status(403).json({
                success: false,
                code: 'ARCHIVED_READ_ONLY',
                error: 'Archived invoices are read-only and cannot be deleted.'
            });
        }

        // Issued, Paid, Cancelled, and Voided invoices must be retained for at least 5 years and cannot be deleted via ordinary admin delete.
        if (invoice.status !== 'Draft') {
            return res.status(403).json({
                success: false,
                code: 'RETENTION_PROTECTED_RECORD',
                error: `Issued, paid, cancelled, and voided financial records (${invoice.invoiceNo}) must be retained for at least ${RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS} years under the official Data Retention Policy and cannot be deleted. Use Cancel or Void to record a billing cancellation.`
            });
        }

        // Draft invoice protection: check if linked to an active Job Card
        const retentionInfo = computeInvoiceRetentionInfo(invoice);
        if (retentionInfo.hasActiveJobCard) {
            return res.status(400).json({
                success: false,
                code: 'DRAFT_ACTIVE_JOB_CARD',
                error: 'Cannot delete a draft invoice while it is linked to an active Job Card.'
            });
        }

        invoice.isActive = false;
        invoice.lastMeaningfulActivityAt = new Date();
        if (invoice.retentionMetadata) {
            invoice.retentionMetadata.draftReviewStatus = 'approved_for_deletion';
            invoice.retentionMetadata.lastReviewedAt = new Date();
            invoice.retentionMetadata.lastReviewedBy = req.user?._id || null;
            invoice.retentionMetadata.lastReviewedByName = req.user?.name || 'Admin';
        }
        await invoice.save();

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'DELETE_DRAFT_INVOICE',
            target: invoice._id.toString(),
            metadata: {
                invoiceNo: invoice.invoiceNo,
                status: invoice.status,
                draftInactiveDays: retentionInfo.draftInactiveDays
            },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error("Error deleting invoice:", error);
        res.status(500).json({ success: false, error: "Server Error deleting invoice" });
    }
};


// @desc    Manually send a single invoice email
// @route   POST /api/invoices/:id/send-email
// @access  Private (Admin/SuperAdmin)
export const sendInvoiceEmail = async (req, res) => {
    const invoiceIdStr = String(req.params.id || '');
    if (!acquireTtlLock(inFlightSingleEmailLocks, invoiceIdStr)) {
        return res.status(409).json({
            success: false,
            code: 'DUPLICATE_REQUEST_IN_FLIGHT',
            error: 'An email send request for this invoice is already in progress.'
        });
    }

    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customerId', 'name phone email address customerType')
            .populate('vehicleId', 'brand model year registrationNumber mileage vin')
            .populate('trackerCarId', 'make model year registrationNumber vin finalOdometer');

        if (!invoice || invoice.isActive === false) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const customerEmail = String(invoice.customerId?.email || '').trim().toLowerCase();
        if (!customerEmail || !emailRegex.test(customerEmail)) {
            return res.status(400).json({ success: false, error: 'Customer does not have an email address.' });
        }

        const isResend = Boolean(invoice.invoiceEmailSent);
        const result = await EmailService.sendInvoiceEmail(invoice, {
            sandbox: Boolean(req.body?.sandbox)
        });

        if (result) {
            const sentAt = new Date();
            const messageId = typeof result === 'object' ? (result.messageId || '') : '';
            const pdfFilename = typeof result === 'object' && result.pdfFilename
                ? result.pdfFilename
                : `GSK-Automotive-Invoice-${invoice.invoiceNo || 'Draft'}.pdf`;

            let batchLog = null;
            try {
                batchLog = await InvoiceEmailLog.create({
                    customerId: invoice.customerId._id,
                    customerName: invoice.customerId.name || '',
                    recipientEmail: customerEmail,
                    invoiceIds: [invoice._id],
                    invoiceNumbers: [invoice.invoiceNo],
                    invoiceCount: 1,
                    combinedAmount: Number(invoice.totalAmount || 0),
                    mode: 'single',
                    subject: `Your GSK Automotive Invoice — ${invoice.invoiceNo}`,
                    sentBy: req.user?._id || null,
                    sentByName: req.user?.name || 'GSK Automotive Admin',
                    sentAt,
                    brevoMessageId: messageId,
                    status: 'accepted',
                    failureReason: null,
                    attachmentFilenames: [pdfFilename],
                    isResend
                });
            } catch (logErr) {
                console.error('[InvoiceController] Warning: Failed to create single InvoiceEmailLog:', logErr.message);
            }

            invoice.invoiceEmailSent = true;
            invoice.invoiceEmailSentAt = sentAt;
            invoice.lastEmailStatus = {
                status: 'accepted',
                mode: 'single',
                sentAt,
                recipientEmail: customerEmail,
                sentBy: req.user?._id || null,
                sentByName: req.user?.name || 'GSK Automotive Admin',
                brevoMessageId: messageId,
                batchId: batchLog?._id || null,
                invoiceNumbersInBatch: [invoice.invoiceNo],
                invoiceCountInBatch: 1,
                failureReason: null
            };
            invoice.emailHistory.push({
                batchId: batchLog?._id || null,
                mode: 'single',
                customerId: invoice.customerId._id,
                recipientEmail: customerEmail,
                invoiceIds: [invoice._id],
                invoiceNumbers: [invoice.invoiceNo],
                invoiceCount: 1,
                combinedAmount: Number(invoice.totalAmount || 0),
                sentBy: req.user?._id || null,
                sentByName: req.user?.name || 'GSK Automotive Admin',
                sentAt,
                brevoMessageId: messageId,
                status: 'accepted',
                failureReason: null,
                pdfFilename,
                isResend
            });
            await invoice.save();

            // Log action
            await AuditLog.create({
                actor: req.user._id,
                action: 'SEND_INVOICE_EMAIL',
                target: invoice._id.toString(),
                metadata: { invoiceNo: invoice.invoiceNo, email: customerEmail, mode: 'single', messageId },
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: 'Email sent successfully.',
                emailStatus: invoice.lastEmailStatus,
                messageId
            });
        } else {
            return res.status(400).json({ success: false, error: 'Invoice email could not be sent because email service is not configured or failed.' });
        }
    } catch (error) {
        console.error("Error sending invoice email:", error.message);
        const isConfigErr = error.message?.includes('Configuration Missing') || error.message?.includes('SMTP');
        res.status(isConfigErr ? 400 : 500).json({ 
            success: false, 
            error: isConfigErr ? "Invoice email could not be sent because email service is not configured." : "Server Error sending email." 
        });
    } finally {
        inFlightSingleEmailLocks.delete(invoiceIdStr);
    }
};

// @desc    Send multiple (or single) invoices for the SAME canonical customer in ONE consolidated Brevo email
// @route   POST /api/invoices/send-consolidated-email
// @route   POST /api/invoices/bulk-email
// @access  Private (Admin/SuperAdmin with invoices.email permission)
export const sendConsolidatedInvoiceEmail = async (req, res) => {
    const rawInvoiceIds = req.body?.invoiceIds;
    if (!Array.isArray(rawInvoiceIds) || rawInvoiceIds.length === 0) {
        return res.status(400).json({
            success: false,
            code: 'NO_INVOICES_SELECTED',
            error: 'Please select at least one invoice to send.'
        });
    }

    const uniqueInvoiceIds = [...new Set(rawInvoiceIds.map(id => String(id || '').trim()).filter(Boolean))];
    if (uniqueInvoiceIds.length === 0) {
        return res.status(400).json({
            success: false,
            code: 'NO_INVOICES_SELECTED',
            error: 'Please select at least one valid invoice to send.'
        });
    }

    if (uniqueInvoiceIds.length > MAX_CONSOLIDATED_INVOICE_COUNT) {
        return res.status(400).json({
            success: false,
            code: 'TOO_MANY_INVOICES_SELECTED',
            error: `A maximum of ${MAX_CONSOLIDATED_INVOICE_COUNT} invoices can be sent in a single consolidated email.`
        });
    }

    const invalidIds = uniqueInvoiceIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
        return res.status(400).json({
            success: false,
            code: 'INVALID_INVOICE_ID',
            error: 'One or more selected invoice IDs are invalid.'
        });
    }

    // Deterministic lock key across the sorted invoice IDs
    const sortedKey = [...uniqueInvoiceIds].sort().join(',');
    if (!acquireTtlLock(inFlightConsolidatedEmailLocks, sortedKey)) {
        return res.status(409).json({
            success: false,
            code: 'DUPLICATE_REQUEST_IN_FLIGHT',
            error: 'A consolidated email request for the selected invoices is already in progress. Please wait.'
        });
    }

    try {
        const idempotencyKey = req.body?.idempotencyKey ? String(req.body.idempotencyKey).trim() : null;
        if (idempotencyKey) {
            const existingBatch = await InvoiceEmailLog.findOne({
                idempotencyKey,
                status: { $in: ['accepted', 'delivered'] }
            });
            if (existingBatch) {
                return res.status(200).json({
                    success: true,
                    duplicatePrevented: true,
                    message: `Consolidated email for ${existingBatch.invoiceCount} invoice(s) was already accepted by Brevo.`,
                    data: existingBatch
                });
            }
        }

        // Fetch all selected invoices with canonical customer and vehicle details
        const fetchedInvoices = await Invoice.find({ _id: { $in: uniqueInvoiceIds } })
            .populate('customerId', 'name phone email address customerType isActive')
            .populate('vehicleId', 'brand model year registrationNumber mileage vin chassisNo')
            .populate('trackerCarId', 'make model year registrationNumber vin finalOdometer')
            .populate('jobCardId', 'status trackerId trackerCarId mechanic');

        // Preserve requested order
        const invoiceById = new Map(fetchedInvoices.map(inv => [String(inv._id), inv]));
        const orderedInvoices = uniqueInvoiceIds.map(id => invoiceById.get(id)).filter(Boolean);

        if (orderedInvoices.length !== uniqueInvoiceIds.length) {
            return res.status(404).json({
                success: false,
                code: 'INVOICE_NOT_FOUND',
                error: 'One or more selected invoices could not be found.'
            });
        }

        // Check invoice eligibility (active and valid status — no draft, voided, or cancelled)
        const ineligibleInvoices = orderedInvoices.filter(
            inv => inv.isActive === false || !EMAIL_ELIGIBLE_INVOICE_STATUSES.includes(inv.status)
        );
        if (ineligibleInvoices.length > 0) {
            return res.status(400).json({
                success: false,
                code: 'INELIGIBLE_INVOICE',
                error: `Invoices (${ineligibleInvoices.map(i => i.invoiceNo).join(', ')}) are not eligible for emailing. Only active Unpaid, Partially Paid, or Paid invoices can be emailed.`,
                ineligibleInvoices: ineligibleInvoices.map(i => ({
                    _id: i._id,
                    invoiceNo: i.invoiceNo,
                    status: i.status,
                    isActive: i.isActive
                }))
            });
        }

        // ============================================================
        // CRITICAL: Customer Consistency Validation (Compare Canonical Customer IDs)
        // ============================================================
        const customerGroupMap = new Map();
        for (const inv of orderedInvoices) {
            const custObj = inv.customerId && typeof inv.customerId === 'object' ? inv.customerId : null;
            const custId = String(custObj?._id || inv.customerId || '').trim();
            const custName = custObj?.name || 'Unknown Customer';

            if (!custId) {
                return res.status(400).json({
                    success: false,
                    code: 'MISSING_INVOICE_CUSTOMER',
                    error: `Invoice ${inv.invoiceNo} is not linked to a valid canonical customer record.`
                });
            }

            if (!customerGroupMap.has(custId)) {
                customerGroupMap.set(custId, {
                    customerId: custId,
                    customerName: custName,
                    customerEmail: custObj?.email || '',
                    invoiceIds: [],
                    invoiceNumbers: []
                });
            }
            const group = customerGroupMap.get(custId);
            group.invoiceIds.push(inv._id);
            group.invoiceNumbers.push(inv.invoiceNo);
        }

        if (customerGroupMap.size > 1) {
            return res.status(400).json({
                success: false,
                code: 'MULTIPLE_CUSTOMERS_SELECTED',
                title: 'Multiple Customers Selected',
                error: 'You have selected invoices belonging to different customers. Please select invoices belonging to a single customer to send them together.',
                customers: Array.from(customerGroupMap.values())
            });
        }

        const [canonicalCustomerId] = customerGroupMap.keys();
        if (req.body?.customerId && String(req.body.customerId).trim() !== canonicalCustomerId) {
            return res.status(400).json({
                success: false,
                code: 'MULTIPLE_CUSTOMERS_SELECTED',
                title: 'Multiple Customers Selected',
                error: 'You have selected invoices belonging to different customers. Please select invoices belonging to a single customer to send them together.'
            });
        }

        // Retrieve canonical customer record directly from Customer collection
        const canonicalCustomer = await Customer.findById(canonicalCustomerId);
        if (!canonicalCustomer) {
            return res.status(404).json({
                success: false,
                code: 'CUSTOMER_NOT_FOUND',
                error: 'Canonical customer record could not be found.'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipientEmail = String(canonicalCustomer.email || '').trim().toLowerCase();
        if (!recipientEmail || !emailRegex.test(recipientEmail)) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_CUSTOMER_EMAIL',
                error: `Customer "${canonicalCustomer.name}" does not have a valid registered email address. Please add a valid email to the customer record before sending invoices.`
            });
        }

        // Prevent automatic resending of previously emailed invoices without explicit confirmation
        const alreadyEmailed = orderedInvoices.filter(inv => Boolean(inv.invoiceEmailSent));
        const resendConfirmed = Boolean(req.body?.resendConfirmed || req.body?.allowResend || req.body?.resend);
        if (alreadyEmailed.length > 0 && !resendConfirmed) {
            return res.status(409).json({
                success: false,
                code: 'ALREADY_EMAILED_CONFIRMATION_REQUIRED',
                error: `Invoice(s) ${alreadyEmailed.map(i => i.invoiceNo).join(', ')} have already been emailed previously. Please confirm resending to proceed.`,
                alreadyEmailedInvoices: alreadyEmailed.map(inv => ({
                    _id: inv._id,
                    invoiceNo: inv.invoiceNo,
                    invoiceEmailSentAt: inv.invoiceEmailSentAt || inv.lastEmailStatus?.sentAt || null
                }))
            });
        }

        const settings = await Setting.findOne() || {};
        const invoiceNumbers = orderedInvoices.map(inv => inv.invoiceNo);
        const expectedCombinedAmount = Number(
            orderedInvoices.reduce((sum, inv) => {
                const amounts = computeAuthoritativeInvoiceAmounts(inv, settings);
                return sum + amounts.totalAmount;
            }, 0).toFixed(2)
        );

        const sentByUserId = req.user?._id || null;
        const sentByName = req.user?.name || req.user?.email || 'GSK Automotive Admin';

        let emailResult;
        try {
            emailResult = await EmailService.sendConsolidatedInvoicesEmail(
                orderedInvoices,
                canonicalCustomer,
                {
                    sandbox: Boolean(req.body?.sandbox),
                    maxAttachmentBytes: req.body?.maxAttachmentBytes
                }
            );
        } catch (sendErr) {
            if (sendErr.code === 'ATTACHMENT_SIZE_LIMIT_EXCEEDED') {
                return res.status(413).json({
                    success: false,
                    code: 'ATTACHMENT_SIZE_LIMIT_EXCEEDED',
                    error: sendErr.message,
                    totalAttachmentBytes: sendErr.totalAttachmentBytes,
                    maxAttachmentBytes: sendErr.maxAttachmentBytes
                });
            }

            // Record failed attempt in InvoiceEmailLog and each invoice's emailHistory without marking invoiceEmailSent=true
            const failedAt = new Date();
            let failedBatch = null;
            try {
                failedBatch = await InvoiceEmailLog.create({
                    customerId: canonicalCustomer._id,
                    customerName: canonicalCustomer.name,
                    recipientEmail,
                    invoiceIds: orderedInvoices.map(i => i._id),
                    invoiceNumbers,
                    invoiceCount: orderedInvoices.length,
                    combinedAmount: expectedCombinedAmount,
                    mode: 'consolidated',
                    subject: `Your Invoices – ${settings?.businessName || 'GSK Automotive'} – ${canonicalCustomer.name}`,
                    sentBy: sentByUserId,
                    sentByName,
                    sentAt: failedAt,
                    brevoMessageId: '',
                    status: 'failed',
                    failureReason: sendErr.message || 'Brevo rejected consolidated email request',
                    attachmentFilenames: invoiceNumbers.map(no => `Invoice_${String(no).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`),
                    isResend: alreadyEmailed.length > 0
                });

                await Invoice.updateMany(
                    { _id: { $in: orderedInvoices.map(i => i._id) } },
                    {
                        $set: {
                            lastEmailStatus: {
                                status: 'failed',
                                mode: 'consolidated',
                                sentAt: failedAt,
                                recipientEmail,
                                sentBy: sentByUserId,
                                sentByName,
                                brevoMessageId: '',
                                batchId: failedBatch._id,
                                invoiceNumbersInBatch: invoiceNumbers,
                                invoiceCountInBatch: orderedInvoices.length,
                                failureReason: sendErr.message || 'Brevo rejected consolidated email request'
                            }
                        },
                        $push: {
                            emailHistory: {
                                batchId: failedBatch._id,
                                mode: 'consolidated',
                                customerId: canonicalCustomer._id,
                                recipientEmail,
                                invoiceIds: orderedInvoices.map(i => i._id),
                                invoiceNumbers,
                                invoiceCount: orderedInvoices.length,
                                combinedAmount: expectedCombinedAmount,
                                sentBy: sentByUserId,
                                sentByName,
                                sentAt: failedAt,
                                brevoMessageId: '',
                                status: 'failed',
                                failureReason: sendErr.message || 'Brevo rejected consolidated email request',
                                pdfFilename: '',
                                isResend: alreadyEmailed.length > 0
                            }
                        }
                    }
                );
            } catch (dbFailErr) {
                console.error('[InvoiceController] Failed to persist failed email log:', dbFailErr.message);
            }

            return res.status(502).json({
                success: false,
                code: 'EMAIL_PROVIDER_FAILED',
                error: `Failed to send consolidated invoices email via Brevo: ${sendErr.message || 'Email provider error'}`
            });
        }

        // Brevo accepted the consolidated email; persist batch log and per-invoice history
        const sentAt = new Date();
        try {
            const batchLog = await InvoiceEmailLog.create({
                customerId: canonicalCustomer._id,
                customerName: canonicalCustomer.name,
                recipientEmail,
                invoiceIds: orderedInvoices.map(i => i._id),
                invoiceNumbers,
                invoiceCount: orderedInvoices.length,
                combinedAmount: emailResult.combinedAmount ?? expectedCombinedAmount,
                mode: 'consolidated',
                subject: emailResult.subject,
                sentBy: sentByUserId,
                sentByName,
                sentAt,
                brevoMessageId: emailResult.messageId || '',
                status: 'accepted',
                failureReason: null,
                attachmentFilenames: emailResult.attachmentFilenames || [],
                totalAttachmentBytes: emailResult.totalAttachmentBytes || 0,
                isResend: alreadyEmailed.length > 0,
                idempotencyKey
            });

            // Update each invoice with its specific PDF filename and consolidated batch info
            // IMPORTANT: Do NOT modify status ('Unpaid'/'Paid'), amountPaid, or financial fields
            await Promise.all(
                orderedInvoices.map((inv, idx) => {
                    const pdfFilename = emailResult.attachmentFilenames?.[idx] || `Invoice_${inv.invoiceNo}.pdf`;
                    return Invoice.updateOne(
                        { _id: inv._id },
                        {
                            $set: {
                                invoiceEmailSent: true,
                                invoiceEmailSentAt: sentAt,
                                lastEmailStatus: {
                                    status: 'accepted',
                                    mode: 'consolidated',
                                    sentAt,
                                    recipientEmail,
                                    sentBy: sentByUserId,
                                    sentByName,
                                    brevoMessageId: emailResult.messageId || '',
                                    batchId: batchLog._id,
                                    invoiceNumbersInBatch: invoiceNumbers,
                                    invoiceCountInBatch: orderedInvoices.length,
                                    failureReason: null
                                }
                            },
                            $push: {
                                emailHistory: {
                                    batchId: batchLog._id,
                                    mode: 'consolidated',
                                    customerId: canonicalCustomer._id,
                                    recipientEmail,
                                    invoiceIds: orderedInvoices.map(i => i._id),
                                    invoiceNumbers,
                                    invoiceCount: orderedInvoices.length,
                                    combinedAmount: emailResult.combinedAmount ?? expectedCombinedAmount,
                                    sentBy: sentByUserId,
                                    sentByName,
                                    sentAt,
                                    brevoMessageId: emailResult.messageId || '',
                                    status: 'accepted',
                                    failureReason: null,
                                    pdfFilename,
                                    isResend: Boolean(inv.invoiceEmailSent)
                                }
                            }
                        }
                    );
                })
            );

            await AuditLog.create({
                actor: sentByUserId,
                action: 'SEND_CONSOLIDATED_INVOICE_EMAIL',
                target: canonicalCustomer._id.toString(),
                metadata: {
                    customerId: canonicalCustomer._id.toString(),
                    customerName: canonicalCustomer.name,
                    recipientEmail,
                    invoiceNumbers,
                    invoiceCount: orderedInvoices.length,
                    combinedAmount: emailResult.combinedAmount ?? expectedCombinedAmount,
                    messageId: emailResult.messageId || ''
                },
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: `Consolidated email with ${orderedInvoices.length} invoice PDF(s) accepted by Brevo for ${recipientEmail}.`,
                data: {
                    batchId: batchLog._id,
                    customerId: canonicalCustomer._id,
                    customerName: canonicalCustomer.name,
                    recipientEmail,
                    invoiceIds: orderedInvoices.map(i => i._id),
                    invoiceNumbers,
                    invoiceCount: orderedInvoices.length,
                    combinedAmount: emailResult.combinedAmount ?? expectedCombinedAmount,
                    attachmentFilenames: emailResult.attachmentFilenames || [],
                    totalAttachmentBytes: emailResult.totalAttachmentBytes || 0,
                    brevoMessageId: emailResult.messageId || '',
                    status: 'accepted',
                    sentAt,
                    sentByName
                }
            });
        } catch (persistErr) {
            console.error(
                `[PARTIAL FAILURE] Consolidated invoice email accepted by Brevo (messageId=${emailResult.messageId}) for ${recipientEmail}, but MongoDB persistence failed:`,
                persistErr
            );
            return res.status(207).json({
                success: false,
                partialFailure: true,
                emailAccepted: true,
                logPersisted: false,
                code: 'PARTIAL_PERSISTENCE_FAILURE',
                messageId: emailResult.messageId || '',
                recipientEmail,
                invoiceNumbers,
                error: 'The consolidated email was accepted by Brevo, but saving the email history log to the database failed.'
            });
        }
    } catch (error) {
        console.error('Error in sendConsolidatedInvoiceEmail:', error);
        return res.status(500).json({
            success: false,
            error: 'Server error while processing consolidated invoice email.'
        });
    } finally {
        inFlightConsolidatedEmailLocks.delete(sortedKey);
    }
};

// @desc    Get email sending history for a single invoice
// @route   GET /api/invoices/:id/email-history
// @access  Private (Admin/SuperAdmin with invoices.view permission)
export const getInvoiceEmailHistory = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid invoice ID' });
        }

        const invoice = await Invoice.findById(req.params.id)
            .populate('customerId', 'name email phone customerType')
            .populate('emailHistory.sentBy', 'name email role')
            .populate('lastEmailStatus.sentBy', 'name email role');

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        const batchLogs = await InvoiceEmailLog.find({ invoiceIds: invoice._id })
            .populate('sentBy', 'name email role')
            .sort({ sentAt: -1 })
            .lean();

        const sortedHistory = [...(invoice.emailHistory || [])].sort(
            (a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0)
        );

        return res.status(200).json({
            success: true,
            data: {
                invoiceId: invoice._id,
                invoiceNo: invoice.invoiceNo,
                customer: invoice.customerId,
                invoiceEmailSent: Boolean(invoice.invoiceEmailSent),
                invoiceEmailSentAt: invoice.invoiceEmailSentAt || null,
                lastEmailStatus: invoice.lastEmailStatus || { status: 'not_sent' },
                emailHistory: sortedHistory,
                batchLogs
            }
        });
    } catch (error) {
        console.error('Error fetching invoice email history:', error);
        return res.status(500).json({ success: false, error: 'Server error fetching invoice email history' });
    }
};

// @desc    Get consolidated/single invoice email logs (optionally filtered by customerId)
// @route   GET /api/invoices/email-logs
// @access  Private (Admin/SuperAdmin with invoices.view permission)
export const getInvoiceEmailLogs = async (req, res) => {
    try {
        const { customerId, invoiceId, limit = 50 } = req.query;
        const filter = {};
        if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
            filter.customerId = customerId;
        }
        if (invoiceId && mongoose.Types.ObjectId.isValid(invoiceId)) {
            filter.invoiceIds = invoiceId;
        }

        const logs = await InvoiceEmailLog.find(filter)
            .populate('customerId', 'name email phone customerType')
            .populate('sentBy', 'name email role')
            .sort({ sentAt: -1 })
            .limit(Math.min(Number(limit) || 50, 200))
            .lean();

        return res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Error fetching invoice email logs:', error);
        return res.status(500).json({ success: false, error: 'Server error fetching invoice email logs' });
    }
};

// @desc    Download invoice PDF
// @route   GET /api/invoices/:id/pdf
// @access  Private (Admin/SuperAdmin)
export const downloadInvoicePDF = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('customerId', 'name phone email address customerType')
            .populate('vehicleId', 'brand model year registrationNumber mileage vin')
            .populate('trackerCarId', 'make model year registrationNumber vin finalOdometer');

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        const Setting = mongoose.model('Setting');
        const settings = await Setting.findOne() || {};

        const pdfBuffer = await generateInvoicePDF(invoice, settings);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=GSK-Automotive-Invoice-${invoice.invoiceNo || 'Draft'}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Error generating invoice PDF:", error);
        res.status(500).json({ success: false, error: "Server Error generating invoice PDF" });
    }
};

// ============================================================================
// DATA RETENTION, ARCHIVAL & BACKUP MANAGEMENT CONTROLLERS
// ============================================================================

// @desc    Cancel or Void an issued invoice while preserving 5-year audit trail
// @route   POST /api/invoices/:id/cancel
// @access  Private (Admin/SuperAdmin)
export const cancelOrVoidInvoice = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({
                success: false,
                error: 'Mechanics are not authorized to cancel or void invoices.'
            });
        }

        const actionType = req.body.actionType === 'Voided' ? 'Voided' : 'Cancelled';
        const reason = String(req.body.reason || '').trim();

        if (!reason) {
            return res.status(400).json({
                success: false,
                error: `A cancellation/void reason is required when marking an invoice as ${actionType}.`
            });
        }

        req.body.status = actionType;
        req.body.cancellationReason = reason;
        return updateInvoice(req, res);
    } catch (error) {
        console.error('Error cancelling/voiding invoice:', error);
        return res.status(500).json({ success: false, error: 'Server error cancelling/voiding invoice' });
    }
};

// @desc    Get comprehensive Data Retention, Archival & Backup overview
// @route   GET /api/invoices/retention/overview
// @access  Private (Admin/SuperAdmin)
export const getRetentionOverview = async (req, res) => {
    try {
        const now = req.query.simulatedNow ? new Date(req.query.simulatedNow) : new Date();
        const nowSydney = DateTime.fromJSDate(now, { zone: SYDNEY_ZONE });

        const twoYearCutoff = nowSydney.minus({ years: RETENTION_POLICY.INVOICE_ARCHIVE_AFTER_YEARS }).toJSDate();
        const fiveYearCutoff = nowSydney.minus({ years: RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS }).toJSDate();
        const draftCutoff = nowSydney.minus({ days: RETENTION_POLICY.DRAFT_REVIEW_INACTIVITY_DAYS }).toJSDate();
        const quoteCutoff = nowSydney.minus({ months: RETENTION_POLICY.QUOTE_REVIEW_AFTER_MONTHS }).toJSDate();

        const [
            activeInvoices,
            archivedInvoices,
            archiveEligibleNow,
            cancelledOrVoidedInvoices,
            draftsTotal,
            draftCandidates,
            fiveYearEligibleInvoices,
            legalHoldInvoices,
            oldQuoteCandidates
        ] = await Promise.all([
            Invoice.countDocuments({
                isActive: true,
                isArchived: { $ne: true },
                status: { $in: ['Unpaid', 'Partially Paid', 'Paid'] }
            }),
            Invoice.countDocuments({
                isActive: true,
                isArchived: true
            }),
            Invoice.countDocuments({
                isActive: true,
                isArchived: { $ne: true },
                status: { $in: ['Unpaid', 'Partially Paid', 'Paid'] },
                $or: [
                    { invoiceDate: { $lte: twoYearCutoff } },
                    { invoiceDate: { $exists: false }, createdAt: { $lte: twoYearCutoff } }
                ]
            }),
            Invoice.countDocuments({
                isActive: true,
                status: { $in: ['Cancelled', 'Voided'] }
            }),
            Invoice.countDocuments({
                isActive: true,
                status: 'Draft'
            }),
            Invoice.find({
                isActive: true,
                status: 'Draft',
                $or: [
                    { lastMeaningfulActivityAt: { $lte: draftCutoff } },
                    { lastMeaningfulActivityAt: { $exists: false }, updatedAt: { $lte: draftCutoff } }
                ]
            }).populate('jobCardId', 'status').lean(),
            Invoice.countDocuments({
                isActive: true,
                status: { $in: ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled', 'Voided'] },
                $or: [
                    { invoiceDate: { $lte: fiveYearCutoff } },
                    { invoiceDate: { $exists: false }, createdAt: { $lte: fiveYearCutoff } }
                ]
            }),
            Invoice.countDocuments({
                isActive: true,
                'retentionMetadata.legalHold': true
            }),
            Quote.find({
                isActive: true,
                isArchived: { $ne: true },
                createdAt: { $lte: quoteCutoff }
            }).lean()
        ]);

        const draftsReviewEligible = draftCandidates.filter(d => {
            const info = computeInvoiceRetentionInfo(d, { now });
            return info.isDraftReviewEligible;
        }).length;

        const quotesReviewEligible = oldQuoteCandidates.filter(q => {
            const info = computeQuoteRetentionInfo(q, { now });
            return info.isReviewEligible;
        }).length;

        const backups = listDatabaseBackups({ now });
        const latestBackup = backups[0] || null;

        return res.status(200).json({
            success: true,
            data: {
                policy: RETENTION_POLICY,
                evaluatedAt: now.toISOString(),
                counts: {
                    activeInvoices,
                    archivedInvoices,
                    archiveEligibleNow,
                    cancelledOrVoidedInvoices,
                    draftsTotal,
                    draftsReviewEligible,
                    quotesReviewEligible,
                    fiveYearReviewEligible: fiveYearEligibleInvoices,
                    legalHoldInvoices
                },
                backupStatus: {
                    totalSnapshots: backups.length,
                    latestBackup,
                    retentionWindowDays: `${RETENTION_POLICY.BACKUP_MIN_RETENTION_DAYS}–${RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS} days`,
                    recoveryStrategy: {
                        database: 'Daily logical JSON snapshots with SHA-256 checksum verification and 30–90 day automated retention pruning.',
                        atlasFreeTierNote: 'MongoDB Atlas Free (M0) / Flex native snapshots retain 4–8 days; application-level daily logical backups provide the full 30–90 day recovery history without requiring paid M10+ clusters.',
                        vercelFreeTierNote: 'Executed within Vercel Hobby daily cron (0 8 * * *) and on-demand Admin triggers using bounded batch operations.',
                        documentsAndPDFs: 'Invoice & Purchase Order PDFs are deterministically regenerated from preserved database records & customer snapshots; Cloudinary document URLs/publicIds are indexed in each backup manifest.'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error fetching retention overview:', error);
        return res.status(500).json({ success: false, error: 'Server error fetching retention overview' });
    }
};

// @desc    Trigger bounded batch archival of invoices older than 2 years
// @route   POST /api/invoices/retention/run-archival
// @access  Private (Admin/SuperAdmin)
export const triggerBatchArchival = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({ success: false, error: 'Not authorized to run invoice archival.' });
        }

        const now = req.body?.simulatedNow ? new Date(req.body.simulatedNow) : new Date();
        const batchSize = req.body?.batchSize || 100;
        const archiveReason = req.body?.reason || '2-year retention policy transition to read-only archive';

        const result = await runBatchInvoiceArchival({
            now,
            batchSize,
            actorId: req.user._id,
            archiveReason
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error running batch invoice archival:', error);
        return res.status(500).json({ success: false, error: 'Server error running batch invoice archival' });
    }
};

// @desc    Archive a single eligible invoice into the read-only archive
// @route   POST /api/invoices/:id/archive
// @access  Private (Admin/SuperAdmin)
export const archiveSingleInvoice = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({ success: false, error: 'Not authorized to archive invoices.' });
        }

        const invoice = await Invoice.findById(req.params.id);
        if (!invoice || !invoice.isActive) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        if (invoice.status === 'Draft') {
            return res.status(400).json({
                success: false,
                error: 'Draft invoices cannot be moved to the financial read-only archive.'
            });
        }

        if (invoice.isArchived) {
            return res.status(200).json({
                success: true,
                message: 'Invoice is already archived.',
                data: invoice
            });
        }

        const now = req.body?.simulatedNow ? new Date(req.body.simulatedNow) : new Date();
        const retentionInfo = computeInvoiceRetentionInfo(invoice, { now });

        if (!retentionInfo.isArchiveEligible && !req.body?.force) {
            return res.status(400).json({
                success: false,
                error: `Invoice ${invoice.invoiceNo} is not yet 2 years old (eligible on ${new Date(retentionInfo.archiveEligibleAt).toLocaleDateString('en-AU')}).`
            });
        }

        invoice.isArchived = true;
        invoice.archiveStatus = 'archived';
        invoice.archivedAt = new Date();
        invoice.archivedBy = req.user._id;
        invoice.archiveReason = req.body?.reason || 'Archived to read-only historical storage';
        await invoice.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'ARCHIVE_INVOICE',
            target: invoice._id.toString(),
            metadata: {
                invoiceNo: invoice.invoiceNo,
                archiveReason: invoice.archiveReason
            },
            ipAddress: req.ip
        });

        const obj = invoice.toObject();
        obj.retentionInfo = computeInvoiceRetentionInfo(obj, { now });

        return res.status(200).json({
            success: true,
            data: obj
        });
    } catch (error) {
        console.error('Error archiving invoice:', error);
        return res.status(500).json({ success: false, error: 'Server error archiving invoice' });
    }
};

// @desc    Perform retention review on an invoice (90-day Draft review OR 5-year financial review / legal hold / disposal)
// @route   POST /api/invoices/:id/retention-review
// @access  Private (Admin/SuperAdmin)
export const reviewInvoiceRetention = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({ success: false, error: 'Not authorized to perform retention reviews.' });
        }

        const { decision, notes = '', extendYears = 0, simulatedNow } = req.body;
        const now = simulatedNow ? new Date(simulatedNow) : new Date();

        const invoice = await Invoice.findById(req.params.id).populate('jobCardId', 'status');
        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        const retentionInfo = computeInvoiceRetentionInfo(invoice, { now });
        const actorName = req.user?.name || req.user?.email || 'Administrator';
        const isSuperAdmin = req.user?.role === 'super_admin' || req.user?.role === 'superadmin';

        // Initialize retentionMetadata if absent on legacy record
        if (!invoice.retentionMetadata) {
            invoice.retentionMetadata = {
                retentionPeriodYears: RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS,
                retainUntil: retentionInfo.retainUntil,
                legalHold: false,
                legalHoldReason: '',
                reviewStatus: 'not_due',
                draftReviewStatus: 'active'
            };
        }

        // Case A: 90-Day Draft Invoice Review
        if (invoice.status === 'Draft') {
            if (decision === 'retain' || decision === 'continue_editing') {
                invoice.retentionMetadata.draftReviewStatus = 'retained';
                invoice.retentionMetadata.lastReviewedAt = new Date();
                invoice.retentionMetadata.lastReviewedBy = req.user._id;
                invoice.retentionMetadata.lastReviewedByName = actorName;
                invoice.retentionMetadata.reviewNotes = notes || 'Retained after 90-day draft inactivity review';
                invoice.lastMeaningfulActivityAt = new Date();
                await invoice.save();

                await AuditLog.create({
                    actor: req.user._id,
                    action: 'DRAFT_INVOICE_REVIEW_RETAIN',
                    target: invoice._id.toString(),
                    metadata: { invoiceNo: invoice.invoiceNo, decision, notes },
                    ipAddress: req.ip
                });

                const obj = invoice.toObject();
                obj.retentionInfo = computeInvoiceRetentionInfo(obj, { now });
                return res.status(200).json({ success: true, data: obj });
            }

            if (decision === 'approve_deletion') {
                if (retentionInfo.hasActiveJobCard) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot delete a draft invoice linked to an active Job Card.'
                    });
                }

                invoice.isActive = false;
                invoice.retentionMetadata.draftReviewStatus = 'approved_for_deletion';
                invoice.retentionMetadata.lastReviewedAt = new Date();
                invoice.retentionMetadata.lastReviewedBy = req.user._id;
                invoice.retentionMetadata.lastReviewedByName = actorName;
                invoice.retentionMetadata.reviewNotes = notes || 'Approved for deletion after 90-day inactivity review';
                await invoice.save();

                await AuditLog.create({
                    actor: req.user._id,
                    action: 'DRAFT_INVOICE_REVIEW_DELETE',
                    target: invoice._id.toString(),
                    metadata: {
                        invoiceNo: invoice.invoiceNo,
                        draftInactiveDays: retentionInfo.draftInactiveDays,
                        notes
                    },
                    ipAddress: req.ip
                });

                return res.status(200).json({
                    success: true,
                    message: `Inactive draft invoice ${invoice.invoiceNo} approved for deletion.`,
                    data: invoice.toObject()
                });
            }

            return res.status(400).json({
                success: false,
                error: 'Invalid draft review decision. Use retain, continue_editing, or approve_deletion.'
            });
        }

        // Case B: Legal Hold Management on Financial Records
        if (decision === 'set_legal_hold') {
            invoice.retentionMetadata.legalHold = true;
            invoice.retentionMetadata.legalHoldReason = notes || 'Legal/accounting audit hold';
            invoice.retentionMetadata.lastReviewedAt = new Date();
            invoice.retentionMetadata.lastReviewedBy = req.user._id;
            invoice.retentionMetadata.lastReviewedByName = actorName;
            await invoice.save();

            await AuditLog.create({
                actor: req.user._id,
                action: 'INVOICE_SET_LEGAL_HOLD',
                target: invoice._id.toString(),
                metadata: { invoiceNo: invoice.invoiceNo, reason: invoice.retentionMetadata.legalHoldReason },
                ipAddress: req.ip
            });

            const obj = invoice.toObject();
            obj.retentionInfo = computeInvoiceRetentionInfo(obj, { now });
            return res.status(200).json({ success: true, data: obj });
        }

        if (decision === 'clear_legal_hold') {
            invoice.retentionMetadata.legalHold = false;
            invoice.retentionMetadata.legalHoldReason = '';
            invoice.retentionMetadata.lastReviewedAt = new Date();
            invoice.retentionMetadata.lastReviewedBy = req.user._id;
            invoice.retentionMetadata.lastReviewedByName = actorName;
            await invoice.save();

            await AuditLog.create({
                actor: req.user._id,
                action: 'INVOICE_CLEAR_LEGAL_HOLD',
                target: invoice._id.toString(),
                metadata: { invoiceNo: invoice.invoiceNo, notes },
                ipAddress: req.ip
            });

            const obj = invoice.toObject();
            obj.retentionInfo = computeInvoiceRetentionInfo(obj, { now });
            return res.status(200).json({ success: true, data: obj });
        }

        // Case C: 5-Year Financial Record Retention Review
        if (decision === 'retain') {
            invoice.retentionMetadata.reviewStatus = 'retained';
            invoice.retentionMetadata.lastReviewedAt = new Date();
            invoice.retentionMetadata.lastReviewedBy = req.user._id;
            invoice.retentionMetadata.lastReviewedByName = actorName;
            invoice.retentionMetadata.reviewNotes = notes || 'Retained beyond 5-year minimum retention period';

            if (Number(extendYears) > 0) {
                const baseDate = invoice.retentionMetadata.retainUntil ? new Date(invoice.retentionMetadata.retainUntil) : now;
                invoice.retentionMetadata.retainUntil = DateTime.fromJSDate(baseDate, { zone: SYDNEY_ZONE })
                    .plus({ years: Number(extendYears) })
                    .toJSDate();
            }
            await invoice.save();

            await AuditLog.create({
                actor: req.user._id,
                action: 'INVOICE_RETENTION_RETAIN',
                target: invoice._id.toString(),
                metadata: {
                    invoiceNo: invoice.invoiceNo,
                    retainUntil: invoice.retentionMetadata.retainUntil,
                    notes
                },
                ipAddress: req.ip
            });

            const obj = invoice.toObject();
            obj.retentionInfo = computeInvoiceRetentionInfo(obj, { now });
            return res.status(200).json({ success: true, data: obj });
        }

        if (decision === 'approve_disposal' || decision === 'execute_disposal') {
            if (!isSuperAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Only a Super Admin can authorize or execute post-5-year financial record disposal.'
                });
            }

            if (!retentionInfo.isPastFiveYears) {
                return res.status(403).json({
                    success: false,
                    error: `Invoice ${invoice.invoiceNo} has not completed the mandatory ${RETENTION_POLICY.INVOICE_MIN_RETENTION_YEARS}-year minimum retention period.`
                });
            }

            if (retentionInfo.hasBlockingObligations) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot authorize disposal for ${invoice.invoiceNo}: ${retentionInfo.blockingReasons.join(' ')}`
                });
            }

            invoice.retentionMetadata.reviewStatus = 'approved_for_disposal';
            invoice.retentionMetadata.lastReviewedAt = new Date();
            invoice.retentionMetadata.lastReviewedBy = req.user._id;
            invoice.retentionMetadata.lastReviewedByName = actorName;
            invoice.retentionMetadata.reviewNotes = notes || 'Explicitly authorized for post-5-year disposal';

            if (decision === 'execute_disposal') {
                await Invoice.findByIdAndDelete(invoice._id);
                await AuditLog.create({
                    actor: req.user._id,
                    action: 'EXECUTE_POST_5Y_INVOICE_DISPOSAL',
                    target: invoice._id.toString(),
                    metadata: {
                        invoiceNo: invoice.invoiceNo,
                        invoiceDate: retentionInfo.invoiceDate,
                        ageYears: retentionInfo.ageYears,
                        notes
                    },
                    ipAddress: req.ip
                });
                return res.status(200).json({
                    success: true,
                    disposed: true,
                    message: `Invoice ${invoice.invoiceNo} disposed after completing 5-year retention review.`
                });
            }

            await invoice.save();
            await AuditLog.create({
                actor: req.user._id,
                action: 'APPROVE_POST_5Y_INVOICE_DISPOSAL',
                target: invoice._id.toString(),
                metadata: {
                    invoiceNo: invoice.invoiceNo,
                    ageYears: retentionInfo.ageYears,
                    notes
                },
                ipAddress: req.ip
            });

            const obj = invoice.toObject();
            obj.retentionInfo = computeInvoiceRetentionInfo(obj, { now });
            return res.status(200).json({ success: true, data: obj });
        }

        return res.status(400).json({
            success: false,
            error: 'Invalid retention review decision.'
        });
    } catch (error) {
        console.error('Error reviewing invoice retention:', error);
        return res.status(500).json({ success: false, error: 'Server error reviewing invoice retention' });
    }
};

// @desc    Get Quotes & Estimates older than 12 months for retention review
// @route   GET /api/invoices/retention/quotes
// @access  Private (Admin/SuperAdmin)
export const getQuotesForRetentionReview = async (req, res) => {
    try {
        const { includeAll = 'false', search = '', page = 1, limit = 15, simulatedNow } = req.query;
        const now = simulatedNow ? new Date(simulatedNow) : new Date();
        const nowSydney = DateTime.fromJSDate(now, { zone: SYDNEY_ZONE });
        const quoteCutoff = nowSydney.minus({ months: RETENTION_POLICY.QUOTE_REVIEW_AFTER_MONTHS }).toJSDate();

        const filter = { isActive: true };
        if (includeAll !== 'true') {
            filter.createdAt = { $lte: quoteCutoff };
        }
        if (search && search.trim()) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { 'customerInfo.fullName': { $regex: escaped, $options: 'i' } },
                { 'customerInfo.email': { $regex: escaped, $options: 'i' } },
                { 'vehicleInfo.regNo': { $regex: escaped, $options: 'i' } },
                { 'vehicleInfo.make': { $regex: escaped, $options: 'i' } },
                { 'vehicleInfo.model': { $regex: escaped, $options: 'i' } }
            ];
        }

        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 100);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const skip = (parsedPage - 1) * parsedLimit;

        const [quotes, total] = await Promise.all([
            Quote.find(filter)
                .populate('customerId', 'name email phone')
                .populate('convertedToInvoiceId', 'invoiceNo status totalAmount')
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean(),
            Quote.countDocuments(filter)
        ]);

        const enriched = quotes.map(q => ({
            ...q,
            retentionInfo: computeQuoteRetentionInfo(q, { now })
        }));

        return res.status(200).json({
            success: true,
            data: enriched,
            pagination: {
                total,
                page: parsedPage,
                limit: parsedLimit,
                pages: Math.ceil(total / parsedLimit)
            }
        });
    } catch (error) {
        console.error('Error fetching quotes for retention review:', error);
        return res.status(500).json({ success: false, error: 'Server error fetching quotes for retention review' });
    }
};

// @desc    Review a 12-month-old Quote/Estimate (retain or archive)
// @route   POST /api/invoices/retention/quotes/:id/review
// @access  Private (Admin/SuperAdmin)
export const reviewQuoteRetention = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({ success: false, error: 'Not authorized to review quotes.' });
        }

        const { decision, notes = '', convertedToInvoiceId = null, simulatedNow } = req.body;
        const now = simulatedNow ? new Date(simulatedNow) : new Date();

        const quote = await Quote.findById(req.params.id);
        if (!quote) {
            return res.status(404).json({ success: false, error: 'Quote not found' });
        }

        const retentionInfo = computeQuoteRetentionInfo(quote, { now });
        const actorName = req.user?.name || req.user?.email || 'Administrator';

        if (convertedToInvoiceId && mongoose.Types.ObjectId.isValid(convertedToInvoiceId)) {
            quote.convertedToInvoiceId = convertedToInvoiceId;
        }

        if (decision === 'retain') {
            quote.isArchived = false;
            quote.retentionReview = {
                reviewStatus: 'retained',
                lastReviewedAt: new Date(),
                lastReviewedBy: req.user._id,
                lastReviewedByName: actorName,
                reviewNotes: notes || 'Retained after 12-month quote review'
            };
        } else if (decision === 'archive') {
            if (quote.convertedToInvoiceId) {
                return res.status(400).json({
                    success: false,
                    error: 'Quotes converted into an Invoice must remain linked and preserved with the invoice record.'
                });
            }
            if (quote.status === 'In Review' && !req.body.force) {
                return res.status(400).json({
                    success: false,
                    error: 'Quote has ongoing customer discussion (status: In Review). Close or resolve the discussion before archiving.'
                });
            }
            quote.isArchived = true;
            quote.archivedAt = new Date();
            quote.archivedBy = req.user._id;
            quote.retentionReview = {
                reviewStatus: 'archived',
                lastReviewedAt: new Date(),
                lastReviewedBy: req.user._id,
                lastReviewedByName: actorName,
                reviewNotes: notes || 'Archived after 12-month quote review'
            };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid quote review decision. Use retain or archive.'
            });
        }

        await quote.save();

        await AuditLog.create({
            actor: req.user._id,
            action: `QUOTE_RETENTION_${decision.toUpperCase()}`,
            target: quote._id.toString(),
            metadata: {
                customerName: quote.customerInfo?.fullName,
                regNo: quote.vehicleInfo?.regNo,
                ageMonths: retentionInfo.ageMonths,
                decision,
                notes
            },
            ipAddress: req.ip
        });

        const obj = quote.toObject();
        obj.retentionInfo = computeQuoteRetentionInfo(obj, { now });

        return res.status(200).json({
            success: true,
            data: obj
        });
    } catch (error) {
        console.error('Error reviewing quote retention:', error);
        return res.status(500).json({ success: false, error: 'Server error reviewing quote retention' });
    }
};

// @desc    List available database backups and 30–90 day recovery history
// @route   GET /api/invoices/retention/backups
// @access  Private (Admin/SuperAdmin)
export const getDatabaseBackups = async (req, res) => {
    try {
        const backups = listDatabaseBackups();
        return res.status(200).json({
            success: true,
            data: {
                retentionWindow: {
                    minDays: RETENTION_POLICY.BACKUP_MIN_RETENTION_DAYS,
                    maxDays: RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS
                },
                totalBackups: backups.length,
                backups
            }
        });
    } catch (error) {
        console.error('Error listing database backups:', error);
        return res.status(500).json({ success: false, error: 'Server error listing database backups' });
    }
};

// @desc    Trigger a new logical database backup snapshot & prune snapshots > 90 days
// @route   POST /api/invoices/retention/backups/create
// @access  Private (Admin/SuperAdmin)
export const triggerDatabaseBackup = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({ success: false, error: 'Not authorized to create database backups.' });
        }

        const backup = await createDatabaseBackup({
            retentionDays: req.body?.retentionDays || RETENTION_POLICY.BACKUP_MAX_RETENTION_DAYS,
            triggeredBy: req.user?.email || req.user?.name || 'admin',
            note: req.body?.note || 'Manual administrative backup snapshot'
        });

        await AuditLog.create({
            actor: req.user._id,
            action: 'CREATE_DATABASE_BACKUP',
            target: backup.backupId,
            metadata: {
                totalCollections: backup.totalCollections,
                totalDocuments: backup.totalDocuments,
                totalBytes: backup.totalBytes,
                prunedBackups: backup.prunedBackups
            },
            ipAddress: req.ip
        });

        return res.status(201).json({
            success: true,
            data: backup
        });
    } catch (error) {
        console.error('Error creating database backup:', error);
        return res.status(500).json({ success: false, error: 'Server error creating database backup' });
    }
};

// @desc    Verify a database backup snapshot's SHA-256 checksums and restoration readiness
// @route   POST /api/invoices/retention/backups/verify
// @access  Private (Admin/SuperAdmin)
export const verifyDatabaseBackup = async (req, res) => {
    try {
        if (req.user?.role === 'mechanic' || req.user?.role === 'user') {
            return res.status(403).json({ success: false, error: 'Not authorized to verify database backups.' });
        }

        const verification = await verifyBackupRestoration({
            backupId: req.body?.backupId || null
        });

        await AuditLog.create({
            actor: req.user._id,
            action: 'VERIFY_DATABASE_BACKUP',
            target: verification.backupId,
            metadata: {
                verified: verification.verified,
                collectionsVerified: verification.collectionsVerified,
                invoiceVerification: verification.invoiceVerification
            },
            ipAddress: req.ip
        });

        return res.status(200).json({
            success: true,
            data: verification
        });
    } catch (error) {
        console.error('Error verifying database backup:', error);
        return res.status(400).json({ success: false, error: error.message || 'Server error verifying database backup' });
    }
};
