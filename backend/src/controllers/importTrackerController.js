import ImportTracker from '../models/ImportTracker.js';
import Vehicle from '../models/Vehicle.js';
import Customer from '../models/Customer.js';
import AuditLog from '../models/AuditLog.js';

// @desc    Get all import trackers
// @route   GET /api/imports
// @access  Private (Admin/SuperAdmin)
export const getImports = async (req, res) => {
    try {
        const { status, customerId, search, page = 1, limit = 50 } = req.query;
        
        const filter = { isActive: true };
        
        if (status && status !== 'All Statuses') {
            filter.status = status;
        }
        
        if (customerId) {
            filter.customerId = customerId;
        }

        // If search is provided, we need to find matching customers and vehicles first
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            
            const matchingCustomers = await Customer.find({
                isActive: true,
                customerType: 'import_company',
                name: searchRegex
            }).select('_id');
            const customerIds = matchingCustomers.map(c => c._id);
            
            const matchingVehicles = await Vehicle.find({
                isActive: true,
                $or: [
                    { brand: searchRegex },
                    { model: searchRegex },
                    { registrationNumber: searchRegex }
                ]
            }).select('_id');
            const vehicleIds = matchingVehicles.map(v => v._id);
            
            filter.$or = [
                { customerId: { $in: customerIds } },
                { vehicleId: { $in: vehicleIds } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await ImportTracker.countDocuments(filter);

        const imports = await ImportTracker.find(filter)
            .populate('vehicleId', 'brand model year registrationNumber status customerId')
            .populate('customerId', 'name email phone customerType')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Calculate metrics globally for active imports
        const allImports = await ImportTracker.find({ isActive: true }).select('status');
        const metrics = {
            needPrep: allImports.filter(i => i.status === 'NEED PREP').length,
            inTransit: allImports.filter(i => i.status === 'IN TRANSIT').length,
            compliance: allImports.filter(i => i.status === 'COMPLIANCE').length,
            ready: allImports.filter(i => i.status === 'READY').length
        };

        res.status(200).json({
            success: true,
            data: imports,
            metrics,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching import trackers:", error);
        res.status(500).json({ success: false, error: "Server Error fetching imports" });
    }
};

// @desc    Get single import tracker
// @route   GET /api/imports/:id
// @access  Private (Admin/SuperAdmin)
export const getImportById = async (req, res) => {
    try {
        const importTracker = await ImportTracker.findById(req.params.id)
            .populate('vehicleId', 'brand model year registrationNumber status customerId')
            .populate('customerId', 'name email phone customerType');
            
        if (!importTracker) {
            return res.status(404).json({ success: false, error: 'Import not found' });
        }
        
        res.status(200).json({ success: true, data: importTracker });
    } catch (error) {
        console.error("Error fetching import tracker:", error);
        res.status(500).json({ success: false, error: "Server Error fetching import" });
    }
}

// @desc    Create a new import tracker
// @route   POST /api/imports
// @access  Private (Admin/SuperAdmin)
export const createImport = async (req, res) => {
    try {
        const { vehicleId, status, customerId, notes } = req.body;

        if (!vehicleId) {
            return res.status(400).json({ success: false, error: 'Vehicle is required' });
        }

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle || !vehicle.isActive) {
            return res.status(404).json({ success: false, error: 'Vehicle not found or inactive' });
        }

        // Validate Customer if provided (Stock Imports might have null customer)
        if (customerId) {
            const customer = await Customer.findById(customerId);
            if (!customer || !customer.isActive) {
                return res.status(404).json({ success: false, error: 'Customer not found or inactive' });
            }
            if (customer.customerType !== 'import_company') {
                return res.status(400).json({ success: false, error: 'Customer must be an Import Company' });
            }
            
            // Validate Vehicle belongs to Customer
            if (!vehicle.customerId || vehicle.customerId.toString() !== customerId) {
                return res.status(400).json({ success: false, error: 'Vehicle does not belong to the selected Import Company' });
            }
        }

        const newImport = await ImportTracker.create({
            vehicleId,
            status: status || 'NEED PREP',
            customerId: customerId || null,
            notes
        });

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'CREATE_IMPORT',
            target: newImport._id.toString(),
            metadata: { vehicle: `${vehicle.brand} ${vehicle.model}`, status: newImport.status },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            data: newImport
        });
    } catch (error) {
        console.error("Error creating import:", error);
        res.status(500).json({ success: false, error: "Server Error creating import" });
    }
};

// @desc    Update an import tracker
// @route   PUT /api/imports/:id
// @access  Private (Admin/SuperAdmin)
export const updateImport = async (req, res) => {
    try {
        const importTracker = await ImportTracker.findById(req.params.id);

        if (!importTracker) {
            return res.status(404).json({ success: false, error: 'Import not found' });
        }

        const { vehicleId, customerId } = req.body;
        
        // Use the new values if provided, otherwise fallback to existing
        const newVehicleId = vehicleId !== undefined ? vehicleId : importTracker.vehicleId;
        const newCustomerId = customerId !== undefined ? customerId : importTracker.customerId;
        
        const vehicle = await Vehicle.findById(newVehicleId);
        if (!vehicle || !vehicle.isActive) {
            return res.status(404).json({ success: false, error: 'Vehicle not found or inactive' });
        }
        
        if (newCustomerId) {
            const customer = await Customer.findById(newCustomerId);
            if (!customer || !customer.isActive) {
                return res.status(404).json({ success: false, error: 'Customer not found or inactive' });
            }
            if (customer.customerType !== 'import_company') {
                return res.status(400).json({ success: false, error: 'Customer must be an Import Company' });
            }
            
            // Validate Vehicle belongs to Customer
            if (!vehicle.customerId || vehicle.customerId.toString() !== newCustomerId.toString()) {
                return res.status(400).json({ success: false, error: 'Vehicle does not belong to the selected Import Company' });
            }
        }

        const updatedImport = await ImportTracker.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'UPDATE_IMPORT',
            target: importTracker._id.toString(),
            metadata: { status: updatedImport.status },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: updatedImport
        });
    } catch (error) {
        console.error("Error updating import:", error);
        res.status(500).json({ success: false, error: "Server Error updating import" });
    }
};

// @desc    Delete (soft delete) an import tracker
// @route   DELETE /api/imports/:id
// @access  Private (Admin/SuperAdmin)
export const deleteImport = async (req, res) => {
    try {
        const importTracker = await ImportTracker.findById(req.params.id);

        if (!importTracker) {
            return res.status(404).json({ success: false, error: 'Import not found' });
        }

        importTracker.isActive = false;
        await importTracker.save();

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'DELETE_IMPORT',
            target: importTracker._id.toString(),
            metadata: { },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error("Error deleting import:", error);
        res.status(500).json({ success: false, error: "Server Error deleting import" });
    }
};

// @desc    Update only the status of an import tracker
// @route   PATCH /api/import-trackers/:id/status
// @access  Private (Admin/SuperAdmin)
export const updateImportStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['NEED PREP', 'IN TRANSIT', 'COMPLIANCE', 'READY'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }

        const importTracker = await ImportTracker.findOne({ _id: req.params.id, isActive: true });
        if (!importTracker) {
            return res.status(404).json({ success: false, error: 'Import Tracker not found' });
        }

        importTracker.status = status;
        await importTracker.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'UPDATE_IMPORT_STATUS',
            target: importTracker._id.toString(),
            metadata: { newStatus: status },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: importTracker });
    } catch (error) {
        console.error("Error updating import status:", error);
        res.status(500).json({ success: false, error: "Server Error updating import status" });
    }
};
