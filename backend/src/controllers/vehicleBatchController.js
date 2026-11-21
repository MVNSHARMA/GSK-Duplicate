import mongoose from 'mongoose';
import VehicleBatch from '../models/VehicleBatch.js';
import VehicleBatchMembership from '../models/VehicleBatchMembership.js';
import Vehicle from '../models/Vehicle.js';
import Customer from '../models/Customer.js';
import JobCard from '../models/JobCard.js';
import VehicleTemplate from '../models/VehicleTemplate.js';
import TrackerCarDocument from '../models/TrackerCarDocument.js';
import AuditLog from '../models/AuditLog.js';
import getCloudinary from '../config/cloudinary.js';
import { escapeRegex } from '../utils/sanitize.js';

// Retry wrapper for generating unique batch numbers under concurrency
const generateBatchNumber = async (type) => {
    let prefix = 'BAT-';
    if (type === 'IMPORT') prefix = 'IMP-';
    if (type === 'RENTAL') prefix = 'REN-';
    if (type === 'FLEET_SERVICE') prefix = 'FLT-';

    const batches = await VehicleBatch.find({ batchNumber: { $regex: `^${prefix}` } }, 'batchNumber');
    let maxNumber = 999;
    
    batches.forEach(batch => {
        const parts = batch.batchNumber.split('-');
        if (parts.length > 1) {
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num) && num > maxNumber) {
                maxNumber = num;
            }
        }
    });

    // Also check memberships to prevent reusing batch numbers from hard-deleted batches
    const memberships = await VehicleBatchMembership.find({ referenceNumber: { $regex: `^${prefix}` } }, 'referenceNumber');
    memberships.forEach(m => {
        if (m.referenceNumber) {
            const parts = m.referenceNumber.split('-');
            if (parts.length >= 2) {
                const num = parseInt(parts[1], 10);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            }
        }
    });

    return `${prefix}${maxNumber + 1}`;
};

export const deriveTrackerStatusAndCounts = (memberships, batchType = 'RENTAL') => {
    if (batchType === 'IMPORT') {
        let importExpected = 0, received = 0, inCompliance = 0, stuck = 0, ready = 0, handedOver = 0, cancelled = 0;
        
        for (const m of memberships) {
            if (m.status === 'Expected') importExpected++;
            else if (m.status === 'Received') received++;
            else if (m.status === 'In Compliance') inCompliance++;
            else if (m.status === 'Stuck') stuck++;
            else if (m.status === 'Ready') ready++;
            else if (m.status === 'Handed Over') handedOver++;
            else if (m.status === 'Cancelled') cancelled++;
            // Fallback for legacy statuses
            else if (m.status === 'Compliance') inCompliance++;
            else if (m.status === 'Ready for Collection') ready++;
            else if (m.status === 'Delivered') handedOver++;
        }
        
        const total = memberships.length;
        const nonCancelled = total - cancelled;
        let overallStatus = 'EXPECTED';
        
        if (total === 0 || importExpected === total) {
            overallStatus = 'EXPECTED';
        } else if (cancelled === total) {
            overallStatus = 'CANCELLED';
        } else if (handedOver === nonCancelled) {
            overallStatus = 'COMPLETED';
        } else {
            overallStatus = 'ACTIVE';
        }
        
        return {
            overallStatus,
            counts: {
                actualVehicleCount: total,
                receivedCount: received,
                complianceCount: inCompliance,
                stuckCount: stuck,
                readyCount: ready,
                handedOverCount: handedOver,
                carsAtGskCount: total - handedOver - cancelled,
                // Legacy fields to prevent frontend breakage
                inServiceCount: 0,
                waitingApprovalCount: 0,
                waitingPartsCount: 0,
                collectedCount: 0,
                deliveredCount: handedOver
            }
        };
    }

    // RENTAL and others
    let expected = 0, received = 0, inspection = 0, waitingApproval = 0, inService = 0;
    let waitingParts = 0, ready = 0, collected = 0, cancelled = 0, compliance = 0, delivered = 0;

    for (const m of memberships) {
        if (m.status === 'Expected') expected++;
        else if (m.status === 'Received') received++;
        else if (m.status === 'Inspection') inspection++;
        else if (m.status === 'Waiting for Approval') waitingApproval++;
        else if (m.status === 'In Service') inService++;
        else if (m.status === 'Waiting for Parts') waitingParts++;
        else if (m.status === 'Compliance') compliance++;
        else if (m.status === 'Ready for Collection') ready++;
        else if (m.status === 'Collected') collected++;
        else if (m.status === 'Delivered') delivered++;
        else if (m.status === 'Cancelled') cancelled++;
        else if (m.status === 'Pending') expected++;
        else if (m.status === 'Waiting') waitingApproval++;
        else if (m.status === 'Completed') collected++;
    }

    const total = memberships.length;
    const nonCancelled = total - cancelled;
    let overallStatus = 'EXPECTED';

    if (total === 0 || expected === total) {
        overallStatus = 'EXPECTED';
    } else if (cancelled === total) {
        overallStatus = 'CANCELLED';
    } else if (collected === nonCancelled) {
        overallStatus = 'COLLECTED';
    } else if (ready + collected === nonCancelled) {
        overallStatus = 'READY FOR COLLECTION';
    } else if (waitingApproval > 0) {
        overallStatus = 'WAITING FOR APPROVAL';
    } else if (waitingParts > 0) {
        overallStatus = 'WAITING FOR PARTS';
    } else if (inService > 0 || inspection > 0) {
        overallStatus = 'IN PROGRESS';
    } else if (received > 0) {
        overallStatus = 'RECEIVED';
    }

    return {
        overallStatus,
        counts: {
            actualVehicleCount: total,
            receivedCount: received + inspection,
            inServiceCount: inService,
            waitingApprovalCount: waitingApproval,
            waitingPartsCount: waitingParts,
            complianceCount: compliance,
            readyCount: ready,
            collectedCount: collected,
            deliveredCount: delivered,
            carsAtGskCount: total - collected - cancelled
        }
    };
};

export const recalculateBatchStatus = async (batchId) => {
    const batch = await VehicleBatch.findById(batchId);
    if (!batch) return;

    const memberships = await VehicleBatchMembership.find({ batchId, isActive: true });
    
    if (memberships.length === 0) {
        if (batch.status !== 'EXPECTED') {
            batch.status = 'EXPECTED';
            await batch.save();
        }
        return;
    }

    const { overallStatus } = deriveTrackerStatusAndCounts(memberships, batch.type);

    if (batch.status !== overallStatus) {
        batch.status = overallStatus;
        await batch.save();
    }
};

// @desc    Get all batches
// @route   GET /api/vehicle-batches
// @access  Private
export const getBatches = async (req, res) => {
    try {
        const { type, status, importStatus, customerId, search, page = 1, limit = 50, dateFilter, dateFrom, dateTo } = req.query;
        
        const filter = { isActive: true };

        // RBAC constraint: users can only see their own customerId batches
        if (req.user.role === 'user') {
            if (!req.user.customerId) {
                return res.status(403).json({ success: false, error: 'User is not linked to a customer.' });
            }
            filter.customerId = req.user.customerId;
        } else if (customerId) {
            filter.customerId = customerId;
        }

        if (type && type !== 'All') {
            filter.type = type;
        }
        
        if (status && status !== 'All Statuses') {
            filter.status = status;
        }

        if (search) {
            const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
            
            // Allow searching by referenceNumber or batchNumber
            filter.$or = [
                { batchNumber: searchRegex },
                { referenceNumber: searchRegex }
            ];

            // Or by customer name if admin
            if (req.user.role !== 'user') {
                const matchingCustomers = await Customer.find({
                    isActive: true,
                    name: searchRegex
                }).select('_id');
                if (matchingCustomers.length > 0) {
                    filter.$or.push({ customerId: { $in: matchingCustomers.map(c => c._id) } });
                }
            }

            // Or by matching VIN, Rego, Make, Model in Memberships
            const matchingMemberships = await VehicleBatchMembership.find({
                isActive: true,
                $or: [
                    { vin: searchRegex },
                    { registrationNumber: searchRegex },
                    { make: searchRegex },
                    { model: searchRegex }
                ]
            }).select('batchId');
            
            if (matchingMemberships.length > 0) {
                const matchedBatchIds = matchingMemberships.map(m => m.batchId);
                filter.$or.push({ _id: { $in: matchedBatchIds } });
            }
        }

        // Active vs Completed segregation for Imports
        if (type === 'IMPORT' && importStatus) {
            // A batch is ACTIVE if at least one active membership is NOT 'Handed Over' and NOT 'Delivered'
            const [activeBatchIdsRaw, allBatchesWithMemberships] = await Promise.all([
                VehicleBatchMembership.distinct('batchId', {
                    isActive: true,
                    status: { $nin: ['Handed Over', 'Delivered'] } // handle legacy 'Delivered'
                }),
                VehicleBatchMembership.distinct('batchId', { isActive: true })
            ]);
            const activeBatchIds = activeBatchIdsRaw.map(id => id.toString());
            
            // Also find batches that have NO memberships at all
            const emptyBatches = await VehicleBatch.find({ type: 'IMPORT', isActive: true, _id: { $nin: allBatchesWithMemberships } }).select('_id').lean();
            const emptyBatchIds = emptyBatches.map(b => b._id.toString());
            
            const allActiveIds = [...activeBatchIds, ...emptyBatchIds];

            if (importStatus === 'active') {
                filter._id = { $in: allActiveIds };
            } else if (importStatus === 'completed') {
                const completedBatchIds = allBatchesWithMemberships
                    .filter(id => !activeBatchIds.includes(id.toString()));
                
                filter._id = { $in: completedBatchIds };
            }
        }

        // Date filtering for Imports
        if (type === 'IMPORT' && dateFilter) {
            const now = new Date();
            let startDate = null;
            let endDate = null;
            
            if (dateFilter === 'Today') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            } else if (dateFilter === '1 Week') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                endDate = now;
            } else if (dateFilter === '1 Month') {
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                endDate = now;
            } else if (dateFilter === 'Custom' && dateFrom && dateTo) {
                startDate = new Date(dateFrom);
                endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
            }
            
            if (startDate && endDate) {
                filter.createdAt = { $gte: startDate, $lte: endDate };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const metricsFilter = { isActive: true };
        if (type && type !== 'All') {
            metricsFilter.type = type;
        }

        const [total, batches, allActiveBatches, allCombinedMemberships] = await Promise.all([
            VehicleBatch.countDocuments(filter),
            VehicleBatch.find(filter)
                .populate('customerId', 'name email phone customerType')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            VehicleBatch.find(metricsFilter, '_id type').lean(),
            VehicleBatchMembership.find({ isActive: true }, 'batchId status').lean()
        ]);

        const activeBatchIdSet = new Set(allActiveBatches.map(b => String(b._id)));

        const membershipsByBatchId = new Map();
        const allActiveMemberships = [];
        for (const m of allCombinedMemberships) {
            const bid = String(m.batchId);
            if (!membershipsByBatchId.has(bid)) {
                membershipsByBatchId.set(bid, []);
            }
            membershipsByBatchId.get(bid).push(m);
            if (activeBatchIdSet.has(bid)) {
                allActiveMemberships.push(m);
            }
        }

        // Calculate counts for the page using authoritative logic (zero N+1 queries)
        for (let batch of batches) {
            const batchMemberships = membershipsByBatchId.get(String(batch._id)) || [];
            const { overallStatus, counts } = deriveTrackerStatusAndCounts(batchMemberships, batch.type);
            
            // Override stale DB status with real-time derived status
            batch.status = overallStatus;
            
            Object.assign(batch, counts);
        }
        
        let globalInService = 0, globalWaiting = 0, globalWaitingApproval = 0, globalWaitingParts = 0, globalReady = 0, globalCollected = 0, globalCancelled = 0;
        let globalInspection = 0, globalCompliance = 0, globalDelivered = 0;

        for (const m of allActiveMemberships) {
            if (m.status === 'In Service') globalInService++;
            else if (['Waiting', 'Waiting for Approval', 'Waiting for Parts'].includes(m.status)) {
                globalWaiting++;
                if (m.status === 'Waiting for Approval') globalWaitingApproval++;
                else if (m.status === 'Waiting for Parts') globalWaitingParts++;
            }
            else if (m.status === 'Ready for Collection') globalReady++;
            else if (['Completed', 'Collected'].includes(m.status)) globalCollected++;
            else if (m.status === 'Cancelled') globalCancelled++;
            else if (m.status === 'Inspection') globalInspection++;
            else if (m.status === 'Compliance') globalCompliance++;
            else if (m.status === 'Delivered') globalDelivered++;
        }

        const isImport = type === 'IMPORT';
        
        // For import, Cars at GSK excludes Delivered and Cancelled
        // For rental, Cars at GSK excludes Collected and Cancelled
        const globalCarsAtGsk = isImport 
            ? allActiveMemberships.length - globalDelivered - globalCancelled 
            : allActiveMemberships.length - globalCollected - globalCancelled;

        res.status(200).json({
            success: true,
            data: batches,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            metrics: {
                carsAtGsk: globalCarsAtGsk,
                inService: globalInService,
                waiting: globalWaiting,
                waitingApproval: globalWaitingApproval,
                waitingParts: globalWaitingParts,
                ready: globalReady,
                inspection: globalInspection,
                compliance: globalCompliance,
                delivered: globalDelivered,
                collected: globalCollected
            }
        });
    } catch (error) {
        console.error("Error fetching batches:", error);
        res.status(500).json({ success: false, error: "Server Error fetching batches" });
    }
};

// @desc    Get single batch by ID
// @route   GET /api/vehicle-batches/:id
// @access  Private
export const getBatchById = async (req, res) => {
    try {
        const [batch, batchMemberships] = await Promise.all([
            VehicleBatch.findById(req.params.id)
                .populate('customerId', 'name email phone customerType')
                .lean(),
            VehicleBatchMembership.find({ batchId: req.params.id, isActive: true }, 'status').lean()
        ]);
            
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }

        // RBAC isolation
        if (req.user.role === 'user' && (!req.user.customerId || batch.customerId._id.toString() !== req.user.customerId.toString())) {
            return res.status(403).json({ success: false, error: 'Unauthorized to view this batch' });
        }

        const { overallStatus, counts } = deriveTrackerStatusAndCounts(batchMemberships, batch.type);
        
        batch.status = overallStatus;
        Object.assign(batch, counts);
        
        res.status(200).json({ success: true, data: batch });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }
        console.error("Error fetching batch by ID:", error);
        res.status(500).json({ success: false, error: "Server Error fetching batch" });
    }
};

// @desc    Create new batch
// @route   POST /api/vehicle-batches
// @access  Private/Admin
export const createBatch = async (req, res) => {
    try {
        const { type, customerId, referenceNumber, expectedVehicleCount, expectedArrivalDate, expectedCompletionDate, notes } = req.body;

        if (!type || !customerId) {
            return res.status(400).json({ success: false, error: "Please provide all required fields (type, customerId)" });
        }

        let newBatch;
        let finalBatchNumber;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const batchNumber = await generateBatchNumber(type);
                
                newBatch = await VehicleBatch.create({
                    batchNumber,
                    customerId,
                    type,
                    referenceNumber: referenceNumber || batchNumber,
                    expectedVehicleCount,
                    expectedArrivalDate,
                    notes
                });
                finalBatchNumber = batchNumber;
                break;
            } catch (err) {
                if (err.code === 11000) {
                    attempts++;
                    if (attempts === maxAttempts) throw err;
                } else {
                    throw err;
                }
            }
        }

        res.status(201).json({ success: true, data: newBatch });
    } catch (error) {
        console.error("Error creating batch:", error);
        res.status(500).json({ success: false, error: "Server Error creating batch" });
    }
};

// @desc    Update batch
// @route   PUT /api/vehicle-batches/:id
// @access  Private/Admin
export const updateBatch = async (req, res) => {
    try {
        const { status, referenceNumber, expectedVehicleCount, expectedArrivalDate, expectedCompletionDate, notes } = req.body;

        const batch = await VehicleBatch.findById(req.params.id);
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }

        if (status) batch.status = status;
        if (referenceNumber !== undefined) batch.referenceNumber = referenceNumber;
        if (expectedVehicleCount !== undefined) batch.expectedVehicleCount = expectedVehicleCount;
        if (expectedArrivalDate !== undefined) batch.expectedArrivalDate = expectedArrivalDate;
        if (expectedCompletionDate !== undefined) batch.expectedCompletionDate = expectedCompletionDate;
        if (notes !== undefined) batch.notes = notes;

        await batch.save();

        res.status(200).json({ success: true, data: batch });
    } catch (error) {
        console.error("Error updating batch:", error);
        res.status(500).json({ success: false, error: "Server Error updating batch" });
    }
};

// @desc    Get batch vehicles (Tracker Cars)
// @route   GET /api/vehicle-batches/:id/vehicles
// @access  Private
export const getBatchVehicles = async (req, res) => {
    try {
        const { page = 1, limit = 50, search, status, complianceStatus, make, model } = req.query;
        const batchId = req.params.id;

        const batch = await VehicleBatch.findById(batchId);
        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });

        // RBAC isolation
        if (req.user.role === 'user' && (!req.user.customerId || batch.customerId.toString() !== req.user.customerId.toString())) {
            return res.status(403).json({ success: false, error: 'Unauthorized' });
        }

        const baseFilter = { batchId: batch._id, isActive: true };
        const filter = { ...baseFilter };

        // --- FILTER METADATA AGGREGATION ---
        const metadataAgg = await VehicleBatchMembership.aggregate([
            { $match: baseFilter },
            {
                $lookup: {
                    from: "vehicles",
                    localField: "vehicleId",
                    foreignField: "_id",
                    as: "vehicleDocs"
                }
            },
            {
                $addFields: {
                    resolvedMake: {
                        $cond: [
                            { $and: [{ $ne: ["$make", null] }, { $ne: ["$make", ""] }] },
                            "$make",
                            { $arrayElemAt: ["$vehicleDocs.brand", 0] }
                        ]
                    },
                    resolvedModel: {
                        $cond: [
                            { $and: [{ $ne: ["$model", null] }, { $ne: ["$model", ""] }] },
                            "$model",
                            { $arrayElemAt: ["$vehicleDocs.model", 0] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    statuses: { $addToSet: "$status" },
                    complianceStatuses: { $addToSet: "$complianceStatus" },
                    carTypes: {
                        $addToSet: {
                            make: { $ifNull: ["$resolvedMake", ""] },
                            model: { $ifNull: ["$resolvedModel", ""] }
                        }
                    }
                }
            }
        ]);

        const uniqueCarTypesMap = new Map();
        if (metadataAgg.length > 0) {
            metadataAgg[0].carTypes.forEach(t => {
                const makeStr = typeof t.make === 'string' ? t.make.trim() : "";
                const modelStr = typeof t.model === 'string' ? t.model.trim() : "";
                let label = `${makeStr} ${modelStr}`.trim();
                if (!label) label = "Unknown Type";
                if (!uniqueCarTypesMap.has(label)) {
                    uniqueCarTypesMap.set(label, { label, make: t.make, model: t.model });
                }
            });
        }
        
        const filterMetadata = {
            statuses: metadataAgg.length > 0 ? metadataAgg[0].statuses.filter(Boolean).sort() : [],
            complianceStatuses: metadataAgg.length > 0 ? metadataAgg[0].complianceStatuses.filter(Boolean).sort() : [],
            carTypes: Array.from(uniqueCarTypesMap.values()).sort((a, b) => a.label.localeCompare(b.label))
        };
        // -----------------------------------

        if (status) filter.status = status;
        if (complianceStatus) filter.complianceStatus = complianceStatus;

        if (make !== undefined && model !== undefined) {
            let vehicleIds = [];
            if (make !== "" || model !== "") {
                const vQuery = {};
                vQuery.brand = make === "" ? { $in: [null, ""] } : make;
                vQuery.model = model === "" ? { $in: [null, ""] } : model;
                const vs = await Vehicle.find(vQuery).select('_id');
                vehicleIds = vs.map(v => v._id);
            }

            const typeOr = [];
            
            if (make === "" && model === "") {
                // Unknown Type: Must have empty native AND no valid vehicleId
                typeOr.push({
                    make: { $in: [null, ""] },
                    model: { $in: [null, ""] },
                    vehicleId: { $in: [null, undefined] }
                });
            } else {
                // Specific Type: 
                // Match native fields OR match vehicle fields if native are empty
                const makeMatch = make === "" ? { $in: [null, ""] } : make;
                const modelMatch = model === "" ? { $in: [null, ""] } : model;
                typeOr.push({ make: makeMatch, model: modelMatch });
                
                if (vehicleIds.length > 0) {
                    typeOr.push({
                        make: { $in: [null, ""] },
                        model: { $in: [null, ""] },
                        vehicleId: { $in: vehicleIds }
                    });
                }
            }

            filter.$and = filter.$and || [];
            filter.$and.push({ $or: typeOr });
        }

        const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (search) {
            const searchRegex = new RegExp(escapeRegex(search), 'i');
            
            // Lookup vehicles for search
            const matchingVehicles = await Vehicle.find({
                $or: [
                    { registrationNumber: searchRegex },
                    { vin: searchRegex },
                    { brand: searchRegex },
                    { model: searchRegex }
                ]
            }).select('_id');
            const searchVehicleIds = matchingVehicles.map(v => v._id);

            const searchOr = [
                { registrationNumber: searchRegex },
                { vin: searchRegex },
                { make: searchRegex },
                { model: searchRegex },
                { referenceNumber: searchRegex }
            ];

            if (searchVehicleIds.length > 0) {
                searchOr.push({ vehicleId: { $in: searchVehicleIds } });
            }

            filter.$and = filter.$and || [];
            filter.$and.push({ $or: searchOr });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const total = await VehicleBatchMembership.countDocuments(filter);
        
        const cars = await VehicleBatchMembership.find(filter)
            .populate('vehicleId', 'registrationNumber brand model vin status')
            .populate('jobCardId', 'jobCardNumber status')
            .populate('statusHistory.updatedBy', 'name email role')
            .sort({ addedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        res.status(200).json({
            success: true,
            data: cars,
            filters: filterMetadata,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }
        console.error("Error fetching batch vehicles:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Add new Tracker Car to batch
// @route   POST /api/vehicle-batches/:id/vehicles
// @access  Private/Admin
export const addVehicleToBatch = async (req, res) => {
    try {
        const { registrationNumber, make, model, year, vin, serviceType, status, notes, vehicleId } = req.body;
        const batch = await VehicleBatch.findById(req.params.id);
        
        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });
        
        // Ensure no duplicate if vehicleId is provided
        if (vehicleId) {
            const vehicle = await Vehicle.findById(vehicleId);
            if (!vehicle) return res.status(404).json({ success: false, error: 'Vehicle not found' });
            if (vehicle.customerId.toString() !== batch.customerId.toString()) {
                return res.status(400).json({ success: false, error: 'Vehicle belongs to a different customer.' });
            }
            
            const existingMembership = await VehicleBatchMembership.findOne({
                batchId: batch._id,
                vehicleId: vehicle._id,
                isActive: true
            });

            if (existingMembership) {
                return res.status(400).json({ success: false, error: 'Vehicle is already in this batch.' });
            }
        }

        const parsedYear = (year === '' || year === undefined || year === null) ? undefined : Number(year);
        if (year !== undefined && year !== '' && year !== null && isNaN(parsedYear)) {
             return res.status(400).json({ success: false, error: 'Year must be a valid number' });
        }

        // Ensure carSequenceCounter is higher than any existing (including orphaned) cars for this batchNumber
        const highestMembershipGlobally = await VehicleBatchMembership.findOne({ referenceNumber: { $regex: `^${batch.batchNumber}-` } })
            .sort({ referenceNumber: -1 });
        let highestSeq = 0;
        if (highestMembershipGlobally && highestMembershipGlobally.referenceNumber) {
            const parts = highestMembershipGlobally.referenceNumber.split('-');
            const lastPart = parts[parts.length - 1];
            if (!isNaN(lastPart)) {
                highestSeq = parseInt(lastPart, 10);
            }
        }
        
        if (!batch.carSequenceCounter || batch.carSequenceCounter < highestSeq) {
            await VehicleBatch.findByIdAndUpdate(batch._id, { carSequenceCounter: highestSeq });
        }
        
        const updatedBatch = await VehicleBatch.findByIdAndUpdate(
            batch._id,
            { $inc: { carSequenceCounter: 1 } },
            { new: true }
        );
        
        const seq = updatedBatch.carSequenceCounter.toString().padStart(3, '0');
        const referenceNumber = `${batch.batchNumber}-${seq}`;

        const membershipData = {
            batchId: batch._id,
            referenceNumber,
            registrationNumber,
            make,
            model,
            year: parsedYear,
            vin,
            serviceType,
            status: status || 'Pending',
            notes,
            receivedAt: new Date()
        };

        if (vehicleId) {
            membershipData.vehicleId = vehicleId;
        }

        const membership = await VehicleBatchMembership.create(membershipData);
        
        await recalculateBatchStatus(batch._id);

        res.status(201).json({ success: true, data: membership });
    } catch (error) {
        console.error("Error adding vehicle to batch:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Update single Tracker Car status
// @route   PATCH /api/vehicle-batches/:id/cars/:carId/status
// @access  Private/Admin
export const updateVehicleStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const { id, carId } = req.params;
        
        if (!status) return res.status(400).json({ success: false, error: 'Status is required' });

        const membership = await VehicleBatchMembership.findOne({ _id: carId, batchId: id, isActive: true });
        if (!membership) {
            return res.status(404).json({ success: false, error: 'Tracker Car not found or does not belong to this Tracker' });
        }
        
        const previousStatus = membership.status;
        membership.status = status;
        await membership.save();
        
        await recalculateBatchStatus(id);
        
        if (previousStatus !== status) {
            await AuditLog.create({
                actor: req.user._id,
                actorName: req.user.name,
                actorRole: req.user.role,
                action: 'STATUS_CHANGE',
                target: membership._id,
                entityType: 'VehicleBatchMembership',
                entityId: carId,
                entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
                description: `Status changed from ${previousStatus} to ${status}`,
                metadata: { previousStatus, newStatus: status }
            });
        }

        await membership.populate([
            { path: 'vehicleId', select: 'registrationNumber brand model vin status' },
            { path: 'jobCardId', select: 'jobCardNumber status' },
            { path: 'statusHistory.updatedBy', select: 'name email role' }
        ]);

        const updatedBatch = await VehicleBatch.findById(id);

        res.status(200).json({ success: true, data: membership, batchStatus: updatedBatch.status });
    } catch (error) {
        console.error("Error updating tracker car status:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Update Tracker Car details (Rego, status, notes)
// @route   PATCH /api/vehicle-batches/:id/cars/:carId
// @access  Private/Admin
export const updateTrackerCar = async (req, res) => {
    try {
        const { registrationNumber, status, notes, vin } = req.body;
        const { id, carId } = req.params;

        const membership = await VehicleBatchMembership.findOne({ _id: carId, batchId: id, isActive: true });
        if (!membership) {
            return res.status(404).json({ success: false, error: 'Tracker Car not found' });
        }

        const previousStatus = membership.status;

        if (registrationNumber !== undefined) membership.registrationNumber = registrationNumber;
        if (vin !== undefined) {
            membership.vin = typeof vin === 'string' ? vin.trim() : vin;
        }
        if (status !== undefined) membership.status = status;
        if (notes !== undefined) membership.notes = notes;
        if (req.body.complianceStatus !== undefined) membership.complianceStatus = req.body.complianceStatus;
        if (req.body.blueSlip !== undefined) membership.blueSlip = req.body.blueSlip;
        if (req.body.pinkSlip !== undefined) membership.pinkSlip = req.body.pinkSlip;
        if (req.body.complianceNotes !== undefined) membership.complianceNotes = req.body.complianceNotes;

        await membership.save();
        await recalculateBatchStatus(id);

        if (status !== undefined && previousStatus !== status) {
            await AuditLog.create({
                actor: req.user._id,
                actorName: req.user.name,
                actorRole: req.user.role,
                action: 'STATUS_CHANGE',
                target: membership._id,
                entityType: 'VehicleBatchMembership',
                entityId: carId,
                entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
                description: `Status changed from ${previousStatus} to ${status}`,
                metadata: { previousStatus, newStatus: status }
            });
        } else {
            // Log general edit
            await AuditLog.create({
                actor: req.user._id,
                actorName: req.user.name,
                actorRole: req.user.role,
                action: 'TRACKER_CAR_EDIT',
                target: membership._id,
                entityType: 'VehicleBatchMembership',
                entityId: carId,
                entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
                description: `Updated tracker car details`,
                metadata: {}
            });
        }

        res.status(200).json({ success: true, data: membership });
    } catch (error) {
        console.error("Error updating tracker car:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Bulk Update Tracker Car Statuses
// @route   PATCH /api/vehicle-batches/:id/cars/status
// @access  Private/Admin
export const bulkUpdateVehicleStatus = async (req, res) => {
    try {
        const { status, carIds } = req.body;
        const { id } = req.params;
        
        if (!status) return res.status(400).json({ success: false, error: 'Status is required' });
        if (!carIds || !Array.isArray(carIds) || carIds.length === 0) {
            return res.status(400).json({ success: false, error: 'carIds must be a non-empty array' });
        }
        
        if (status === 'Collected') {
            return res.status(400).json({ success: false, error: 'Cannot set Collected status via bulk update. Use the individual Mark Collected workflow.' });
        }

        const validStatuses = ['Expected', 'Received', 'Inspection', 'Waiting for Approval', 'In Service', 'Waiting for Parts', 'Ready for Collection', 'Cancelled', 'Pending', 'Waiting', 'Completed', 'In Compliance', 'Stuck', 'Ready', 'Handed Over'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const batch = await VehicleBatch.findById(id);
        if (!batch) return res.status(404).json({ success: false, error: 'Tracker not found' });
        
        const cars = await VehicleBatchMembership.find({ _id: { $in: carIds }, batchId: id, isActive: true });
        
        if (cars.length !== carIds.length) {
            return res.status(400).json({ success: false, error: 'One or more selected cars no longer belong to this tracker.' });
        }
        
        const bulkOps = cars.map(car => {
            const updateFields = { status };
            if (status === 'Received' && !car.receivedAt) {
                updateFields.receivedAt = new Date();
                updateFields.receivedBy = req.user._id;
            }
            if (status === 'Inspection' && !car.inspectedAt) updateFields.inspectedAt = new Date();
            if (status === 'Ready for Collection' && !car.readyForCollectionAt) updateFields.readyForCollectionAt = new Date();

            return {
                updateOne: {
                    filter: { _id: car._id },
                    update: { 
                        $set: updateFields,
                        $push: {
                            statusHistory: {
                                status: status,
                                timestamp: new Date(),
                                updatedBy: req.user._id
                            }
                        }
                    }
                }
            };
        });
        
        if (bulkOps.length > 0) {
            await VehicleBatchMembership.bulkWrite(bulkOps);
        }
        
        await recalculateBatchStatus(id);

        const updatedCars = await VehicleBatchMembership.find({ _id: { $in: carIds } })
            .populate('vehicleId', 'registrationNumber brand model vin status')
            .populate('jobCardId', 'jobCardNumber status')
            .populate('statusHistory.updatedBy', 'name email role');

        if (cars.length > 0) {
            await AuditLog.create({
                actor: req.user._id,
                actorName: req.user.name,
                actorRole: req.user.role,
                action: 'BULK_STATUS_UPDATE',
                target: batch._id,
                entityType: 'VehicleBatch',
                entityId: batch._id,
                entityDisplay: batch.referenceNumber || batch.batchNumber,
                description: `Bulk updated ${cars.length} Tracker Cars to ${status}`,
                metadata: {
                    newStatus: status,
                    affectedCount: cars.length,
                    affectedCars: cars.map(car => ({
                        id: car._id,
                        display: car.registrationNumber || car.vin || car.referenceNumber,
                        previousStatus: car.status
                    }))
                }
            });
        }
        
        const updatedBatch = await VehicleBatch.findById(id);

        res.status(200).json({ success: true, message: `${cars.length} cars updated to ${status}`, updatedVehicles: updatedCars, batchStatus: updatedBatch.status });
    } catch (error) {
        console.error("Error in bulk update status:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Remove vehicle from batch
// @route   DELETE /api/vehicle-batches/:id/vehicles/:membershipId
// @access  Private/Admin
export const removeVehicleFromBatch = async (req, res) => {
    try {
        const membership = await VehicleBatchMembership.findById(req.params.membershipId);
        
        if (!membership || membership.batchId.toString() !== req.params.id) {
            return res.status(404).json({ success: false, error: 'Membership not found' });
        }

        membership.isActive = false;
        membership.removedAt = new Date();
        await membership.save();
        
        await recalculateBatchStatus(req.params.id);

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error("Error removing vehicle from batch:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Bulk Import CSV Vehicles
// @route   POST /api/vehicle-batches/:id/bulk-import
// @access  Private/Admin
export const bulkImportVehicles = async (req, res) => {
    try {
        const batch = await VehicleBatch.findById(req.params.id);
        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });
        
        const rows = req.body.vehicles; // Expecting array of { regoNo, vin, brand, model, year }
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ success: false, error: 'No vehicle data provided' });
        }

        const results = {
            validNew: 0,
            invalid: 0,
            errors: []
        };

        const membershipsToInsert = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rego = (row.regoNo || row.registrationNumber || '').toString().trim().toUpperCase();
            const vin = (row.vin || '').toString().trim().toUpperCase();

            if (!rego && !vin) {
                results.invalid++;
                results.errors.push(`Row ${i+1}: Missing Rego No and VIN`);
                continue;
            }
            if (!row.brand || !row.model) {
                results.invalid++;
                results.errors.push(`Row ${i+1}: Missing Brand or Model (${rego || vin})`);
                continue;
            }

            membershipsToInsert.push({
                batchId: batch._id,
                vehicleId: null,
                registrationNumber: rego,
                make: row.brand,
                model: row.model,
                year: parseInt(row.year) || null,
                vin: vin,
                status: 'Pending',
                receivedAt: new Date()
            });
            results.validNew++;
        }

        if (membershipsToInsert.length > 0) {
            await VehicleBatchMembership.insertMany(membershipsToInsert, { ordered: false });
            await recalculateBatchStatus(batch._id);
        }

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error("Error during bulk import:", error);
        res.status(500).json({ success: false, error: "Server Error during bulk import" });
    }
};

// @desc    Delete (soft-delete) a tracker/batch and its cars
// @route   DELETE /api/vehicle-batches/:id
// @access  Private/Admin
export const deleteBatch = async (req, res) => {
    try {
        const batch = await VehicleBatch.findById(req.params.id);
        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });
        
        if (batch.type !== 'IMPORT' && batch.type !== 'RENTAL') {
            return res.status(400).json({ success: false, error: 'Only Import and Rental trackers can be deleted' });
        }

        // Soft delete the batch
        batch.isActive = false;
        await batch.save();

        // Soft delete all memberships belonging to the batch
        const membershipResult = await VehicleBatchMembership.updateMany(
            { batchId: batch._id },
            { $set: { isActive: false } }
        );

        // Audit Log
        const eventType = batch.type === 'IMPORT' ? 'DELETE_IMPORT_TRACKER' : 'DELETE_RENTAL_TRACKER';
        if (req.logAudit) {
            await req.logAudit({
                action: eventType,
                targetId: batch._id,
                targetModel: 'VehicleBatch',
                details: `Removed ${batch.type === 'IMPORT' ? 'Import' : 'Rental'} Tracker ${batch.batchNumber} with ${membershipResult.modifiedCount} cars.`,
                status: 'success'
            });
        }

        res.status(200).json({ success: true, message: 'Tracker removed successfully' });
    } catch (error) {
        console.error("Error deleting batch:", error);
        res.status(500).json({ success: false, error: "Server Error deleting batch" });
    }
};

// @desc    Bulk Add Tracker Cars from VehicleType/Template
// @route   POST /api/vehicle-batches/:id/cars/bulk
// @access  Private/Admin
export const bulkAddTrackerCars = async (req, res) => {
    try {
        const batchId = req.params.id;
        const { vehicleTypeId, quantity, vins } = req.body;

        if (!vehicleTypeId || !quantity || isNaN(quantity) || quantity <= 0 || quantity > 100) {
            return res.status(400).json({ success: false, error: 'Valid vehicleTypeId and a quantity between 1 and 100 are required.' });
        }
        
        if (vins && Array.isArray(vins) && vins.length > 0 && vins.length !== quantity) {
            return res.status(400).json({ success: false, error: 'If VINs are provided, the number of VINs must exactly match the quantity.' });
        }

        const batch = await VehicleBatch.findById(batchId);
        if (!batch || !batch.isActive) {
            return res.status(404).json({ success: false, error: 'Tracker not found or is inactive.' });
        }
        
        if (batch.type !== 'IMPORT' && batch.type !== 'RENTAL') {
            return res.status(400).json({ success: false, error: 'Bulk Add is only available for Import and Rental trackers.' });
        }

        const vehicleType = await VehicleTemplate.findById(vehicleTypeId);
        if (!vehicleType || !vehicleType.isActive) {
            return res.status(404).json({ success: false, error: 'Vehicle Type not found or is inactive.' });
        }
        
        if (vehicleType.customerId.toString() !== batch.customerId.toString()) {
            return res.status(403).json({ success: false, error: 'Vehicle Type does not belong to the tracker\'s company.' });
        }

        // Ensure carSequenceCounter is higher than any existing (including orphaned) cars for this batchNumber
        const highestMembershipGlobally = await VehicleBatchMembership.findOne({ referenceNumber: { $regex: `^${batch.batchNumber}-` } })
            .sort({ referenceNumber: -1 });
        let highestSeq = 0;
        if (highestMembershipGlobally && highestMembershipGlobally.referenceNumber) {
            const parts = highestMembershipGlobally.referenceNumber.split('-');
            const lastPart = parts[parts.length - 1];
            if (!isNaN(lastPart)) {
                highestSeq = parseInt(lastPart, 10);
            }
        }
        
        if (!batch.carSequenceCounter || batch.carSequenceCounter < highestSeq) {
            await VehicleBatch.findByIdAndUpdate(batch._id, { carSequenceCounter: highestSeq });
        }

        const updatedBatch = await VehicleBatch.findByIdAndUpdate(
            batch._id,
            { $inc: { carSequenceCounter: quantity } },
            { new: true }
        );
        
        let startSeq = updatedBatch.carSequenceCounter - quantity + 1;

        const membershipsToInsert = [];
        for (let i = 0; i < quantity; i++) {
            const seq = (startSeq + i).toString().padStart(3, '0');
            const referenceNumber = `${batch.batchNumber}-${seq}`;
            
            let safeYear = vehicleType.year;
            if (safeYear === '' || safeYear === null || isNaN(Number(safeYear))) safeYear = undefined;
            
            const templateDetails = [safeYear, vehicleType.make, vehicleType.model].filter(Boolean).join(' ');
            
            membershipsToInsert.push({
                batchId: batch._id,
                referenceNumber,
                registrationNumber: '',
                make: vehicleType.make,
                model: vehicleType.model,
                year: safeYear,
                vin: (vins && vins[i]) ? vins[i].trim().toUpperCase() : '',
                serviceType: vehicleType.defaultServiceType || '',
                status: 'Expected',
                notes: `Bulk added from template: ${templateDetails}`
            });
        }

        await VehicleBatchMembership.insertMany(membershipsToInsert);
        await recalculateBatchStatus(batch._id);

        res.status(201).json({ success: true, carsCreated: quantity });
    } catch (error) {
        console.error("Error in bulk add tracker cars:", error);
        res.status(500).json({ success: false, error: "Server Error bulk adding cars" });
    }
};

// @desc    Receive a Tracker Car
// @route   POST /api/vehicle-batches/:id/cars/:carId/receive
// @access  Private/Admin
export const receiveTrackerCar = async (req, res) => {
    try {
        const { id, carId } = req.params;
        const { registrationNumber, odometer, fuelLevel, keysReceived, conditionNotes } = req.body;

        const membership = await VehicleBatchMembership.findOne({ _id: carId, batchId: id, isActive: true });
        if (!membership) return res.status(404).json({ success: false, error: 'Tracker Car not found' });

        if (membership.status !== 'Expected' && membership.status !== 'Pending') {
            return res.status(400).json({ success: false, error: 'Car has already been received or is in a later state.' });
        }

        if (registrationNumber) membership.registrationNumber = registrationNumber;
        if (odometer) membership.odometer = odometer;
        if (fuelLevel) membership.fuelLevel = fuelLevel;
        if (keysReceived !== undefined) membership.keysReceived = keysReceived;
        if (conditionNotes) membership.conditionNotes = conditionNotes;

        membership.receivedAt = new Date();
        membership.receivedBy = req.user._id;
        const previousStatus = membership.status;
        membership.status = 'Received';

        await membership.save();
        await recalculateBatchStatus(id);

        await AuditLog.create({
            actor: req.user._id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'STATUS_CHANGE',
            target: membership._id,
            entityType: 'VehicleBatchMembership',
            entityId: carId,
            entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
            description: `Status changed from ${previousStatus} to Received (Car Received)`,
            metadata: { previousStatus, newStatus: 'Received' }
        });

        res.status(200).json({ success: true, data: membership });
    } catch (error) {
        console.error("Error receiving tracker car:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Start Inspection on a Tracker Car
// @route   POST /api/vehicle-batches/:id/cars/:carId/inspect
// @access  Private/Admin
export const inspectTrackerCar = async (req, res) => {
    try {
        const { id, carId } = req.params;
        
        const membership = await VehicleBatchMembership.findOne({ _id: carId, batchId: id, isActive: true });
        if (!membership) return res.status(404).json({ success: false, error: 'Tracker Car not found' });

        // If it's already past Inspection, just return success idempotently or let it update if it was mistakenly in a previous state
        if (['Inspection', 'In Service', 'Waiting for Approval', 'Waiting for Parts', 'Ready for Collection', 'Collected', 'Completed'].includes(membership.status)) {
             // Idempotent return if already inspected
             if (!membership.inspectedAt) {
                 membership.inspectedAt = new Date();
                 await membership.save();
             }
             return res.status(200).json({ success: true, data: membership });
        }

        if (!membership.receivedAt) {
            return res.status(400).json({ success: false, error: 'Cannot inspect a car that has not been received.' });
        }

        membership.inspectedAt = new Date();
        const previousStatus = membership.status;
        membership.status = 'Inspection';

        await membership.save();
        await recalculateBatchStatus(id);

        await AuditLog.create({
            actor: req.user._id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'STATUS_CHANGE',
            target: membership._id,
            entityType: 'VehicleBatchMembership',
            entityId: carId,
            entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
            description: `Status changed from ${previousStatus} to Inspection (Inspection Started)`,
            metadata: { previousStatus, newStatus: 'Inspection' }
        });

        res.status(200).json({ success: true, data: membership });
    } catch (error) {
        console.error("Error starting inspection:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Mark Tracker Car as Collected
// @route   POST /api/vehicle-batches/:id/cars/:carId/collect
// @access  Private/Admin
export const markCollectedTrackerCar = async (req, res) => {
    try {
        const { id, carId } = req.params;
        const { finalOdometer } = req.body;

        const membership = await VehicleBatchMembership.findOne({ _id: carId, batchId: id, isActive: true });
        if (!membership) return res.status(404).json({ success: false, error: 'Tracker Car not found' });

        if (membership.status === 'Collected') {
            return res.status(200).json({ success: true, data: membership }); // Idempotent
        }

        if (finalOdometer) membership.finalOdometer = finalOdometer;

        membership.collectedAt = new Date();
        membership.collectedBy = req.user._id;
        const previousStatus = membership.status;
        membership.status = 'Collected';

        await membership.save();
        await recalculateBatchStatus(id);

        await AuditLog.create({
            actor: req.user._id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'STATUS_CHANGE',
            target: membership._id,
            entityType: 'VehicleBatchMembership',
            entityId: carId,
            entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
            description: `Status changed from ${previousStatus} to Collected`,
            metadata: { previousStatus, newStatus: 'Collected' }
        });

        res.status(200).json({ success: true, data: membership });
    } catch (error) {
        console.error("Error collecting tracker car:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Get Tracker Car by ID
// @route   GET /api/vehicle-batches/cars/:carId
// @access  Private
export const getTrackerCarById = async (req, res) => {
    try {
        const { carId } = req.params;

        const car = await VehicleBatchMembership.findById(carId)
            .populate({
                path: 'batchId',
                populate: { path: 'customerId', select: 'name email phone customerType' }
            });

        if (!car) {
            return res.status(404).json({ success: false, error: 'Tracker Car not found' });
        }

        // Fetch associated Job Cards
        const jobCards = await JobCard.find({ trackerCarId: carId, isActive: true })
            .sort({ createdAt: -1 });

        // Fetch Audit Logs for Status History
        const statusHistoryRaw = await AuditLog.find({ entityId: carId, action: 'STATUS_CHANGE' })
            .sort({ createdAt: -1 })
            .select('createdAt description metadata actorName');
            
        const statusHistory = statusHistoryRaw.map(log => ({
            status: log.metadata?.newStatus || 'Unknown',
            timestamp: log.createdAt,
            notes: log.description,
            user: log.actorName
        }));

        res.status(200).json({
            success: true,
            data: {
                ...car.toObject(),
                jobCards,
                statusHistory
            }
        });
    } catch (error) {
        console.error("Error fetching tracker car:", error);
        res.status(500).json({ success: false, error: "Server Error fetching tracker car" });
    }
};

// @desc    Bulk Mark Tracker Cars as Collected
// @route   POST /api/vehicle-batches/:id/cars/bulk-collect
// @access  Private/Admin
export const bulkCollectTrackerCars = async (req, res) => {
    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        
        const { id } = req.params;
        const { collectionDetails } = req.body;
        
        if (!Array.isArray(collectionDetails) || collectionDetails.length === 0) {
            throw new Error('No cars selected for collection');
        }

        const batch = await VehicleBatch.findOne({ _id: id, type: 'RENTAL' }).session(session);
        if (!batch) {
            throw new Error('Rental Tracker not found');
        }

        const carIds = collectionDetails.map(c => c.carId);
        
        const memberships = await VehicleBatchMembership.find({ 
            _id: { $in: carIds }, 
            batchId: id, 
            isActive: true 
        }).session(session);

        if (memberships.length !== carIds.length) {
            throw new Error('One or more selected cars are invalid or do not belong to this tracker');
        }

        const bulkOps = collectionDetails.map(detail => {
            const updateFields = {
                status: 'Collected',
                collectedAt: new Date(),
                collectedBy: req.user._id
            };
            if (detail.finalOdometer !== undefined && detail.finalOdometer !== null && detail.finalOdometer !== '') {
                updateFields.finalOdometer = detail.finalOdometer;
            }

            return {
                updateOne: {
                    filter: { _id: detail.carId },
                    update: { $set: updateFields }
                }
            };
        });

        if (bulkOps.length > 0) {
            await VehicleBatchMembership.bulkWrite(bulkOps, { session });
        }
        
        await session.commitTransaction();
        session.endSession();
        
        await recalculateBatchStatus(id);

        if (memberships.length > 0) {
            await AuditLog.create({
                actor: req.user._id,
                actorName: req.user.name,
                actorRole: req.user.role,
                action: 'BULK_STATUS_UPDATE',
                target: batch._id,
                entityType: 'VehicleBatch',
                entityId: batch._id,
                entityDisplay: batch.referenceNumber || batch.batchNumber,
                description: `Bulk collected ${memberships.length} Rental Tracker Cars`,
                metadata: {
                    newStatus: 'Collected',
                    affectedCount: memberships.length,
                    affectedCars: memberships.map(car => ({
                        id: car._id,
                        display: car.registrationNumber || car.vin || car.referenceNumber,
                        previousStatus: car.status
                    }))
                }
            });
        }

        res.status(200).json({ success: true, message: `${bulkOps.length} cars successfully collected` });
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error("Error in bulk collection:", error);
        res.status(400).json({ success: false, error: error.message || "Server Error" });
    }
};

// @desc    Mark a single Import Tracker Car as Delivered
// @route   POST /api/vehicle-batches/:id/cars/:carId/deliver
// @access  Private/Admin
export const markDeliveredTrackerCar = async (req, res) => {
    try {
        const { id, carId } = req.params;
        const { deliveryNotes } = req.body;

        const membership = await VehicleBatchMembership.findOne({ _id: carId, batchId: id, isActive: true }).populate('batchId');
        if (!membership) return res.status(404).json({ success: false, error: 'Tracker Car not found' });

        if (membership.batchId.type !== 'IMPORT') {
            return res.status(400).json({ success: false, error: 'Only IMPORT trackers support delivery' });
        }

        if (membership.status === 'Delivered') {
            return res.status(200).json({ success: true, data: membership }); // Idempotent
        }

        if (deliveryNotes) membership.notes = membership.notes ? `${membership.notes}\nDelivery: ${deliveryNotes}` : `Delivery: ${deliveryNotes}`;

        membership.deliveredAt = new Date();
        membership.deliveredBy = req.user._id;
        const previousStatus = membership.status;
        membership.status = 'Delivered';

        await membership.save();
        await recalculateBatchStatus(id);

        await AuditLog.create({
            actor: req.user._id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'STATUS_CHANGE',
            target: membership._id,
            entityType: 'VehicleBatchMembership',
            entityId: carId,
            entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
            description: `Status changed from ${previousStatus} to Delivered`,
            metadata: { previousStatus, newStatus: 'Delivered' }
        });

        res.status(200).json({ success: true, data: membership });
    } catch (error) {
        console.error("Error delivering tracker car:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// @desc    Bulk Mark Tracker Cars as Delivered
// @route   POST /api/vehicle-batches/:id/cars/bulk-deliver
// @access  Private/Admin
export const bulkDeliverTrackerCars = async (req, res) => {
    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        
        const { id } = req.params;
        const { deliveryDetails } = req.body;
        
        if (!Array.isArray(deliveryDetails) || deliveryDetails.length === 0) {
            throw new Error('No cars selected for delivery');
        }

        const batch = await VehicleBatch.findOne({ _id: id, type: 'IMPORT' }).session(session);
        if (!batch) {
            throw new Error('Import Tracker not found');
        }

        const carIds = deliveryDetails.map(c => c.carId);
        
        const memberships = await VehicleBatchMembership.find({ 
            _id: { $in: carIds }, 
            batchId: id, 
            isActive: true 
        }).session(session);

        if (memberships.length !== carIds.length) {
            throw new Error('One or more selected cars are invalid or do not belong to this tracker');
        }

        const bulkOps = deliveryDetails.map(detail => {
            const updateFields = {
                status: 'Delivered',
                deliveredAt: new Date(),
                deliveredBy: req.user._id
            };
            
            const ops = {
                updateOne: {
                    filter: { _id: detail.carId },
                    update: { $set: updateFields }
                }
            };

            // If notes are provided, we should ideally fetch the current notes and append, 
            // but for a bulk write, if we want to append strings safely, we might have to use aggregation pipelines in the update.
            // Since Mongoose bulkWrite supports pipeline updates (e.g. [{ $set: { notes: { $concat: ["$notes", "\nDelivery: ", detail.notes] } } }]),
            // let's do a simple overwrite or skip. Actually, the prompt says "preserve delivery notes if supported by schema".
            // Since we can't easily append in a standard updateOne without pipelines (which might complicate things),
            // let's just fetch the memberships beforehand since we already did!
            const mem = memberships.find(m => m._id.toString() === detail.carId.toString());
            if (mem && detail.notes) {
                updateFields.notes = mem.notes ? `${mem.notes}\nDelivery: ${detail.notes}` : `Delivery: ${detail.notes}`;
            }

            return ops;
        });

        if (bulkOps.length > 0) {
            await VehicleBatchMembership.bulkWrite(bulkOps, { session });
        }
        
        await session.commitTransaction();
        session.endSession();
        
        await recalculateBatchStatus(id);

        if (memberships.length > 0) {
            await AuditLog.create({
                actor: req.user._id,
                actorName: req.user.name,
                actorRole: req.user.role,
                action: 'BULK_STATUS_UPDATE',
                target: batch._id,
                entityType: 'VehicleBatch',
                entityId: batch._id,
                entityDisplay: batch.referenceNumber || batch.batchNumber,
                description: `Bulk delivered ${memberships.length} Import Tracker Cars`,
                metadata: {
                    newStatus: 'Delivered',
                    affectedCount: memberships.length,
                    affectedCars: memberships.map(car => ({
                        id: car._id,
                        display: car.registrationNumber || car.vin || car.referenceNumber,
                        previousStatus: car.status
                    }))
                }
            });
        }

        res.status(200).json({ success: true, message: `${bulkOps.length} cars successfully delivered` });
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error("Error in bulk delivery:", error);
        res.status(400).json({ success: false, error: error.message || "Server Error" });
    }
};

// ==========================================
// REOPEN / CORRECT TERMINAL STATUS
// ==========================================
export const reopenTrackerCarStatus = async (req, res) => {
    try {
        const { id, carId } = req.params;
        const { newStatus, reason } = req.body;

        if (!reason || typeof reason !== 'string' || !reason.trim()) {
            return res.status(400).json({ success: false, error: 'A valid reason is required to correct a terminal status.' });
        }

        if (!newStatus) {
            return res.status(400).json({ success: false, error: 'A new status is required.' });
        }

        const membership = await VehicleBatchMembership.findOne({ _id: carId, batchId: id, isActive: true }).populate('batchId');
        if (!membership) return res.status(404).json({ success: false, error: 'Tracker Car not found' });

        const batchType = membership.batchId.type;
        const currentStatus = membership.status;

        // Validate terminal state constraint and new status options
        if (batchType === 'RENTAL') {
            if (currentStatus !== 'Collected') return res.status(400).json({ success: false, error: 'Car must be Collected to reopen.' });
            const validRentalStatuses = ['Expected', 'Received', 'Inspection', 'Waiting for Approval', 'In Service', 'Waiting for Parts', 'Ready for Collection'];
            if (!validRentalStatuses.includes(newStatus)) return res.status(400).json({ success: false, error: 'Invalid target status for Rental.' });
            
            // Clear terminal metadata for operational active state
            membership.collectedAt = undefined;
            membership.collectedBy = undefined;
            // We preserve finalOdometer if it was recorded, as it represents a factual reading.
        } else if (batchType === 'IMPORT') {
            if (currentStatus !== 'Delivered') return res.status(400).json({ success: false, error: 'Car must be Delivered to reopen.' });
            const validImportStatuses = ['Expected', 'Received', 'Inspection', 'Waiting for Approval', 'In Service', 'Waiting for Parts', 'Compliance', 'Ready for Collection'];
            if (!validImportStatuses.includes(newStatus)) return res.status(400).json({ success: false, error: 'Invalid target status for Import.' });

            // Clear terminal metadata
            membership.deliveredAt = undefined;
            membership.deliveredBy = undefined;
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported tracker type.' });
        }

        membership.status = newStatus;
        await membership.save();
        
        // Recalculate parent tracker
        await recalculateBatchStatus(id);

        await AuditLog.create({
            actor: req.user._id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'TRACKER_CAR_STATUS_CORRECTED',
            target: membership._id,
            entityType: 'VehicleBatchMembership',
            entityId: carId,
            entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
            description: `Corrected ${batchType} Tracker Car from ${currentStatus} to ${newStatus}`,
            metadata: { previousStatus: currentStatus, newStatus, reason: reason.trim(), trackerType: batchType, batchId: id, membershipId: carId }
        });

        res.status(200).json({ success: true, data: membership });
    } catch (error) {
        console.error("Error reopening tracker car:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// ==========================================
// TRACKER CAR DOCUMENTS & PHOTOS
// ==========================================

export const uploadTrackerCarDocument = async (req, res) => {
    try {
        const { batchId, carId } = req.params;
        const { category, type, isCustomerVisible } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }
        if (!category || !type) {
            return res.status(400).json({ success: false, message: 'Missing type or category' });
        }

        const cloudinary = getCloudinary();
        if (!cloudinary) {
            return res.status(500).json({ success: false, error: 'Cloudinary configuration is missing.' });
        }

        const membership = await VehicleBatchMembership.findById(carId);
        if (!membership || membership.batchId.toString() !== batchId) {
            return res.status(404).json({ success: false, message: 'Tracker Car not found' });
        }

        const batch = await VehicleBatch.findById(batchId);
        if (!batch) {
            return res.status(404).json({ success: false, message: 'Tracker not found' });
        }

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'tracker-documents', resource_type: 'auto' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(file.buffer);
        });

        const doc = await TrackerCarDocument.create({
            batchId,
            membershipId: carId,
            customerId: batch.customerId,
            type,
            category,
            fileUrl: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            mimeType: file.mimetype,
            originalName: file.originalname,
            isCustomerVisible: isCustomerVisible === 'true' || isCustomerVisible === true,
            uploadedBy: req.user._id
        });

        await AuditLog.create({
            actor: req.user._id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'DOCUMENT_UPLOAD',
            target: doc._id,
            entityType: 'VehicleBatchMembership',
            entityId: carId,
            entityDisplay: membership.registrationNumber || membership.vin || membership.referenceNumber,
            description: `Uploaded ${type} (${category}): ${file.originalname}`,
            metadata: { category, originalName: file.originalname, isCustomerVisible: doc.isCustomerVisible }
        });

        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteTrackerCarDocument = async (req, res) => {
    try {
        const { batchId, carId, documentId } = req.params;

        const doc = await TrackerCarDocument.findOne({ _id: documentId, membershipId: carId, isActive: true });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        doc.isActive = false;
        await doc.save();

        const membership = await VehicleBatchMembership.findById(carId);

        await AuditLog.create({
            actor: req.user._id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'DOCUMENT_DELETED',
            target: doc._id,
            entityType: 'VehicleBatchMembership',
            entityId: carId,
            entityDisplay: membership ? (membership.registrationNumber || membership.vin || membership.referenceNumber) : 'Unknown',
            description: `Deleted ${doc.type} (${doc.category}): ${doc.originalName}`,
            metadata: { category: doc.category, originalName: doc.originalName }
        });

        res.status(200).json({ success: true, message: 'Document deleted' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getTrackerCarDocuments = async (req, res) => {
    try {
        const { batchId, carId } = req.params;
        const docs = await TrackerCarDocument.find({ membershipId: carId, batchId, isActive: true })
            .populate('uploadedBy', 'name')
            .sort('-createdAt');
        res.status(200).json({ success: true, data: docs });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================

export const bulkAddRegisteredVehiclesToBatch = async (req, res) => {
    let session;
    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const { id } = req.params;
        const { vehicleIds } = req.body;

        if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
            throw new Error('No vehicles selected.');
        }

        const batch = await VehicleBatch.findById(id).session(session);
        if (!batch || !batch.isActive) {
            throw new Error('Tracker not found or is inactive.');
        }
        
        if (batch.type !== 'IMPORT') {
            throw new Error('This action is only supported for Import entries.');
        }

        const vehicles = await Vehicle.find({ _id: { $in: vehicleIds }, isActive: true }).session(session);
        
        if (vehicles.length !== vehicleIds.length) {
            throw new Error('One or more selected vehicles are invalid or inactive.');
        }

        for (const vehicle of vehicles) {
            if (vehicle.customerId.toString() !== batch.customerId.toString()) {
                throw new Error(`Vehicle ${vehicle.vin || vehicle.registrationNumber} does not belong to this tracker's company.`);
            }
        }

        const existingMemberships = await VehicleBatchMembership.find({
            batchId: batch._id,
            vehicleId: { $in: vehicleIds },
            isActive: true
        }).session(session);

        if (existingMemberships.length > 0) {
            throw new Error('One or more vehicles are already in this active entry.');
        }

        // Generate reference numbers
        const highestMembershipGlobally = await VehicleBatchMembership.findOne({ referenceNumber: { $regex: `^${batch.batchNumber}-` } })
            .sort({ referenceNumber: -1 })
            .session(session);
            
        let highestSeq = 0;
        if (highestMembershipGlobally && highestMembershipGlobally.referenceNumber) {
            const parts = highestMembershipGlobally.referenceNumber.split('-');
            const lastPart = parts[parts.length - 1];
            if (!isNaN(lastPart)) {
                highestSeq = parseInt(lastPart, 10);
            }
        }
        
        if (!batch.carSequenceCounter || batch.carSequenceCounter < highestSeq) {
            await VehicleBatch.findByIdAndUpdate(batch._id, { carSequenceCounter: highestSeq }, { session });
        }

        const quantity = vehicleIds.length;
        const updatedBatch = await VehicleBatch.findByIdAndUpdate(
            batch._id,
            { $inc: { carSequenceCounter: quantity } },
            { new: true, session }
        );
        
        let startSeq = updatedBatch.carSequenceCounter - quantity + 1;

        const membershipsToInsert = vehicles.map((vehicle, i) => {
            const seq = (startSeq + i).toString().padStart(3, '0');
            return {
                batchId: batch._id,
                referenceNumber: `${batch.batchNumber}-${seq}`,
                vehicleId: vehicle._id,
                make: vehicle.brand,
                model: vehicle.model,
                year: vehicle.year,
                vin: vehicle.vin,
                registrationNumber: vehicle.registrationNumber,
                status: 'Received',
                receivedAt: new Date(),
                receivedBy: req.user._id,
                statusHistory: [{
                    status: 'Received',
                    timestamp: new Date(),
                    user: req.user._id,
                    notes: 'Added from Registered Vehicles'
                }],
                isActive: true
            };
        });

        const insertedMemberships = await VehicleBatchMembership.insertMany(membershipsToInsert, { session });

        const auditLogs = insertedMemberships.map(mem => ({
            actor: req.user._id,
            actorName: req.user.name,
            actorRole: req.user.role,
            action: 'STATUS_CHANGE',
            target: mem._id,
            entityType: 'VehicleBatchMembership',
            entityId: mem._id,
            entityDisplay: mem.vin || mem.registrationNumber || mem.referenceNumber,
            description: 'Status changed from undefined to Received',
            metadata: { previousStatus: null, newStatus: 'Received' }
        }));
        
        await AuditLog.insertMany(auditLogs, { session });
        
        await recalculateBatchStatus(batch._id, session);

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({ success: true, data: insertedMemberships });
    } catch (error) {
        if (session) {
            await session.abortTransaction();
            session.endSession();
        }
        console.error("Error bulk adding registered vehicles:", error);
        res.status(400).json({ success: false, error: error.message || "Server Error" });
    }
};
