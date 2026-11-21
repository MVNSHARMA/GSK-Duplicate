import RentalServiceEntry from '../models/RentalServiceEntry.js';
import RentalServiceEntryVehicle from '../models/RentalServiceEntryVehicle.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { withTransaction } from '../utils/transaction.js';
import { escapeRegex } from '../utils/sanitize.js';

// ──────────────────────────────────────────────────────────
// SHARED HELPERS
// ──────────────────────────────────────────────────────────

/**
 * Status ordinal used for deterministic overall-status aggregation.
 * Rule: overall status = LOWEST ordinal among all active vehicles.
 * Entry is only "Collected" when ALL active vehicles are "Collected".
 */
const STATUS_ORDER = ['Received', 'In Service', 'Stuck', 'Completed'];

export function computeOverallStatus(vehicleStatuses) {
    if (!vehicleStatuses || vehicleStatuses.length === 0) return null;
    let minIndex = STATUS_ORDER.length;
    for (const s of vehicleStatuses) {
        const idx = STATUS_ORDER.indexOf(s);
        if (idx >= 0 && idx < minIndex) minIndex = idx;
    }
    return minIndex < STATUS_ORDER.length ? STATUS_ORDER[minIndex] : null;
}

/**
 * Enriches an array of raw service entry docs with their vehicles, vehicleCount, and overallStatus.
 */
async function enrichEntries(entries) {
    if (entries.length === 0) return [];

    const entryIds = entries.map(e => e._id);

    // Fetch all active entry-vehicles in one query
    const allVehicles = await RentalServiceEntryVehicle.find({
        serviceEntryId: { $in: entryIds },
        isActive: true
    })
        .populate('vehicleId', 'registrationNumber brand model year vin')
        .populate('jobCardId', 'status totalAmount')
        .sort({ createdAt: 1 });

    // Group by serviceEntryId
    const vehicleMap = {};
    for (const v of allVehicles) {
        const key = v.serviceEntryId.toString();
        if (!vehicleMap[key]) vehicleMap[key] = [];
        vehicleMap[key].push(v);
    }

    return entries.map(entry => {
        const entryObj = entry.toObject ? entry.toObject() : { ...entry };
        const vehicles = vehicleMap[entryObj._id.toString()] || [];
        entryObj.vehicles = vehicles;
        entryObj.vehicleCount = vehicles.length;
        entryObj.overallStatus = computeOverallStatus(vehicles.map(v => v.status));
        return entryObj;
    });
}

// ──────────────────────────────────────────────────────────
// GET /api/rental-entries
// List service entries with optional filters
// ──────────────────────────────────────────────────────────
export const getServiceEntries = async (req, res) => {
    try {
        const { customerId, fromDate, toDate, status, page = 1, limit = 50 } = req.query;
        const filter = { isActive: true };

        if (customerId) filter.customerId = customerId;

        // Status Filtering
        if (status === 'active' || status === 'completed') {
            // Find all service entry IDs that have at least one active child vehicle that is NOT completed
            const incompleteEntryIds = await RentalServiceEntryVehicle.distinct('serviceEntryId', {
                isActive: true,
                status: { $ne: 'Completed' }
            });

            if (status === 'active') {
                filter._id = { $in: incompleteEntryIds };
            } else if (status === 'completed') {
                // Must have active vehicles, but none of them are incomplete
                const allEntryIdsWithVehicles = await RentalServiceEntryVehicle.distinct('serviceEntryId', {
                    isActive: true
                });
                
                const completedEntryIds = allEntryIdsWithVehicles.filter(id => 
                    !incompleteEntryIds.some(incId => incId.toString() === id.toString())
                );
                
                filter._id = { $in: completedEntryIds };
            }
        }

        // Date filtering on createdAt
        if (fromDate || toDate) {
            filter.createdAt = {};
            if (fromDate) filter.createdAt.$gte = new Date(fromDate);
            if (toDate) {
                // End of day for toDate
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = endDate;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const entries = await RentalServiceEntry.find(filter)
            .populate('customerId', 'name phone email address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalEntries = await RentalServiceEntry.countDocuments(filter);

        const enriched = await enrichEntries(entries);

        res.status(200).json({
            success: true,
            data: enriched,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalEntries,
                totalPages: Math.ceil(totalEntries / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching service entries:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ──────────────────────────────────────────────────────────
// GET /api/rental-entries/:id
// Get single entry with populated vehicles
// ──────────────────────────────────────────────────────────
export const getServiceEntry = async (req, res) => {
    try {
        const entry = await RentalServiceEntry.findById(req.params.id)
            .populate('customerId', 'name phone email address');

        if (!entry || !entry.isActive) {
            return res.status(404).json({ success: false, error: 'Service entry not found' });
        }

        const [enriched] = await enrichEntries([entry]);
        res.status(200).json({ success: true, data: enriched });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ──────────────────────────────────────────────────────────
// POST /api/rental-entries
// Create ONE entry with MULTIPLE vehicles
// Body: { customerId, vehicleIds: [...], notes }
// ──────────────────────────────────────────────────────────
export const createServiceEntry = async (req, res) => {
    try {
        const { customerId, vehicleIds, notes } = req.body;

        // --- Validations ---
        if (!customerId) {
            return res.status(400).json({ success: false, error: 'Customer is required' });
        }

        const hasVehicles = vehicleIds && Array.isArray(vehicleIds) && vehicleIds.length > 0;
        let uniqueVehicleIds = [];

        if (hasVehicles) {
            uniqueVehicleIds = [...new Set(vehicleIds)];
            if (uniqueVehicleIds.length !== vehicleIds.length) {
                return res.status(400).json({ success: false, error: 'Duplicate vehicle IDs are not allowed' });
            }
        }

        // Customer must be rental_company
        const customer = await Customer.findById(customerId);
        if (!customer || !customer.isActive) {
            return res.status(400).json({ success: false, error: 'Customer not found' });
        }
        if (customer.customerType !== 'rental_company') {
            return res.status(400).json({ success: false, error: 'Customer must be a rental company' });
        }

        if (hasVehicles) {
            const vehicles = await Vehicle.find({
                _id: { $in: uniqueVehicleIds },
                isActive: true
            });
            if (vehicles.length !== uniqueVehicleIds.length) {
                return res.status(400).json({ success: false, error: 'One or more vehicles not found or inactive' });
            }
            for (const v of vehicles) {
                if (!v.customerId || v.customerId.toString() !== customerId) {
                    return res.status(400).json({
                        success: false,
                        error: `Vehicle ${v.registrationNumber || v._id} does not belong to this rental company`
                    });
                }
            }
        }

        // --- Create atomically ---
        const result = await withTransaction(async (session) => {
            const now = new Date();

            // Create parent
            const [serviceEntry] = await RentalServiceEntry.create([{
                customerId,
                notes: notes || ''
            }], { session, ordered: true });

            if (hasVehicles) {
                const childDocs = uniqueVehicleIds.map(vid => ({
                    serviceEntryId: serviceEntry._id,
                    vehicleId: vid,
                    status: 'Received',
                    statusUpdatedAt: now,
                    statusHistory: [{
                        status: 'Received',
                        timestamp: now,
                        updatedBy: req.user?._id
                    }]
                }));
                await RentalServiceEntryVehicle.create(childDocs, { session, ordered: true });
            }

            // Audit
            if (req.user) {
                await AuditLog.create([{
                    actor: req.user._id,
                    action: 'CREATE_RENTAL_SERVICE_ENTRY',
                    target: serviceEntry._id.toString(),
                    entityType: 'RentalServiceEntry',
                    entityId: serviceEntry._id.toString(),
                    description: `Created Rental Service Entry for ${customer.name}${hasVehicles ? ` with ${uniqueVehicleIds.length} vehicle(s)` : ' (Empty)'}`,
                    ipAddress: req.ip
                }], { session, ordered: true });
            }

            return serviceEntry;
        });

        // Fetch enriched entry for response
        const created = await RentalServiceEntry.findById(result._id)
            .populate('customerId', 'name phone email address');
        const [enriched] = await enrichEntries([created]);

        res.status(201).json({ success: true, data: enriched });
    } catch (error) {
        console.error('Error creating service entry:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ──────────────────────────────────────────────────────────
// GET /api/rental-entries/:id/vehicles
// Paginated, searchable list of vehicles for a specific entry
// ──────────────────────────────────────────────────────────
export const getServiceEntryVehicles = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status = 'All' } = req.query;
        const entry = await RentalServiceEntry.findById(req.params.id);
        if (!entry || !entry.isActive) {
            return res.status(404).json({ success: false, error: 'Service entry not found' });
        }

        const vehicleQuery = {
            serviceEntryId: entry._id,
            isActive: true
        };
        
        if (status && status !== 'All') {
            vehicleQuery.status = status;
        }

        if (search) {
            const regex = new RegExp(escapeRegex(search.trim()), 'i');
            const matchingVehicles = await Vehicle.find({
                $or: [
                    { registrationNumber: regex },
                    { vin: regex },
                    { brand: regex },
                    { model: regex }
                ]
            }).select('_id');
            const validVehicleIds = matchingVehicles.map(v => v._id);
            vehicleQuery.vehicleId = { $in: validVehicleIds };
        }

        const total = await RentalServiceEntryVehicle.countDocuments(vehicleQuery);
        const vehicles = await RentalServiceEntryVehicle.find(vehicleQuery)
            .populate('vehicleId', 'registrationNumber brand model year vin')
            .populate('statusHistory.updatedBy', 'name email role')
            .sort({ createdAt: 1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: vehicles,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching service entry vehicles:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ──────────────────────────────────────────────────────────
// POST /api/rental-entries/:id/vehicles
// Add existing vehicles to an active rental entry
// ──────────────────────────────────────────────────────────
export const addVehiclesToEntry = async (req, res) => {
    try {
        const { vehicleIds } = req.body;
        if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one vehicle is required' });
        }

        const entry = await RentalServiceEntry.findById(req.params.id).populate('customerId');
        if (!entry || !entry.isActive) {
            return res.status(404).json({ success: false, error: 'Service entry not found' });
        }

        const uniqueVehicleIds = [...new Set(vehicleIds)];
        const customerId = entry.customerId._id.toString();

        const vehicles = await Vehicle.find({ _id: { $in: uniqueVehicleIds }, isActive: true });
        if (vehicles.length !== uniqueVehicleIds.length) {
            return res.status(400).json({ success: false, error: 'One or more vehicles not found or inactive' });
        }

        for (const v of vehicles) {
            if (!v.customerId || v.customerId.toString() !== customerId) {
                return res.status(400).json({ success: false, error: `Vehicle ${v.registrationNumber || v.vin} does not belong to this rental company` });
            }
        }

        // Check for existing vehicles
        const existing = await RentalServiceEntryVehicle.find({
            serviceEntryId: entry._id,
            vehicleId: { $in: uniqueVehicleIds },
            isActive: true
        });
        const existingIds = existing.map(e => e.vehicleId.toString());
        const newVehicleIds = uniqueVehicleIds.filter(id => !existingIds.includes(id));

        if (newVehicleIds.length === 0) {
            return res.status(400).json({ success: false, error: 'All selected vehicles are already in this entry' });
        }

        const result = await withTransaction(async (session) => {
            const now = new Date();
            const childDocs = newVehicleIds.map(vid => ({
                serviceEntryId: entry._id,
                vehicleId: vid,
                status: 'Received',
                statusUpdatedAt: now,
                statusHistory: [{ status: 'Received', timestamp: now, updatedBy: req.user?._id }]
            }));

            const createdVehicles = await RentalServiceEntryVehicle.create(childDocs, { session, ordered: true });
            
            if (req.user) {
                await AuditLog.create([{
                    actor: req.user._id,
                    action: 'UPDATE_RENTAL_SERVICE_ENTRY',
                    target: entry._id.toString(),
                    entityType: 'RentalServiceEntry',
                    entityId: entry._id.toString(),
                    description: `Added ${newVehicleIds.length} vehicle(s) to Rental Service Entry`,
                    ipAddress: req.ip
                }], { session, ordered: true });
            }
            return { entry, createdVehicles };
        });

        const [enriched] = await enrichEntries([result.entry]);
        
        // Populate the newly created vehicles
        for (let ev of result.createdVehicles) {
            await ev.populate([
                { path: 'vehicleId', select: 'registrationNumber brand model year vin' },
                { path: 'statusHistory.updatedBy', select: 'name email role' }
            ]);
        }
        
        res.status(200).json({ success: true, data: enriched, newVehicles: result.createdVehicles });
    } catch (error) {
        console.error('Error adding vehicles to entry:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ──────────────────────────────────────────────────────────
// DELETE /api/rental-entries/:id
// Soft-delete entry and all child vehicles
// ──────────────────────────────────────────────────────────
export const deleteServiceEntry = async (req, res) => {
    try {
        const entry = await RentalServiceEntry.findById(req.params.id);
        if (!entry || !entry.isActive) {
            return res.status(404).json({ success: false, error: 'Service entry not found' });
        }

        await withTransaction(async (session) => {
            entry.isActive = false;
            await entry.save({ session });

            // Soft-delete all child vehicles
            await RentalServiceEntryVehicle.updateMany(
                { serviceEntryId: entry._id, isActive: true },
                { isActive: false },
                { session }
            );

            if (req.user) {
                await AuditLog.create([{
                    actor: req.user._id,
                    action: 'DELETE_RENTAL_SERVICE_ENTRY',
                    target: entry._id.toString(),
                    entityType: 'RentalServiceEntry',
                    entityId: entry._id.toString(),
                    description: 'Soft deleted Rental Service Entry',
                    ipAddress: req.ip
                }], { session });
            }
        });

        res.status(200).json({ success: true, message: 'Service entry deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ──────────────────────────────────────────────────────────
// PUT /api/rental-entries/:id/vehicles/:vehicleId/status
// Update a single vehicle's status within an entry
// ──────────────────────────────────────────────────────────
export const updateVehicleStatus = async (req, res) => {
    try {
        const { id: entryId, vehicleId } = req.params;
        const { status, odometer } = req.body;

        if (!STATUS_ORDER.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        let parsedOdometer = null;
        if (status === 'Completed' && odometer !== undefined && odometer !== null && odometer !== '') {
            parsedOdometer = Number(odometer);
            if (isNaN(parsedOdometer) || parsedOdometer < 0) {
                return res.status(400).json({ success: false, error: 'Invalid odometer reading' });
            }
        }

        const entry = await RentalServiceEntry.findById(entryId).populate('customerId', 'name');
        if (!entry || !entry.isActive) {
            return res.status(404).json({ success: false, error: 'Service entry not found' });
        }

        let oldStatus;
        let entryVehicle;
        
        await withTransaction(async (session) => {
            entryVehicle = await RentalServiceEntryVehicle.findOne({
                serviceEntryId: entryId,
                vehicleId: vehicleId,
                isActive: true
            }).populate('vehicleId', 'registrationNumber brand model').session(session);

            if (!entryVehicle) {
                throw new Error('Vehicle not found in this service entry');
            }

            if (entryVehicle.status === status) {
                return; // handled after transaction
            }

            oldStatus = entryVehicle.status;
            const now = new Date();

            entryVehicle.status = status;
            entryVehicle.statusUpdatedAt = now;
            entryVehicle.statusHistory.push({
                status,
                timestamp: now,
                updatedBy: req.user?._id
            });

            if (status === 'Completed' && parsedOdometer !== null) {
                entryVehicle.completionOdometer = parsedOdometer;
                
                // Update canonical Vehicle
                const canonicalVehicle = await Vehicle.findById(vehicleId).session(session);
                if (canonicalVehicle) {
                    canonicalVehicle.mileage = parsedOdometer;
                    await canonicalVehicle.save({ session });
                }
            }

            await entryVehicle.save({ session });

            if (req.user) {
                await AuditLog.create([{
                    actor: req.user._id,
                    action: 'UPDATE_RENTAL_VEHICLE_STATUS',
                    target: entryVehicle._id.toString(),
                    entityType: 'RentalServiceEntryVehicle',
                    entityId: entryVehicle._id.toString(),
                    description: `Updated vehicle status from ${oldStatus} to ${status}`,
                    ipAddress: req.ip
                }], { session });
            }
        });

        if (!oldStatus) {
            // Status was unchanged
            return res.status(200).json({ success: true, data: entryVehicle, message: 'Status unchanged' });
        }
        
        // Notifications
        if (status === 'Completed' || status === 'Stuck') {
            try {
                const customerName = entry.customerId?.name || 'Unknown Company';
                const v = entryVehicle.vehicleId;
                const makeModel = `${v?.brand || ''} ${v?.model || ''}`.trim();
                const rego = v?.registrationNumber || 'Unknown Rego';
                
                await Notification.create({
                    type: 'rental_update',
                    title: `Rental Vehicle ${status}`,
                    message: `${customerName} vehicle ${rego} (${makeModel}) has been marked ${status}.`,
                    relatedModel: 'RentalServiceEntry',
                    relatedId: entry._id
                });
            } catch (notifErr) {
                console.error('Failed to create notification:', notifErr);
            }
        }

        await entryVehicle.populate([
            { path: 'vehicleId', select: 'registrationNumber brand model year vin' },
            { path: 'statusHistory.updatedBy', select: 'name email role' }
        ]);
        
        // Refetch entry to return enriched data
        const entryToReturn = await RentalServiceEntry.findById(entryId)
            .populate('customerId', 'name phone email address');
        const [enriched] = await enrichEntries([entryToReturn]);

        res.status(200).json({ success: true, data: entryVehicle, parentEntry: enriched });
    } catch (error) {
        if (error.message === 'Vehicle not found in this service entry') {
            return res.status(404).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

// ──────────────────────────────────────────────────────────
// DELETE /api/rental-entries/:id/vehicles/:vehicleId
// Remove a vehicle from a service entry (NOT delete the Vehicle)
// ──────────────────────────────────────────────────────────
export const removeVehicleFromEntry = async (req, res) => {
    try {
        const { id: entryId, vehicleId } = req.params;

        const entry = await RentalServiceEntry.findById(entryId);
        if (!entry || !entry.isActive) {
            return res.status(404).json({ success: false, error: 'Service entry not found' });
        }

        const entryVehicle = await RentalServiceEntryVehicle.findOne({
            serviceEntryId: entryId,
            vehicleId: vehicleId,
            isActive: true
        });
        if (!entryVehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found in this service entry' });
        }

        // Soft-delete the relationship only (NOT the canonical Vehicle)
        entryVehicle.isActive = false;
        await entryVehicle.save();

        // Check if the parent entry now has zero active vehicles → soft-delete parent too
        const remainingCount = await RentalServiceEntryVehicle.countDocuments({
            serviceEntryId: entryId,
            isActive: true
        });
        if (remainingCount === 0) {
            entry.isActive = false;
            await entry.save();
        }

        if (req.user) {
            await AuditLog.create({
                actor: req.user._id,
                action: 'REMOVE_VEHICLE_FROM_RENTAL_ENTRY',
                target: entryVehicle._id.toString(),
                entityType: 'RentalServiceEntryVehicle',
                entityId: entryVehicle._id.toString(),
                description: `Removed vehicle from Rental Service Entry (entry auto-deleted: ${remainingCount === 0})`,
                ipAddress: req.ip
            });
        }

        res.status(200).json({
            success: true,
            message: 'Vehicle removed from entry',
            entryDeleted: remainingCount === 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ──────────────────────────────────────────────────────────
// PUT /api/rental-entries/:id/vehicles/bulk-status
// Update status of multiple vehicles in a service entry
// Body: { vehicleIds: ["id1", "id2"], status: "In Service" }
// ──────────────────────────────────────────────────────────
export const bulkUpdateVehicleStatus = async (req, res) => {
    try {
        const { id: entryId } = req.params;
        const { vehicleIds, status, odometers } = req.body;

        if (!STATUS_ORDER.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        if (!Array.isArray(vehicleIds) || vehicleIds.length === 0) {
            return res.status(400).json({ success: false, error: 'vehicleIds array is required' });
        }

        // Validate odometers if provided
        const parsedOdometers = {};
        if (status === 'Completed' && odometers) {
            for (const vid of vehicleIds) {
                const odo = odometers[vid];
                if (odo !== undefined && odo !== null && odo !== '') {
                    const parsed = Number(odo);
                    if (isNaN(parsed) || parsed < 0) {
                        return res.status(400).json({ success: false, error: `Invalid odometer reading for vehicle ${vid}` });
                    }
                    parsedOdometers[vid] = parsed;
                }
            }
        }

        const entry = await RentalServiceEntry.findById(entryId).populate('customerId', 'name');
        if (!entry || !entry.isActive) {
            return res.status(404).json({ success: false, error: 'Service entry not found or inactive' });
        }

        const updatedVehicles = await withTransaction(async (session) => {
            const entryVehicles = await RentalServiceEntryVehicle.find({
                serviceEntryId: entryId,
                vehicleId: { $in: vehicleIds },
                isActive: true
            }).populate('vehicleId', 'registrationNumber brand model').session(session);

            if (entryVehicles.length !== vehicleIds.length) {
                throw new Error('One or more vehicles not found or inactive in this service entry');
            }

            const now = new Date();
            const updated = [];
            const auditLogs = [];

            for (const ev of entryVehicles) {
                if (ev.status !== status) {
                    const oldStatus = ev.status;
                    ev.status = status;
                    ev.statusUpdatedAt = now;
                    ev.statusHistory.push({
                        status,
                        timestamp: now,
                        updatedBy: req.user?._id
                    });

                    if (status === 'Completed' && parsedOdometers[ev.vehicleId._id.toString()] !== undefined) {
                        const newOdo = parsedOdometers[ev.vehicleId._id.toString()];
                        ev.completionOdometer = newOdo;
                        
                        const canonicalVehicle = await Vehicle.findById(ev.vehicleId._id).session(session);
                        if (canonicalVehicle) {
                            canonicalVehicle.mileage = newOdo;
                            await canonicalVehicle.save({ session });
                        }
                    }

                    await ev.save({ session });
                    updated.push(ev);

                    if (req.user) {
                        auditLogs.push({
                            actor: req.user._id,
                            action: 'UPDATE_RENTAL_VEHICLE_STATUS_BULK',
                            target: ev._id.toString(),
                            entityType: 'RentalServiceEntryVehicle',
                            entityId: ev._id.toString(),
                            description: `Bulk updated vehicle status from ${oldStatus} to ${status}`,
                            ipAddress: req.ip
                        });
                    }
                }
            }

            if (auditLogs.length > 0) {
                await AuditLog.insertMany(auditLogs, { session });
            }

            return updated;
        });

        // Notifications
        if (status === 'Completed' || status === 'Stuck') {
            for (const ev of updatedVehicles) {
                try {
                    const customerName = entry.customerId?.name || 'Unknown Company';
                    const v = ev.vehicleId;
                    const makeModel = `${v?.brand || ''} ${v?.model || ''}`.trim();
                    const rego = v?.registrationNumber || 'Unknown Rego';
                    
                    await Notification.create({
                        type: 'rental_update',
                        title: `Rental Vehicle ${status}`,
                        message: `${customerName} vehicle ${rego} (${makeModel}) has been marked ${status}.`,
                        relatedModel: 'RentalServiceEntry',
                        relatedId: entry._id
                    });
                } catch (notifErr) {
                    console.error('Failed to create notification:', notifErr);
                }
            }
        }

        // Refetch entry to return enriched data
        const entryToReturn = await RentalServiceEntry.findById(entryId)
            .populate('customerId', 'name phone email address');
        const [enriched] = await enrichEntries([entryToReturn]);

        for (let ev of updatedVehicles) {
            await ev.populate([
                { path: 'vehicleId', select: 'registrationNumber brand model year vin' },
                { path: 'statusHistory.updatedBy', select: 'name email role' }
            ]);
        }

        res.status(200).json({ success: true, data: enriched, updatedVehicles, updatedCount: updatedVehicles.length });
    } catch (error) {
        console.error('Error in bulk status update:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
