import JobCard from '../models/JobCard.js';
import Vehicle from '../models/Vehicle.js';
import VehicleBatch from '../models/VehicleBatch.js';
import VehicleBatchMembership from '../models/VehicleBatchMembership.js';
import Inventory from '../models/Inventory.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import AuditLog from '../models/AuditLog.js';
import Customer from '../models/Customer.js';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import EmailService from '../services/EmailService.js';
import Invoice from '../models/Invoice.js';
import { withTransaction } from '../utils/transaction.js';
import { calculateTaxAndTotals } from '../utils/taxCalculator.js';
import { recalculateBatchStatus } from './vehicleBatchController.js';
import { escapeRegex } from '../utils/sanitize.js';

/**
 * Redacts all pricing and financial fields from a JobCard object when the user is a Mechanic.
 */
export const sanitizeJobCardForRole = (jobCard, role) => {
    if (!jobCard) return jobCard;
    const obj = jobCard.toObject ? jobCard.toObject() : { ...jobCard };
    const isRestrictedRole = role === 'mechanic' || role === 'user';

    if (!isRestrictedRole) {
        return obj;
    }

    delete obj.subtotal;
    delete obj.gstRate;
    delete obj.gstAmount;
    delete obj.totalAmount;
    delete obj.finalAmount;
    delete obj.discountAmount;
    delete obj.hourlyRate;
    delete obj.charges;

    if (Array.isArray(obj.partsUsed)) {
        obj.partsUsed = obj.partsUsed.map(p => {
            const partObj = p?.toObject ? p.toObject() : { ...p };
            delete partObj.unitPrice;
            return partObj;
        });
    }

    if (Array.isArray(obj.servicesProvided)) {
        obj.servicesProvided = obj.servicesProvided.map(s => {
            const svcObj = s?.toObject ? s.toObject() : { ...s };
            delete svcObj.cost;
            delete svcObj.total;
            return svcObj;
        });
    }

    return obj;
};

/**
 * Normalizes partsUsed and resolves canonical unitPrice from Inventory when needed.
 * When isMechanic is true, any client-supplied unitPrice is ignored and existing or canonical
 * inventory prices are preserved server-side so Admin review has accurate baseline costs.
 */
const normalizePartsUsed = async (partsInput, existingParts = [], isMechanic = false, session = null) => {
    if (!Array.isArray(partsInput)) return [];

    const existingPriceMap = new Map();
    if (Array.isArray(existingParts)) {
        existingParts.forEach(ep => {
            const invId = (ep.inventoryId?._id || ep.inventoryId)?.toString();
            const varId = ep.variantId?.toString() || '';
            if (invId) {
                existingPriceMap.set(`${invId}:${varId}`, ep.unitPrice ?? 0);
            }
        });
    }

    const normalized = [];
    for (const p of partsInput) {
        const rawInvId = p.inventoryId?._id || p.inventoryId;
        if (!rawInvId) continue;
        const invIdStr = rawInvId.toString();
        const varIdStr = p.variantId ? p.variantId.toString() : '';
        const key = `${invIdStr}:${varIdStr}`;
        const quantity = Math.max(1, Number(p.quantity) || 1);

        let unitPrice = 0;
        if (isMechanic) {
            if (existingPriceMap.has(key)) {
                unitPrice = existingPriceMap.get(key);
            } else {
                const invQuery = Inventory.findById(invIdStr);
                if (session) invQuery.session(session);
                const invDoc = await invQuery;
                if (invDoc && varIdStr) {
                    const variant = invDoc.variants?.id(varIdStr);
                    if (variant && typeof variant.unitPrice === 'number') {
                        unitPrice = variant.unitPrice;
                    }
                }
            }
        } else {
            if (p.unitPrice !== undefined && p.unitPrice !== null && p.unitPrice !== '') {
                unitPrice = Math.max(0, Number(p.unitPrice) || 0);
            } else if (existingPriceMap.has(key)) {
                unitPrice = existingPriceMap.get(key);
            } else {
                const invQuery = Inventory.findById(invIdStr);
                if (session) invQuery.session(session);
                const invDoc = await invQuery;
                if (invDoc && varIdStr) {
                    const variant = invDoc.variants?.id(varIdStr);
                    if (variant && typeof variant.unitPrice === 'number') {
                        unitPrice = variant.unitPrice;
                    }
                }
            }
        }

        normalized.push({
            inventoryId: invIdStr,
            variantId: p.variantId || undefined,
            variantName: p.variantName || '',
            quantity,
            unitPrice
        });
    }

    return normalized;
};

/**
 * Normalizes servicesProvided. When isMechanic is true, ignores client-submitted cost/total
 * and preserves existing stored service costs (or defaults new services to 0 for Admin pricing).
 */
const normalizeServicesProvided = (servicesInput, existingServices = [], isMechanic = false) => {
    if (!Array.isArray(servicesInput)) return [];

    const existingById = new Map();
    const existingByName = new Map();
    if (Array.isArray(existingServices)) {
        existingServices.forEach(es => {
            if (es._id) existingById.set(es._id.toString(), es.cost ?? 0);
            if (es.name) existingByName.set(es.name.trim().toLowerCase(), es.cost ?? 0);
        });
    }

    return servicesInput
        .filter(s => s && s.name && String(s.name).trim())
        .map(s => {
            const name = String(s.name).trim();
            const quantity = Math.max(1, Number(s.quantity) || 1);
            let cost = 0;

            if (isMechanic) {
                if (s._id && existingById.has(s._id.toString())) {
                    cost = existingById.get(s._id.toString());
                } else if (existingByName.has(name.toLowerCase())) {
                    cost = existingByName.get(name.toLowerCase());
                } else {
                    cost = 0;
                }
            } else {
                cost = Math.max(0, Number(s.cost) || 0);
            }

            return {
                ...(s._id ? { _id: s._id } : {}),
                name,
                quantity,
                cost,
                total: Number((quantity * cost).toFixed(2))
            };
        });
};

// @desc    Get all job cards and metrics
// @route   GET /api/job-cards
// @access  Private (Admin/SuperAdmin)
export const getJobCards = async (req, res) => {
    try {
        const { search, status, jobCardType, customerId, vehicleId, customerType, page = 1, limit = 15 } = req.query;

        let query = { isActive: true };
        if (status && status !== 'All') {
            if (Array.isArray(status)) {
                query.status = { $in: status };
            } else {
                query.status = status;
            }
        }
        if (req.query.statusNot) {
            const notStatuses = Array.isArray(req.query.statusNot) ? req.query.statusNot : [req.query.statusNot];
            query.status = { ...(query.status || {}), $nin: notStatuses };
        }
        if (customerId) {
            query.customerId = customerId;
        }
        // Filter by customer type (e.g. rental_company) — fetch all customer IDs of that type
        if (customerType && !customerId) {
            const matchingCustomerIds = await Customer.find({ customerType, isActive: true }).distinct('_id');
            query.customerId = { $in: matchingCustomerIds };
        }
        if (vehicleId) {
            query.vehicleId = vehicleId;
        }

        if (jobCardType && jobCardType !== 'All') {
            const customerTypeMap = {
                'Regular': 'regular',
                'Rental': 'rental_company',
                'Import': 'import_company'
            };
            const mappedType = customerTypeMap[jobCardType];
            if (mappedType) {
                const matchingCustomerIds = await Customer.find({ customerType: mappedType }).distinct('_id');
                if (query.customerId) {
                    if (query.customerId.$in) {
                        const existingStrings = query.customerId.$in.map(id => id.toString());
                        const intersection = matchingCustomerIds.filter(id => existingStrings.includes(id.toString()));
                        query.customerId = { $in: intersection };
                    } else {
                        if (!matchingCustomerIds.some(id => id.toString() === query.customerId.toString())) {
                            query.customerId = { $in: [] };
                        }
                    }
                } else {
                    query.customerId = { $in: matchingCustomerIds };
                }
            }
        }

        if (search) {
            const safeSearch = escapeRegex(search);
            const customerIds = await Customer.find({
                $or: [
                    { name: { $regex: safeSearch, $options: 'i' } },
                    { email: { $regex: safeSearch, $options: 'i' } },
                    { phone: { $regex: safeSearch, $options: 'i' } }
                ]
            }).distinct('_id');

            const vehicleIds = await Vehicle.find({
                $or: [
                    { registrationNumber: { $regex: safeSearch, $options: 'i' } },
                    { brand: { $regex: safeSearch, $options: 'i' } },
                    { model: { $regex: safeSearch, $options: 'i' } }
                ]
            }).distinct('_id');

            // Support formal Job Card number (e.g. JC-1024, extracting 1024)
            let searchRegex = safeSearch;
            if (search.toUpperCase().startsWith('JC-')) {
                searchRegex = escapeRegex(search.substring(3));
            }

            query.$or = [
                { customerId: { $in: customerIds } },
                { vehicleId: { $in: vehicleIds } },
                { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: searchRegex, options: "i" } } },
                { $expr: { $regexMatch: { input: { $dateToString: { format: "%d %b %Y", date: "$createdAt" } }, regex: safeSearch, options: "i" } } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [rawJobCards, total, metricsAggregation] = await Promise.all([
            JobCard.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            JobCard.countDocuments(query),
            // Calculate metrics over all active job cards using MongoDB aggregation
            JobCard.aggregate([
                { $match: { isActive: true } },
                { 
                    $group: {
                        _id: null,
                        openCount: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } },
                        completedCount: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } },
                        totalRevenue: { $sum: { $ifNull: ["$totalAmount", 0] } }
                    }
                }
            ])
        ]);

        const jobCardIds = rawJobCards.map(jc => jc._id);
        const [jobCards, invoices] = await Promise.all([
            JobCard.populate(rawJobCards, [
                { path: 'vehicleId', select: 'brand model year registrationNumber status' },
                { path: 'trackerCarId', select: 'registrationNumber make model year vin status' },
                { path: 'customerId', select: 'name phone email customerType' }
            ]),
            jobCardIds.length > 0
                ? Invoice.find({ jobCardId: { $in: jobCardIds }, isActive: true }).select('jobCardId status invoiceNumber').lean()
                : Promise.resolve([])
        ]);

        const isRestrictedRole = req.user?.role === 'mechanic' || req.user?.role === 'user';

        const metrics = metricsAggregation.length > 0 ? {
            openCount: metricsAggregation[0].openCount,
            completedCount: metricsAggregation[0].completedCount,
            ...(isRestrictedRole ? {} : { totalRevenue: metricsAggregation[0].totalRevenue })
        } : {
            openCount: 0,
            completedCount: 0,
            ...(isRestrictedRole ? {} : { totalRevenue: 0 })
        };
        
        const invoicedMap = {};
        invoices.forEach(inv => {
            invoicedMap[inv.jobCardId.toString()] = { hasInvoice: true, invoiceStatus: inv.status, invoiceNumber: inv.invoiceNumber };
        });

        const jobCardsWithInvoice = jobCards.map(jc => {
            const jcObj = jc.toObject ? jc.toObject() : jc;
            const invoiceInfo = invoicedMap[jc._id.toString()];
            if (invoiceInfo) {
                jcObj.hasInvoice = true;
                jcObj.invoiceStatus = invoiceInfo.invoiceStatus;
                jcObj.invoiceNumber = invoiceInfo.invoiceNumber;
            } else {
                jcObj.hasInvoice = false;
            }
            return sanitizeJobCardForRole(jcObj, req.user?.role);
        });

        res.status(200).json({
            success: true,
            data: jobCardsWithInvoice,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            metrics
        });
    } catch (error) {
        console.error("Error fetching job cards:", error);
        res.status(500).json({ success: false, error: "Server Error fetching job cards" });
    }
};

// @desc    Get single job card by ID
// @route   GET /api/job-cards/:id
// @access  Private (Admin/SuperAdmin/Mechanic)
export const getJobCardById = async (req, res) => {
    try {
        const jobCard = await JobCard.findById(req.params.id)
            .populate('customerId', 'name phone email address postalCode mobile customerType')
            .populate('vehicleId', 'brand make model year registrationNumber vin engineNo speedo mileage mfgDate chassisNo status')
            .populate('trackerCarId', 'registrationNumber make model year vin finalOdometer status')
            .populate('technicianId', 'name email role')
            .populate('completedBy', 'name email role')
            .populate('finalizedBy', 'name email role')
            .populate('partsUsed.inventoryId', 'itemName partNumber');

        if (!jobCard || !jobCard.isActive) {
            return res.status(404).json({ success: false, error: 'Job card not found' });
        }

        const jcObj = jobCard.toObject ? jobCard.toObject() : jobCard;
        const activeInvoice = await Invoice.findOne({ jobCardId: jobCard._id, isActive: true }).select('status invoiceNumber _id');
        if (activeInvoice) {
            jcObj.hasInvoice = true;
            jcObj.invoiceStatus = activeInvoice.status;
            jcObj.invoiceNumber = activeInvoice.invoiceNumber;
            jcObj.invoiceId = activeInvoice._id;
        } else {
            jcObj.hasInvoice = false;
        }

        res.status(200).json({
            success: true,
            data: sanitizeJobCardForRole(jcObj, req.user?.role)
        });
    } catch (error) {
        console.error("Error fetching job card by ID:", error);
        res.status(500).json({ success: false, error: 'Server Error fetching job card' });
    }
};

// @desc    Create a new job card
// @route   POST /api/job-cards
// @access  Private (Admin/SuperAdmin/Mechanic)
export const createJobCard = async (req, res) => {
    try {
        const isMechanic = req.user?.role === 'mechanic' || req.user?.role === 'user';

        if (isMechanic) {
            const forbiddenFinancialKeys = [
                'finalAmount',
                'financialsFinalized',
                'finalizeFinancials',
                'discountAmount',
                'hourlyRate',
                'charges',
                'subtotal',
                'gstRate',
                'gstAmount',
                'totalAmount'
            ];
            const attemptedForbiddenKey = forbiddenFinancialKeys.find(
                key => req.body[key] !== undefined && req.body[key] !== null
            );
            if (attemptedForbiddenKey) {
                return res.status(403).json({
                    success: false,
                    error: 'Mechanics are not authorized to enter or modify pricing or financial information.'
                });
            }
        }

        let { customerId, vehicleId, bookingId, trackerId, trackerCarId, rentalEntryId, technicianId } = req.body;

        // Validation: Mechanic (technicianId)
        if (technicianId) {
            const User = (await import('../models/User.js')).default;
            const tech = await User.findById(technicianId);
            if (!tech || tech.role !== 'mechanic' || tech.status !== 'active') {
                return res.status(400).json({ success: false, error: 'Invalid Mechanic. Selected user is not an active mechanic.' });
            }
            req.body.mechanic = tech.name; // Preserve historical string
        } else if (req.user?.role === 'mechanic' && !req.body.mechanic) {
            technicianId = req.user._id;
            req.body.technicianId = req.user._id;
            req.body.mechanic = req.user.name;
        }

        // Validation 3: Check Booking (Service Request) and Authoritative Linking
        if (bookingId) {
            const booking = await Booking.findById(bookingId);
            if (!booking) {
                return res.status(400).json({ success: false, error: 'Invalid Booking ID. Service Request does not exist.' });
            }
            if (!booking.customerId) {
                return res.status(400).json({ success: false, error: 'Service Request has no linked customer. Please resolve it first.' });
            }

            // Force override frontend inputs with authoritative backend values
            customerId = booking.customerId.toString();
            
            if (booking.vehicleId) {
                vehicleId = booking.vehicleId.toString();
            }

            // Prevent duplicate Job Card conversion
            const existingJobCard = await JobCard.findOne({ bookingId, isActive: true });
            if (existingJobCard) {
                return res.status(400).json({ success: false, error: 'A Job Card has already been created for this Service Request.' });
            }
        }

        // Validation 1: Check Customer Exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(400).json({ success: false, error: 'Invalid Customer ID. Customer does not exist.' });
        }

        // Validation: Rental Service Entry Vehicle Authoritative Linking
        if (rentalEntryId) {
            const { default: RentalServiceEntryVehicle } = await import('../models/RentalServiceEntryVehicle.js');
            const { default: RentalServiceEntry } = await import('../models/RentalServiceEntry.js');
            
            const entryVehicle = await RentalServiceEntryVehicle.findById(rentalEntryId);
            if (!entryVehicle || !entryVehicle.isActive) {
                return res.status(400).json({ success: false, error: 'Invalid Rental Service Entry Vehicle ID.' });
            }
            
            // Validate customer via parent entry
            const parentEntry = await RentalServiceEntry.findById(entryVehicle.serviceEntryId);
            if (!parentEntry || !parentEntry.isActive) {
                return res.status(400).json({ success: false, error: 'Parent Rental Service Entry not found.' });
            }
            if (parentEntry.customerId.toString() !== customerId) {
                return res.status(400).json({ success: false, error: 'Rental Entry does not belong to the selected Customer.' });
            }
            
            // Validate vehicle match
            if (entryVehicle.vehicleId.toString() !== vehicleId) {
                return res.status(400).json({ success: false, error: 'Vehicle mismatch with Rental Entry.' });
            }
            
            // Prevent duplicate Job Card conversion
            const existingJobCard = await JobCard.findOne({ rentalEntryId, isActive: true });
            if (existingJobCard) {
                return res.status(400).json({ success: false, error: 'A Job Card has already been created for this Rental Entry Vehicle.' });
            }
        }

        // Validation 2: Check Vehicle or TrackerCar Exists & Ownership
        if (trackerCarId) {
            const trackerCar = await VehicleBatchMembership.findById(trackerCarId).populate('batchId');
            if (!trackerCar) {
                return res.status(400).json({ success: false, error: 'Invalid Tracker Car ID. Car does not exist.' });
            }
            if (trackerCar.batchId.customerId.toString() !== customerId) {
                return res.status(400).json({ success: false, error: 'Tracker Car does not belong to the selected Customer.' });
            }
        } else {
            if (!vehicleId) {
                return res.status(400).json({ success: false, error: 'Either Vehicle ID or Tracker Car ID is required.' });
            }
            const vehicle = await Vehicle.findById(vehicleId);
            if (!vehicle) {
                return res.status(400).json({ success: false, error: 'Invalid Vehicle ID. Vehicle does not exist.' });
            }
            if (vehicle.customerId.toString() !== customerId) {
                return res.status(400).json({ success: false, error: 'Vehicle does not belong to the selected Customer.' });
            }
        }

        const newJobCard = await withTransaction(async (session) => {
            const normalizedParts = await normalizePartsUsed(req.body.partsUsed || [], [], isMechanic, session);
            const normalizedServices = normalizeServicesProvided(req.body.servicesProvided || [], [], isMechanic);

            const labourHours = Math.max(0, Number(req.body.labourHours) || 0);
            const hourlyRate = isMechanic ? 0 : Math.max(0, Number(req.body.hourlyRate) || 0);
            const charges = isMechanic
                ? { lubricantsOil: 0, differentialOil: 0, miscellaneous: 0, transmission: 0, brakeFluid: 0 }
                : (req.body.charges || { lubricantsOil: 0, differentialOil: 0, miscellaneous: 0, transmission: 0, brakeFluid: 0 });
            const discountAmount = isMechanic ? 0 : Math.max(0, Number(req.body.discountAmount) || 0);
            const finalAmountInput = isMechanic ? null : (req.body.finalAmount !== undefined && req.body.finalAmount !== null && req.body.finalAmount !== '' ? Number(req.body.finalAmount) : null);

            const partsAndLabour = [];
            normalizedParts.forEach(p => {
                partsAndLabour.push({ qty: p.quantity || 1, price: p.unitPrice || 0 });
            });
            normalizedServices.forEach(s => {
                partsAndLabour.push({ qty: s.quantity || 1, price: s.cost || 0 });
            });

            const financialTotals = await calculateTaxAndTotals({
                partsAndLabour,
                labourHours,
                hourlyRate,
                charges,
                discountAmount,
                finalAmountOverride: finalAmountInput
            });

            const shouldFinalize = !isMechanic && (req.body.finalizeFinancials === true || req.body.financialsFinalized === true);

            const createDoc = {
                customerId,
                vehicleId: vehicleId || null,
                bookingId: bookingId || undefined,
                trackerId: trackerId || null,
                trackerCarId: trackerCarId || null,
                rentalEntryId: rentalEntryId || null,
                technicianId: technicianId || undefined,
                mechanic: req.body.mechanic || undefined,
                servicesOrdered: Array.isArray(req.body.servicesOrdered) ? req.body.servicesOrdered : [],
                servicesProvided: normalizedServices,
                partsUsed: normalizedParts,
                needsAttention: Array.isArray(req.body.needsAttention) ? req.body.needsAttention : [],
                repairsOrdered: req.body.repairsOrdered || '',
                labourHours,
                hourlyRate,
                charges,
                discountAmount,
                notes: req.body.notes || '',
                status: 'Open',
                subtotal: financialTotals.subtotal,
                gstRate: financialTotals.gstRate,
                gstAmount: financialTotals.gstAmount,
                totalAmount: financialTotals.totalAmount,
                finalAmount: shouldFinalize ? financialTotals.totalAmount : finalAmountInput,
                financialsFinalized: shouldFinalize,
                finalizedBy: shouldFinalize ? req.user._id : null,
                finalizedAt: shouldFinalize ? new Date() : null
            };

            const created = await JobCard.create([createDoc], { session });

            const jobCard = created[0];

            // If it originated from a Booking, update its status
            if (bookingId) {
                await Booking.findByIdAndUpdate(bookingId, {
                    status: 'Confirmed'
                }, { session });
            }

            // If it originated from a RentalServiceEntryVehicle, link the jobCardId back
            if (rentalEntryId) {
                const { default: RentalServiceEntryVehicle } = await import('../models/RentalServiceEntryVehicle.js');
                await RentalServiceEntryVehicle.findByIdAndUpdate(
                    rentalEntryId,
                    { jobCardId: jobCard._id },
                    { session }
                );
            }

            // Log action
            await AuditLog.create([{
                actor: req.user._id,
                action: 'CREATE_JOB_CARD',
                target: jobCard._id.toString(),
                metadata: { vehicleId: req.body.vehicleId, customerId: req.body.customerId, bookingId },
                ipAddress: req.ip
            }], { session });

            return jobCard;
        });

        res.status(201).json({
            success: true,
            data: sanitizeJobCardForRole(newJobCard, req.user?.role)
        });
    } catch (error) {
        console.error("Error creating job card:", error);
        res.status(500).json({ success: false, error: "Server Error creating job card" });
    }
};

// @desc    Update a job card (e.g., mark as completed, or Admin finalizes pricing)
// @route   PUT /api/job-cards/:id
// @access  Private (Admin/SuperAdmin/Mechanic)
export const updateJobCard = async (req, res) => {
    try {
        const updatedData = await withTransaction(async (session) => {
            const jobCard = await JobCard.findById(req.params.id).session(session);

            if (!jobCard) {
                throw new Error('Job card not found');
            }

            // Validation: Mechanic (technicianId)
            const technicianId = req.body.technicianId;
            if (technicianId && technicianId !== jobCard.technicianId?.toString()) {
                const User = (await import('../models/User.js')).default;
                const tech = await User.findById(technicianId).session(session);
                if (!tech || tech.role !== 'mechanic' || tech.status !== 'active') {
                    throw { status: 400, message: 'Invalid Mechanic. Selected user is not an active mechanic.' };
                }
                req.body.mechanic = tech.name; // Preserve historical string
            }

            // Validation: Check Vehicle Ownership if customer or vehicle is being changed
            const updatedCustomerId = (req.body.customerId?._id || req.body.customerId || jobCard.customerId).toString();
            const updatedVehicleId = (req.body.vehicleId?._id || req.body.vehicleId || (jobCard.vehicleId ? jobCard.vehicleId : null))?.toString() || null;
            const updatedTrackerCarId = (req.body.trackerCarId?._id || req.body.trackerCarId || (jobCard.trackerCarId ? jobCard.trackerCarId : null))?.toString() || null;

            if (updatedTrackerCarId) {
                const trackerCar = await VehicleBatchMembership.findById(updatedTrackerCarId).populate('batchId').session(session);
                if (!trackerCar) {
                    throw { status: 400, message: 'Invalid Tracker Car ID. Car does not exist.' };
                }
                if (trackerCar.batchId.customerId.toString() !== updatedCustomerId) {
                    throw { status: 400, message: 'Tracker Car does not belong to the selected Customer.' };
                }
            } else if (updatedVehicleId) {
                if (updatedCustomerId !== jobCard.customerId.toString() || updatedVehicleId !== (jobCard.vehicleId ? jobCard.vehicleId.toString() : null)) {
                    const vehicle = await Vehicle.findById(updatedVehicleId).session(session);
                    if (!vehicle) {
                        throw { status: 400, message: 'Invalid Vehicle ID. Vehicle does not exist.' };
                    }
                    if (!vehicle.customerId || vehicle.customerId.toString() !== updatedCustomerId) {
                        throw { status: 400, message: 'Vehicle does not belong to the selected Customer.' };
                    }
                }
            }

            // Enforce Super Admin / Admin financial and completion rules
            const isMechanic = req.user.role === 'mechanic' || req.user.role === 'user';
            
            if (isMechanic) {
                if (
                    req.body.finalAmount !== undefined ||
                    req.body.financialsFinalized !== undefined ||
                    req.body.finalizeFinancials !== undefined ||
                    req.body.discountAmount !== undefined ||
                    req.body.subtotal !== undefined ||
                    req.body.gstAmount !== undefined ||
                    req.body.totalAmount !== undefined
                ) {
                    throw { status: 403, message: 'Mechanics are not authorized to enter or modify pricing or financial information.' };
                }

                // Prevent mechanics from modifying financial fields
                if (req.body.hourlyRate !== undefined && Number(req.body.hourlyRate) !== (jobCard.hourlyRate || 0)) {
                    throw { status: 403, message: 'Unauthorized to modify hourly rate.' };
                }
                
                if (req.body.charges) {
                    const oldCharges = jobCard.charges || {};
                    const newCharges = req.body.charges;
                    if (
                        Number(newCharges.lubricantsOil || 0) !== Number(oldCharges.lubricantsOil || 0) ||
                        Number(newCharges.differentialOil || 0) !== Number(oldCharges.differentialOil || 0) ||
                        Number(newCharges.miscellaneous || 0) !== Number(oldCharges.miscellaneous || 0) ||
                        Number(newCharges.transmission || 0) !== Number(oldCharges.transmission || 0) ||
                        Number(newCharges.brakeFluid || 0) !== Number(oldCharges.brakeFluid || 0)
                    ) {
                        throw { status: 403, message: 'Unauthorized to modify service charges.' };
                    }
                }
            }

            const oldStatus = jobCard.status;
            const targetStatus = req.body.status !== undefined ? req.body.status : jobCard.status;
            const wasOpen = oldStatus !== 'Completed';
            const isNowCompleted = targetStatus === 'Completed';
            const isReopened = oldStatus === 'Completed' && targetStatus !== 'Completed';

            const labourHours = req.body.labourHours !== undefined ? Math.max(0, Number(req.body.labourHours) || 0) : (jobCard.labourHours || 0);
            const hourlyRate = isMechanic
                ? (jobCard.hourlyRate || 0)
                : (req.body.hourlyRate !== undefined ? Math.max(0, Number(req.body.hourlyRate) || 0) : (jobCard.hourlyRate || 0));
            const charges = isMechanic
                ? (jobCard.charges || { lubricantsOil: 0, differentialOil: 0, miscellaneous: 0, transmission: 0, brakeFluid: 0 })
                : (req.body.charges !== undefined ? req.body.charges : (jobCard.charges || { lubricantsOil: 0, differentialOil: 0, miscellaneous: 0, transmission: 0, brakeFluid: 0 }));
            const discountAmount = isMechanic
                ? (jobCard.discountAmount || 0)
                : (req.body.discountAmount !== undefined ? Math.max(0, Number(req.body.discountAmount) || 0) : (jobCard.discountAmount || 0));

            const partsUsed = req.body.partsUsed !== undefined
                ? await normalizePartsUsed(req.body.partsUsed, jobCard.partsUsed, isMechanic, session)
                : (jobCard.partsUsed || []).map(p => ({
                    inventoryId: p.inventoryId?._id || p.inventoryId,
                    variantId: p.variantId,
                    variantName: p.variantName,
                    quantity: p.quantity,
                    unitPrice: p.unitPrice
                }));

            const servicesProvided = req.body.servicesProvided !== undefined
                ? normalizeServicesProvided(req.body.servicesProvided, jobCard.servicesProvided, isMechanic)
                : (jobCard.servicesProvided || []).map(s => ({
                    ...(s._id ? { _id: s._id } : {}),
                    name: s.name,
                    quantity: s.quantity,
                    cost: s.cost,
                    total: s.total
                }));

            // Detect whether work scope (parts, services, labour hours) was changed
            const serializeWorkParts = (arr = []) =>
                arr.map(p => `${(p.inventoryId?._id || p.inventoryId)?.toString()}:${p.variantId?.toString() || ''}:${p.quantity}`).sort().join('|');
            const serializeWorkServices = (arr = []) =>
                arr.map(s => `${String(s.name || '').trim().toLowerCase()}:${s.quantity || 1}`).sort().join('|');

            const workChanged =
                (req.body.partsUsed !== undefined && serializeWorkParts(partsUsed) !== serializeWorkParts(jobCard.partsUsed)) ||
                (req.body.servicesProvided !== undefined && serializeWorkServices(servicesProvided) !== serializeWorkServices(jobCard.servicesProvided)) ||
                (req.body.labourHours !== undefined && Number(labourHours) !== Number(jobCard.labourHours || 0));

            // Determine finalAmount override & financialsFinalized state
            let financialsFinalized = jobCard.financialsFinalized || false;
            let finalizedBy = jobCard.finalizedBy || null;
            let finalizedAt = jobCard.finalizedAt || null;
            let finalAmountOverride = null;

            const adminExplicitFinalize = !isMechanic && (req.body.finalizeFinancials === true || req.body.financialsFinalized === true);
            const adminExplicitUnfinalize = !isMechanic && (req.body.finalizeFinancials === false || req.body.financialsFinalized === false);

            if (adminExplicitFinalize) {
                financialsFinalized = true;
                finalizedBy = req.user._id;
                finalizedAt = new Date();
                if (req.body.finalAmount !== undefined && req.body.finalAmount !== null && req.body.finalAmount !== '') {
                    finalAmountOverride = Math.max(0, Number(req.body.finalAmount));
                }
            } else if (adminExplicitUnfinalize) {
                financialsFinalized = false;
                if (req.body.finalAmount !== undefined && req.body.finalAmount !== null && req.body.finalAmount !== '') {
                    finalAmountOverride = Math.max(0, Number(req.body.finalAmount));
                }
            } else if ((wasOpen && isNowCompleted && isMechanic) || isReopened || workChanged) {
                // Require administrative finalization whenever a mechanic marks Completed, or job is reopened, or work items change
                financialsFinalized = false;
            } else if (!isMechanic && req.body.finalAmount !== undefined && req.body.finalAmount !== null && req.body.finalAmount !== '') {
                finalAmountOverride = Math.max(0, Number(req.body.finalAmount));
            } else if (financialsFinalized && jobCard.finalAmount !== null && jobCard.finalAmount !== undefined) {
                // Keep existing finalized override only if admin didn't change item/service/labour/discount prices
                const pricingInputsChanged =
                    !isMechanic && (
                        req.body.partsUsed !== undefined ||
                        req.body.servicesProvided !== undefined ||
                        req.body.hourlyRate !== undefined ||
                        req.body.charges !== undefined ||
                        req.body.discountAmount !== undefined
                    );
                if (!pricingInputsChanged) {
                    finalAmountOverride = jobCard.finalAmount;
                }
            }

            const partsAndLabour = [];
            partsUsed.forEach(p => {
                partsAndLabour.push({ qty: p.quantity || 1, price: p.unitPrice || 0 });
            });
            servicesProvided.forEach(s => {
                partsAndLabour.push({ qty: s.quantity || 1, price: s.cost || 0 });
            });

            const financialTotals = await calculateTaxAndTotals({
                partsAndLabour,
                labourHours,
                hourlyRate,
                charges,
                discountAmount,
                finalAmountOverride,
                gstRate: jobCard.gstRate
            });

            const finalAmountToStore = financialsFinalized
                ? financialTotals.totalAmount
                : (finalAmountOverride !== null ? finalAmountOverride : null);

            const updatePayload = {
                customerId: updatedCustomerId,
                vehicleId: updatedVehicleId,
                trackerCarId: updatedTrackerCarId,
                ...(req.body.trackerId !== undefined ? { trackerId: req.body.trackerId } : {}),
                ...(req.body.rentalEntryId !== undefined ? { rentalEntryId: req.body.rentalEntryId } : {}),
                ...(req.body.technicianId !== undefined ? { technicianId: req.body.technicianId || null } : {}),
                ...(req.body.mechanic !== undefined ? { mechanic: req.body.mechanic } : {}),
                ...(req.body.servicesOrdered !== undefined ? { servicesOrdered: req.body.servicesOrdered } : {}),
                ...(req.body.needsAttention !== undefined ? { needsAttention: req.body.needsAttention } : {}),
                ...(req.body.repairsOrdered !== undefined ? { repairsOrdered: req.body.repairsOrdered } : {}),
                ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
                status: targetStatus,
                partsUsed,
                servicesProvided,
                labourHours,
                hourlyRate,
                charges,
                discountAmount,
                subtotal: financialTotals.subtotal,
                gstRate: financialTotals.gstRate,
                gstAmount: financialTotals.gstAmount,
                totalAmount: financialTotals.totalAmount,
                finalAmount: finalAmountToStore,
                financialsFinalized,
                finalizedBy,
                finalizedAt
            };

            if (wasOpen && isNowCompleted) {
                updatePayload.completedAt = new Date();
                updatePayload.completedBy = req.user._id;
            } else if (isReopened) {
                updatePayload.completionNotificationSent = false;
            }

            const updatedJobCard = await JobCard.findByIdAndUpdate(
                req.params.id,
                updatePayload,
                { new: true, runValidators: true, session }
            )
                .populate('customerId', 'name email phone address postalCode mobile customerType')
                .populate('vehicleId', 'brand make model year registrationNumber vin engineNo speedo mileage mfgDate chassisNo status')
                .populate('trackerCarId', 'registrationNumber make model year vin finalOdometer status')
                .populate('technicianId', 'name email role')
                .populate('completedBy', 'name email role')
                .populate('finalizedBy', 'name email role')
                .populate('partsUsed.inventoryId', 'itemName partNumber');

            // --- Inventory Sync Logic ---
            const newStatus = updatedJobCard.status;
            
            // Prevent mechanics from modifying parts on an already Completed Job Card
            const oldPartsKey = serializeWorkParts(jobCard.partsUsed);
            const newPartsKey = serializeWorkParts(updatedJobCard.partsUsed);
            if (oldStatus === 'Completed' && isMechanic && oldPartsKey !== newPartsKey) {
                throw { status: 403, message: 'Mechanics cannot modify parts used on an already Completed Job Card.' };
            }

            const getPartsMap = (status, partsArray) => {
                if (status !== 'Completed' || !partsArray) return {};
                return partsArray.reduce((acc, part) => {
                    const invIdObj = part.inventoryId?._id || part.inventoryId;
                    if (invIdObj) {
                        if (!part.variantId) {
                            throw new Error(`Variant ID is required for part ${invIdObj}`);
                        }
                        const id = `${invIdObj.toString()}:${part.variantId.toString()}`;
                        acc[id] = (acc[id] || 0) + (part.quantity || 1);
                    }
                    return acc;
                }, {});
            };

            const oldPartsMap = getPartsMap(oldStatus, jobCard.partsUsed);
            const newPartsMap = getPartsMap(newStatus, updatedJobCard.partsUsed);

            const inventoryDeltas = {};
            for (const [id, qty] of Object.entries(newPartsMap)) {
                inventoryDeltas[id] = (inventoryDeltas[id] || 0) + qty;
            }
            for (const [id, qty] of Object.entries(oldPartsMap)) {
                inventoryDeltas[id] = (inventoryDeltas[id] || 0) - qty;
            }

            for (const [key, delta] of Object.entries(inventoryDeltas)) {
                if (delta !== 0) {
                    const [invId, varId] = key.split(':');
                    const item = await Inventory.findById(invId).session(session);
                    if (!item) throw new Error(`Inventory item not found`);
                    
                    const variant = item.variants.id(varId);
                    if (!variant) throw new Error(`Inventory variant not found`);
                    
                    if (variant.quantity - delta < 0) {
                        throw new Error(`Insufficient stock for ${item.itemName} - ${variant.name}. Available: ${variant.quantity}, Requested: ${delta}`);
                    }
                    
                    // Atomically update
                    const updatedItem = await Inventory.findOneAndUpdate(
                        { _id: invId, "variants._id": varId, "variants.quantity": { $gte: delta } },
                        { $inc: { "variants.$.quantity": -delta } },
                        { new: true, session }
                    );

                    if (!updatedItem) {
                        throw new Error(`Failed to deduct stock for ${item.itemName} - ${variant.name}. It may have been modified concurrently.`);
                    }

                    const updatedVariant = updatedItem.variants.id(varId);

                    // Determine transaction type
                    const txType = delta > 0 ? 'JOB_CARD_USAGE' : 'ADJUSTMENT';
                    const reason = delta > 0 ? `Consumed in Job Card JC-${updatedJobCard._id.toString().slice(-4).toUpperCase()}` : `Restored from Job Card JC-${updatedJobCard._id.toString().slice(-4).toUpperCase()}`;

                    await InventoryTransaction.create([{
                        inventoryId: invId,
                        variantId: varId,
                        type: txType,
                        quantity: -delta,
                        previousQuantity: variant.quantity,
                        newQuantity: updatedVariant.quantity,
                        reason: reason,
                        jobCardId: updatedJobCard._id,
                        performedBy: req.user._id
                    }], { session });
                }
            }
            // ----------------------------

            // Notification for "Waiting for Review"
            if (oldStatus !== 'Waiting for Review' && newStatus === 'Waiting for Review') {
                const customerName = updatedJobCard.customerId ? updatedJobCard.customerId.name : 'Unknown Customer';
                
                await Notification.create([{
                    type: 'job_review',
                    title: 'Job Card Ready for Review',
                    message: `Job Card for ${customerName} has been submitted for review by ${req.user.name || 'a mechanic'}.`,
                    relatedModel: 'JobCard',
                    relatedId: updatedJobCard._id
                }], { session });
            }

            let trackerBatchId = null;
            // Stage 2: Notification for "Completed" -> Final Amount Required
            if (wasOpen && isNowCompleted) {
                const customerName = updatedJobCard.customerId ? updatedJobCard.customerId.name : 'Unknown Customer';
                let vehicleLabel = 'Unknown Vehicle';
                
                if (updatedJobCard.vehicleId) {
                    const v = updatedJobCard.vehicleId._id
                        ? updatedJobCard.vehicleId
                        : await Vehicle.findById(updatedJobCard.vehicleId).session(session);
                    if (v) {
                        const makeModel = `${v.brand || v.make || ''} ${v.model || ''}`.trim();
                        vehicleLabel = v.registrationNumber
                            ? (makeModel ? `${makeModel} (${v.registrationNumber})` : v.registrationNumber)
                            : (makeModel || 'Vehicle');
                    }
                } else if (updatedJobCard.trackerCarId) {
                    const tCar = await VehicleBatchMembership.findById(updatedJobCard.trackerCarId._id || updatedJobCard.trackerCarId).session(session);
                    if (tCar) {
                        const makeModel = `${tCar.make || ''} ${tCar.model || ''}`.trim();
                        vehicleLabel = tCar.registrationNumber
                            ? (makeModel ? `${makeModel} (${tCar.registrationNumber})` : tCar.registrationNumber)
                            : (makeModel || 'Fleet Vehicle');
                        
                        // Also trigger Ready for Collection for tracker cars
                        tCar.status = 'Ready for Collection';
                        if (!tCar.readyForCollectionAt) tCar.readyForCollectionAt = new Date();
                        await tCar.save({ session });
                        trackerBatchId = tCar.batchId;
                    }
                }

                // Prevent duplicate completion notifications if already sent for this completion cycle
                if (!jobCard.completionNotificationSent) {
                    const formalJobCardNo = `JC-${updatedJobCard._id.toString().slice(-4).toUpperCase()}`;
                    const mechanicName = req.user.name || updatedJobCard.mechanic || 'Mechanic';
                    const completedAtIso = (updatedJobCard.completedAt || new Date()).toISOString();

                    await Notification.create([{
                        type: 'job_completed',
                        title: 'Job Card Completed — Final Amount Required',
                        message: `Job Card #${formalJobCardNo} has been marked as completed by ${mechanicName}. Please review the completed work, determine the final amount, and finalize the Job Card before generating the invoice. (Customer: ${customerName}, Vehicle: ${vehicleLabel})`,
                        relatedModel: 'JobCard',
                        relatedId: updatedJobCard._id,
                        metadata: {
                            jobCardId: updatedJobCard._id.toString(),
                            jobCardNumber: formalJobCardNo,
                            customerName,
                            vehicleDetails: vehicleLabel,
                            mechanicName,
                            completedAt: completedAtIso,
                            targetRoles: ['admin', 'super_admin'],
                            actionUrl: `/admin/job-cards/${updatedJobCard._id}/edit`
                        }
                    }], { session });

                    await JobCard.updateOne(
                        { _id: updatedJobCard._id },
                        { $set: { completionNotificationSent: true } },
                        { session }
                    );
                    updatedJobCard.completionNotificationSent = true;
                }
            }

            // Log action
            await AuditLog.create([{
                actor: req.user._id,
                action: 'UPDATE_JOB_CARD',
                target: jobCard._id.toString(),
                metadata: {
                    status: updatedJobCard.status,
                    financialsFinalized: updatedJobCard.financialsFinalized
                },
                ipAddress: req.ip
            }], { session });

            return { updatedJobCard, wasOpen, isNowCompleted, trackerBatchId };
        });

        const { updatedJobCard, wasOpen, isNowCompleted, trackerBatchId } = updatedData;

        // Recalculate tracker overall status after transaction commits
        if (wasOpen && isNowCompleted && trackerBatchId) {
            try {
                await recalculateBatchStatus(trackerBatchId);
            } catch (err) {
                console.error('Failed to recalculate batch status after job card completion:', err);
            }
        }

        // Send Email & SMS if newly completed (done outside transaction to avoid blocking DB or resending on retry)
        if (wasOpen && isNowCompleted && updatedJobCard.customerId) {
            const customer = updatedJobCard.customerId;
            if (customer?.email && !updatedJobCard.thankYouEmailSent) {
                try {
                    const emailSent = await EmailService.sendThankYouEmail(updatedJobCard);
                    if (emailSent) {
                        await JobCard.updateOne({ _id: updatedJobCard._id }, { $set: { thankYouEmailSent: true } });
                    }
                } catch (err) {
                    console.error("Failed to send JobCard completion email:", err);
                }
            }
        }

        res.status(200).json({
            success: true,
            data: sanitizeJobCardForRole(updatedJobCard, req.user?.role)
        });
    } catch (error) {
        console.error("Error updating job card:", error);
        if (error.status) {
            return res.status(error.status).json({ success: false, error: error.message });
        }
        if (error.message && error.message.includes('Insufficient stock')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message === 'Job card not found') {
            return res.status(404).json({ success: false, error: 'Job card not found' });
        }
        res.status(500).json({ success: false, error: "Server Error updating job card" });
    }
};

// @desc    Delete (soft delete) a job card
// @route   DELETE /api/job-cards/:id
// @access  Private (Admin/SuperAdmin)
export const deleteJobCard = async (req, res) => {
    try {
        const jobCard = await JobCard.findById(req.params.id);

        if (!jobCard) {
            return res.status(404).json({ success: false, error: 'Job card not found' });
        }

        jobCard.isActive = false;
        await jobCard.save();

        if (jobCard.status === 'Completed' && jobCard.partsUsed && jobCard.partsUsed.length > 0) {
            for (const part of jobCard.partsUsed) {
                if (part.inventoryId && part.variantId) {
                    const item = await Inventory.findOneAndUpdate(
                        { _id: part.inventoryId, "variants._id": part.variantId },
                        { $inc: { "variants.$.quantity": part.quantity } },
                        { new: true }
                    );
                    if (item) {
                        const variant = item.variants.id(part.variantId);
                        await InventoryTransaction.create({
                            inventoryId: part.inventoryId,
                            variantId: part.variantId,
                            type: 'ADJUSTMENT',
                            quantity: part.quantity,
                            previousQuantity: variant.quantity - part.quantity,
                            newQuantity: variant.quantity,
                            reason: `Restored from deleted Job Card JC-${jobCard._id.toString().slice(-4).toUpperCase()}`,
                            jobCardId: jobCard._id,
                            performedBy: req.user._id
                        });
                    }
                }
            }
        }

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'DELETE_JOB_CARD',
            target: jobCard._id.toString(),
            metadata: { },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error("Error deleting job card:", error);
        res.status(500).json({ success: false, error: "Server Error deleting job card" });
    }
};

export const getJobCardHistory = async (req, res) => {
    try {
        const history = await AuditLog.find({ target: req.params.id })
                                      .populate('actor', 'name email role')
                                      .sort('-createdAt');
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error fetching job card history' });
    }
};
