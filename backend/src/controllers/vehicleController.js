import Vehicle from '../models/Vehicle.js';
import Customer from '../models/Customer.js';
import AuditLog from '../models/AuditLog.js';
import VehicleDocument from '../models/VehicleDocument.js';
import getCloudinary from '../config/cloudinary.js';
import { getUnifiedHistory } from '../services/historyService.js';
import { escapeRegex } from '../utils/sanitize.js';

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Private (Admin/SuperAdmin)
export const getVehicles = async (req, res) => {
    try {
        const { search, brand, customerId, customerType, page = 1, limit = 50 } = req.query;
        let query = { isActive: true };

        if (customerType && !customerId) {
            const matchingCustomers = await Customer.find({ customerType, isActive: true }).select('_id');
            query.customerId = { $in: matchingCustomers.map(c => c._id) };
        }

        if (customerId) {
            query.customerId = customerId === 'unassigned' ? null : customerId;
        }

        if (brand) query.brand = brand;

        if (search) {
            const safeSearch = escapeRegex(search);
            const matchingCustomers = await Customer.find({
                isActive: true,
                $or: [
                    { email: { $regex: safeSearch, $options: 'i' } },
                    { name: { $regex: safeSearch, $options: 'i' } }
                ]
            }).select('_id');
            const customerIds = matchingCustomers.map(c => c._id);

            query.$or = [
                { registrationNumber: { $regex: safeSearch, $options: 'i' } },
                { brand: { $regex: safeSearch, $options: 'i' } },
                { model: { $regex: safeSearch, $options: 'i' } },
                { vin: { $regex: safeSearch, $options: 'i' } }
            ];

            if (customerIds.length > 0) {
                query.$or.push({ customerId: { $in: customerIds } });
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const isDefaultActiveQuery = Object.keys(query).length === 1 && query.isActive === true;

        const [vehicles, totalVehicles, activeVehiclesOverride] = await Promise.all([
            Vehicle.find(query)
                .populate('customerId', 'name email phone customerType')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Vehicle.countDocuments(query),
            isDefaultActiveQuery ? Promise.resolve(null) : Vehicle.countDocuments({ isActive: true })
        ]);

        const totalVehiclesCount = isDefaultActiveQuery ? totalVehicles : activeVehiclesOverride;

        res.status(200).json({
            success: true,
            data: vehicles,
            page: parseInt(page),
            totalPages: Math.ceil(totalVehicles / parseInt(limit)),
            totalCount: totalVehicles,
            metrics: {
                totalVehicles: totalVehiclesCount
            }
        });
    } catch (error) {
        console.error("Error fetching vehicles:", error);
        res.status(500).json({ success: false, error: "Server Error fetching vehicles" });
    }
};

// @desc    Get single vehicle by ID
// @route   GET /api/vehicles/:id
// @access  Private
export const getVehicleById = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id)
            .populate('customerId', 'name email phone company')
            .lean();

        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        res.status(200).json({ success: true, data: vehicle });
    } catch (error) {
        console.error("Error fetching vehicle by id:", error);
        res.status(500).json({ success: false, error: "Server Error fetching vehicle" });
    }
};

// @desc    Create a new vehicle
// @route   POST /api/vehicles
// @access  Private (Admin/SuperAdmin)
export const createVehicle = async (req, res) => {
    try {
        const { brand, model, year, registrationNumber, vin, mileage, dailyRate, customerLink, customerId: reqCustomerId, status, notes, imageUrl: existingImageUrl, customerType } = req.body;

        if (!brand || !model || !year) {
            return res.status(400).json({ success: false, error: 'Brand, Model, and Year are required' });
        }

        let customerId = reqCustomerId || null;

        if (customerId) {
            const linkedCustomer = await Customer.findOne({ _id: customerId, isActive: true });
            if (!linkedCustomer) return res.status(400).json({ success: false, error: 'Active customer is required for vehicle ownership' });
            
            if (customerType === 'rental_company' && linkedCustomer.customerType !== 'rental_company') {
                return res.status(400).json({ success: false, error: 'Selected customer is not a rental company' });
            }

            if (linkedCustomer.customerType === 'rental_company' && !registrationNumber?.trim()) {
                return res.status(400).json({ success: false, error: 'Rego No is required for rental company vehicles' });
            }

            if (linkedCustomer.customerType === 'import_company' && !vin?.trim()) {
                return res.status(400).json({ success: false, error: 'VIN is required for Import Company vehicles' });
            }
        }

        // Try to link customer if customerLink (email or idNumber) is provided and customerId is not explicitly set
        if (!customerId && customerLink) {
            const customer = await Customer.findOne({ 
                $or: [{ email: customerLink }, { idNumber: customerLink }] 
            });
            
            if (customer) {
                customerId = customer._id;
            } else {
                return res.status(404).json({ success: false, error: 'Customer not found with provided Email/ID' });
            }
        }

        // Duplicate Check (Global uniqueness for active vehicles)
        const normalizedRegistration = registrationNumber?.trim().toUpperCase();
        const normalizedVin = vin?.trim().toUpperCase();
        if (normalizedRegistration) {
            const existingVehicle = await Vehicle.findOne({ 
                isActive: true, 
                registrationNumber: normalizedRegistration
            });
            
            if (existingVehicle) {
                return res.status(409).json({ success: false, error: 'A vehicle with this Rego No already exists.' });
            }
        }

        if (normalizedVin) {
            const existingVin = await Vehicle.findOne({ isActive: true, vin: normalizedVin });
            if (existingVin) return res.status(409).json({ success: false, error: 'A vehicle with this VIN already exists.' });
        }

        let imageUrl = existingImageUrl || '';
        if (req.file) {
            const cloudinary = getCloudinary();
            if (!cloudinary) {
                return res.status(500).json({ success: false, error: 'Cloudinary configuration is missing.' });
            }
            
            const uploadPromise = new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'gsk_vehicles' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            });
            const result = await uploadPromise;
            imageUrl = result.secure_url;
        }

        const newVehicle = await Vehicle.create({
            brand,
            model,
            year: Number(year),
            registrationNumber: normalizedRegistration,
            vin: normalizedVin,
            mileage: mileage ? Number(mileage) : undefined,
            dailyRate: dailyRate ? Number(dailyRate) : undefined,
            status,
            customerId,
            notes,
            imageUrl
        });

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'CREATE_VEHICLE',
            target: newVehicle._id.toString(),
            metadata: { vehicle: `${brand} ${model}` },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            data: newVehicle
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, error: 'Invalid ID format' });
        }
        console.error("Error creating vehicle:", error);
        res.status(500).json({ success: false, error: "Server Error creating vehicle" });
    }
};

// @desc    Update a vehicle
// @route   PUT /api/vehicles/:id
// @access  Private (Admin/SuperAdmin)
export const updateVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }
        
        const allowedFields = ['brand', 'model', 'year', 'registrationNumber', 'vin', 'mileage', 'dailyRate', 'customerId', 'status', 'notes', 'imageUrl'];
        let updateData = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));

        if (updateData.customerId !== undefined) {
            // Prevent silent reassignment if it already belongs to another customer
            if (vehicle.customerId && updateData.customerId && vehicle.customerId.toString() !== updateData.customerId.toString()) {
                return res.status(409).json({ success: false, error: 'This vehicle is already assigned to another customer. Please use the Reassign action.' });
            }
        }

        let linkedCustomer = null;
        if (updateData.customerId) {
            linkedCustomer = await Customer.findOne({ _id: updateData.customerId, isActive: true });
            if (!linkedCustomer) return res.status(400).json({ success: false, error: 'Active customer is required for vehicle ownership' });
        } else if (vehicle.customerId) {
            linkedCustomer = await Customer.findOne({ _id: vehicle.customerId, isActive: true });
        }

        if (linkedCustomer && linkedCustomer.customerType === 'import_company') {
            const finalVin = updateData.vin !== undefined ? updateData.vin : vehicle.vin;
            if (!finalVin || !finalVin.trim()) {
                return res.status(400).json({ success: false, error: 'VIN is required for Import Company vehicles' });
            }
        }

        if (updateData.registrationNumber !== undefined) {
            updateData.registrationNumber = updateData.registrationNumber.trim().toUpperCase();
        }
        if (updateData.vin !== undefined) updateData.vin = updateData.vin.trim().toUpperCase();
        
        // Duplicate Check for update
        if (updateData.registrationNumber && updateData.registrationNumber !== vehicle.registrationNumber) {
            const existingVehicle = await Vehicle.findOne({ 
                isActive: true, 
                registrationNumber: updateData.registrationNumber
            });
            
            if (existingVehicle && existingVehicle._id.toString() !== vehicle._id.toString()) {
                return res.status(409).json({ success: false, error: 'A vehicle with this Rego No already exists.' });
            }
        }

        if (updateData.vin && updateData.vin !== vehicle.vin) {
            const existingVin = await Vehicle.findOne({ isActive: true, vin: updateData.vin, _id: { $ne: vehicle._id } });
            if (existingVin) return res.status(409).json({ success: false, error: 'A vehicle with this VIN already exists.' });
        }

        if (req.file) {
            const cloudinary = getCloudinary();
            if (!cloudinary) {
                return res.status(500).json({ success: false, error: 'Cloudinary configuration is missing.' });
            }
            
            const uploadPromise = new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'gsk_vehicles' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                stream.end(req.file.buffer);
            });
            const result = await uploadPromise;
            updateData.imageUrl = result.secure_url;
        }

        const updatedVehicle = await Vehicle.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'UPDATE_VEHICLE',
            target: vehicle._id.toString(),
            metadata: { vehicle: `${updatedVehicle.brand} ${updatedVehicle.model}` },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: updatedVehicle
        });
    } catch (error) {
        console.error("Error updating vehicle:", error);
        res.status(500).json({ success: false, error: "Server Error updating vehicle" });
    }
};

// @desc    Delete (soft delete) a vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private (Admin/SuperAdmin)
export const deleteVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        vehicle.isActive = false;
        await vehicle.save();

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'DELETE_VEHICLE',
            target: vehicle._id.toString(),
            metadata: { vehicle: `${vehicle.brand} ${vehicle.model}` },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error("Error deleting vehicle:", error);
        res.status(500).json({ success: false, error: "Server Error deleting vehicle" });
    }
};

// @desc    Get complete service history for a vehicle
// @route   GET /api/vehicles/:id/history
// @access  Private (Admin/SuperAdmin)
export const getVehicleServiceHistory = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        
        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        const { typeFilter, page, limit } = req.query;

        const historyData = await getUnifiedHistory({
            query: { vehicleId: vehicle._id },
            typeFilter,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            userRole: req.user.role
        });

        res.status(200).json({
            success: true,
            data: historyData.events,
            metrics: historyData.metrics,
            pagination: historyData.pagination
        });
    } catch (error) {
        console.error("Error fetching vehicle service history:", error);
        res.status(500).json({ success: false, error: "Server Error fetching service history" });
    }
};

// @desc    Get vehicle documents
// @route   GET /api/vehicles/:id/documents
// @access  Private
export const getVehicleDocuments = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        const documents = await VehicleDocument.find({ vehicleId: vehicle._id, isActive: true })
            .populate('uploadedBy', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: documents });
    } catch (error) {
        console.error("Error fetching vehicle documents:", error);
        res.status(500).json({ success: false, error: "Server Error fetching vehicle documents" });
    }
};

// @desc    Add a vehicle document
// @route   POST /api/vehicles/:id/documents
// @access  Private
export const addVehicleDocument = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        const { documentType, documentName, documentDate, expiryDate, notes } = req.body;
        
        if (!documentType || !documentName) {
            return res.status(400).json({ success: false, error: 'Document type and name are required' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Document file is required' });
        }

        const cloudinary = getCloudinary();
        if (!cloudinary) {
            return res.status(500).json({ success: false, error: 'Cloudinary configuration is missing.' });
        }

        const stream = cloudinary.uploader.upload_stream(
            { folder: 'gsk-automotive/vehicle-documents', resource_type: 'auto' },
            async (error, result) => {
                if (error) {
                    console.error("Cloudinary Upload Error:", error);
                    return res.status(500).json({ success: false, error: 'Failed to upload document.' });
                }

                const newDocument = await VehicleDocument.create({
                    vehicleId: vehicle._id,
                    documentType,
                    documentName,
                    fileUrl: result.secure_url,
                    publicId: result.public_id,
                    mimeType: req.file.mimetype,
                    fileSize: req.file.size,
                    documentDate: documentDate || null,
                    expiryDate: expiryDate || null,
                    notes: notes || '',
                    uploadedBy: req.user._id
                });

                await AuditLog.create({
                    actor: req.user._id,
                    action: 'DOCUMENT_UPLOADED',
                    target: vehicle._id.toString(),
                    metadata: { documentName, documentType, documentId: newDocument._id.toString() },
                    ipAddress: req.ip
                });

                res.status(201).json({ success: true, data: newDocument });
            }
        );

        stream.end(req.file.buffer);

    } catch (error) {
        console.error("Error adding vehicle document:", error);
        res.status(500).json({ success: false, error: "Server Error adding vehicle document" });
    }
};

// @desc    Update a vehicle document
// @route   PUT /api/vehicles/documents/:documentId
// @access  Private
export const updateVehicleDocument = async (req, res) => {
    try {
        const document = await VehicleDocument.findById(req.params.documentId);
        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        const { documentType, documentName, documentDate, expiryDate, notes } = req.body;
        
        document.documentType = documentType || document.documentType;
        document.documentName = documentName || document.documentName;
        document.documentDate = documentDate !== undefined ? documentDate : document.documentDate;
        document.expiryDate = expiryDate !== undefined ? expiryDate : document.expiryDate;
        document.notes = notes !== undefined ? notes : document.notes;

        await document.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'DOCUMENT_UPDATED',
            target: document.vehicleId.toString(),
            metadata: { documentName: document.documentName, documentId: document._id.toString() },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: document });
    } catch (error) {
        console.error("Error updating vehicle document:", error);
        res.status(500).json({ success: false, error: "Server Error updating vehicle document" });
    }
};

// @desc    Delete a vehicle document
// @route   DELETE /api/vehicles/documents/:documentId
// @access  Private
export const deleteVehicleDocument = async (req, res) => {
    try {
        const document = await VehicleDocument.findById(req.params.documentId);
        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // Delete from Cloudinary
        const cloudinary = getCloudinary();
        if (cloudinary && document.publicId) {
            let result = await cloudinary.uploader.destroy(document.publicId, { resource_type: 'image' });
            if (result && result.result !== 'ok') {
                await cloudinary.uploader.destroy(document.publicId, { resource_type: 'raw' });
            }
        }

        await VehicleDocument.deleteOne({ _id: document._id });

        await AuditLog.create({
            actor: req.user._id,
            action: 'DOCUMENT_DELETED',
            target: document.vehicleId.toString(),
            metadata: { documentName: document.documentName, documentId: document._id.toString() },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error("Error deleting vehicle document:", error);
        res.status(500).json({ success: false, error: "Server Error deleting vehicle document" });
    }
};

// @desc    Get a signed file URL for viewing/downloading a document
// @route   GET /api/vehicles/documents/:documentId/file
// @access  Private
export const getVehicleDocumentFile = async (req, res) => {
    try {
        const document = await VehicleDocument.findById(req.params.documentId);
        if (!document) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        const cloudinary = getCloudinary();
        if (cloudinary && document.publicId) {
            const isDownload = req.query.download === 'true';
            // Extract extension/format from fileUrl
            const formatMatch = document.fileUrl.match(/\.([a-zA-Z0-9]+)$/);
            const format = formatMatch ? formatMatch[1] : '';
            const resourceType = document.fileUrl.includes('/raw/') ? 'raw' : 'image';

            // Using private_download_url guarantees delivery of PDFs even if blocked natively on public endpoints
            const signedUrl = cloudinary.utils.private_download_url(
                document.publicId,
                format,
                { 
                    resource_type: resourceType,
                    type: 'upload',
                    attachment: isDownload
                }
            );
            return res.redirect(signedUrl);
        }
        
        return res.redirect(document.fileUrl);
    } catch (error) {
        console.error("Error generating document URL:", error);
        res.status(500).json({ success: false, error: "Server Error generating document URL" });
    }
};
