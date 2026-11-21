import DealerCar from '../models/DealerCar.js';
import AuditLog from '../models/AuditLog.js';
import getCloudinary from '../config/cloudinary.js';
import { escapeRegex } from '../utils/sanitize.js';

const uploadLicenseBufferToCloudinary = async (file) => {
    const cloudinary = getCloudinary();
    if (!cloudinary || !process.env.CLOUDINARY_CLOUD_NAME) {
        throw new Error('Cloudinary configuration is missing.');
    }

    const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'gsk-automotive/buyer-licenses', resource_type: 'auto' },
            (error, uploadResult) => {
                if (error) reject(error);
                else resolve(uploadResult);
            }
        );
        stream.end(file.buffer);
    });

    return {
        documentUrl: result.secure_url,
        documentPublicId: result.public_id,
        documentName: file.originalname || 'license-document',
        documentMimeType: file.mimetype || '',
        documentSize: file.size || null,
        uploadedAt: new Date()
    };
};

const parseMaybeJson = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch {
            return null;
        }
    }
    return null;
};

const buildBuyerFields = (body, existingCar = null, uploadedDoc = null) => {
    const result = {};

    if (body.buyerName !== undefined) result.buyerName = body.buyerName;
    if (body.buyerPhone !== undefined) result.buyerPhone = body.buyerPhone;
    if (body.buyerEmail !== undefined) result.buyerEmail = body.buyerEmail;
    if (body.buyerId !== undefined) result.buyerId = body.buyerId || undefined;

    const existingLicense = existingCar?.buyerLicense
        ? (typeof existingCar.buyerLicense.toObject === 'function'
            ? existingCar.buyerLicense.toObject()
            : { ...existingCar.buyerLicense })
        : {};

    const incomingLicense = parseMaybeJson(body.buyerLicense) || {};
    const hasLicenseInput =
        body.buyerLicense !== undefined ||
        body.licenseNumber !== undefined ||
        body.licenseHolderName !== undefined ||
        body.licenseIssuingState !== undefined ||
        body.licenseExpiryDate !== undefined ||
        body.licenseClass !== undefined ||
        body.removeLicenseDocument !== undefined ||
        Boolean(uploadedDoc);

    if (hasLicenseInput) {
        const rawExpiry =
            incomingLicense.expiryDate !== undefined
                ? incomingLicense.expiryDate
                : body.licenseExpiryDate !== undefined
                    ? body.licenseExpiryDate
                    : existingLicense.expiryDate;

        const nextLicense = {
            licenseNumber:
                incomingLicense.licenseNumber !== undefined
                    ? incomingLicense.licenseNumber
                    : body.licenseNumber !== undefined
                        ? body.licenseNumber
                        : (existingLicense.licenseNumber || ''),
            holderName:
                incomingLicense.holderName !== undefined
                    ? incomingLicense.holderName
                    : body.licenseHolderName !== undefined
                        ? body.licenseHolderName
                        : (existingLicense.holderName || ''),
            issuingState:
                incomingLicense.issuingState !== undefined
                    ? incomingLicense.issuingState
                    : body.licenseIssuingState !== undefined
                        ? body.licenseIssuingState
                        : (existingLicense.issuingState || ''),
            expiryDate: rawExpiry ? new Date(rawExpiry) : null,
            licenseClass:
                incomingLicense.licenseClass !== undefined
                    ? incomingLicense.licenseClass
                    : body.licenseClass !== undefined
                        ? body.licenseClass
                        : (existingLicense.licenseClass || ''),
            documentUrl:
                incomingLicense.documentUrl !== undefined
                    ? incomingLicense.documentUrl
                    : (existingLicense.documentUrl || ''),
            documentPublicId:
                incomingLicense.documentPublicId !== undefined
                    ? incomingLicense.documentPublicId
                    : (existingLicense.documentPublicId || ''),
            documentName:
                incomingLicense.documentName !== undefined
                    ? incomingLicense.documentName
                    : (existingLicense.documentName || ''),
            documentMimeType:
                incomingLicense.documentMimeType !== undefined
                    ? incomingLicense.documentMimeType
                    : (existingLicense.documentMimeType || ''),
            documentSize:
                incomingLicense.documentSize !== undefined
                    ? incomingLicense.documentSize
                    : (existingLicense.documentSize ?? null),
            uploadedAt:
                incomingLicense.uploadedAt !== undefined
                    ? incomingLicense.uploadedAt
                    : (existingLicense.uploadedAt || null)
        };

        if (body.removeLicenseDocument === true || body.removeLicenseDocument === 'true') {
            nextLicense.documentUrl = '';
            nextLicense.documentPublicId = '';
            nextLicense.documentName = '';
            nextLicense.documentMimeType = '';
            nextLicense.documentSize = null;
            nextLicense.uploadedAt = null;
        }

        if (uploadedDoc) {
            Object.assign(nextLicense, uploadedDoc);
        }

        result.buyerLicense = nextLicense;
    }

    const existingAddress = existingCar?.buyerAddress
        ? (typeof existingCar.buyerAddress.toObject === 'function'
            ? existingCar.buyerAddress.toObject()
            : { ...existingCar.buyerAddress })
        : {};

    const incomingAddress = parseMaybeJson(body.buyerAddress) || {};
    const hasAddressInput =
        body.buyerAddress !== undefined ||
        body.addressLine1 !== undefined ||
        body.addressLine2 !== undefined ||
        body.suburb !== undefined ||
        body.state !== undefined ||
        body.postcode !== undefined ||
        body.country !== undefined;

    if (hasAddressInput) {
        result.buyerAddress = {
            addressLine1:
                incomingAddress.addressLine1 !== undefined
                    ? incomingAddress.addressLine1
                    : body.addressLine1 !== undefined
                        ? body.addressLine1
                        : (existingAddress.addressLine1 || ''),
            addressLine2:
                incomingAddress.addressLine2 !== undefined
                    ? incomingAddress.addressLine2
                    : body.addressLine2 !== undefined
                        ? body.addressLine2
                        : (existingAddress.addressLine2 || ''),
            suburb:
                incomingAddress.suburb !== undefined
                    ? incomingAddress.suburb
                    : body.suburb !== undefined
                        ? body.suburb
                        : (existingAddress.suburb || ''),
            state:
                incomingAddress.state !== undefined
                    ? incomingAddress.state
                    : body.state !== undefined
                        ? body.state
                        : (existingAddress.state || ''),
            postcode:
                incomingAddress.postcode !== undefined
                    ? incomingAddress.postcode
                    : body.postcode !== undefined
                        ? body.postcode
                        : (existingAddress.postcode || ''),
            country:
                incomingAddress.country !== undefined
                    ? incomingAddress.country
                    : body.country !== undefined
                        ? body.country
                        : (existingAddress.country || 'Australia')
        };
    }

    return result;
};

// @desc    Upload buyer driving licence document to Cloudinary
// @route   POST /api/dealer-cars/upload-license
// @access  Private (Admin/SuperAdmin)
export const uploadBuyerLicenseDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No licence document file provided.' });
        }
        const uploadedDoc = await uploadLicenseBufferToCloudinary(req.file);
        res.status(200).json({
            success: true,
            data: uploadedDoc
        });
    } catch (error) {
        console.error('Error uploading buyer licence document:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload driving licence document.'
        });
    }
};

// @desc    Get dealer cars with filter, search, pagination
// @route   GET /api/dealer-cars
// @access  Private (Admin/SuperAdmin)
export const getDealerCars = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 50 } = req.query;
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

        const filter = { isActive: true };

        if (status && status !== 'All') {
            filter.status = status;
        }

        if (search) {
            const safeSearch = escapeRegex(search);
            filter.$or = [
                { dealerName: { $regex: safeSearch, $options: 'i' } },
                { make: { $regex: safeSearch, $options: 'i' } },
                { model: { $regex: safeSearch, $options: 'i' } },
                { registrationNumber: { $regex: safeSearch, $options: 'i' } },
                { vin: { $regex: safeSearch, $options: 'i' } },
                { buyerName: { $regex: safeSearch, $options: 'i' } },
                { buyerPhone: { $regex: safeSearch, $options: 'i' } },
                { buyerEmail: { $regex: safeSearch, $options: 'i' } },
                { 'buyerLicense.licenseNumber': { $regex: safeSearch, $options: 'i' } },
                { 'buyerLicense.holderName': { $regex: safeSearch, $options: 'i' } },
                { 'buyerAddress.suburb': { $regex: safeSearch, $options: 'i' } }
            ];
        }

        const [dealerCars, total, metricsAgg] = await Promise.all([
            DealerCar.find(filter)
                .populate('vehicleId', 'brand model year registrationNumber')
                .populate('buyerId', 'name email')
                .sort({ createdAt: -1 })
                .skip((safePage - 1) * safeLimit)
                .limit(safeLimit)
                .lean(),
            DealerCar.countDocuments(filter),
            // Calculate global metrics concurrently
            DealerCar.aggregate([
                { $match: { isActive: true } },
                { $group: {
                    _id: null,
                    inStockCount: {
                        $sum: { $cond: [{ $eq: ["$status", "In Stock"] }, 1, 0] }
                    },
                    soldCount: {
                        $sum: { $cond: [{ $eq: ["$status", "Sold"] }, 1, 0] }
                    },
                    costInStock: {
                        $sum: { $cond: [{ $eq: ["$status", "In Stock"] }, "$cost", 0] }
                    },
                    actualProfit: {
                        $sum: { 
                            $cond: [
                                { $eq: ["$status", "Sold"] }, 
                                { $subtract: [
                                    { $ifNull: [{ $ifNull: ["$soldFor", "$sellPrice"] }, 0] }, 
                                    { $ifNull: ["$cost", 0] }
                                ] }, 
                                0
                            ]
                        }
                    }
                }}
            ])
        ]);

        const metrics = {
            inStock: metricsAgg[0]?.inStockCount || 0,
            sold: metricsAgg[0]?.soldCount || 0,
            costInStock: metricsAgg[0]?.costInStock || 0,
            actualProfit: metricsAgg[0]?.actualProfit || 0
        };

        res.status(200).json({
            success: true,
            data: dealerCars,
            metrics,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                pages: Math.ceil(total / safeLimit)
            }
        });
    } catch (error) {
        console.error("Error fetching dealer cars:", error);
        res.status(500).json({ success: false, error: "Server Error fetching dealer cars" });
    }
};

// @desc    Create a new dealer car
// @route   POST /api/dealer-cars
// @access  Private (Admin/SuperAdmin)
export const createDealerCar = async (req, res) => {
    try {
        const { vehicleId, make, model, year, registrationNumber, vin, mileage, colour, purchaseDate, dealerName, cost, sellPrice, notes, status, soldFor, soldDate } = req.body;

        let uploadedDoc = null;
        if (req.file) {
            uploadedDoc = await uploadLicenseBufferToCloudinary(req.file);
        }

        const buyerFields = buildBuyerFields(req.body, null, uploadedDoc);

        const payload = {
            make,
            model,
            year,
            registrationNumber,
            vin,
            mileage,
            colour,
            purchaseDate: purchaseDate || new Date(),
            dealerName,
            cost,
            sellPrice,
            notes,
            status: status || 'In Stock',
            ...(soldFor !== undefined && soldFor !== '' ? { soldFor: Number(soldFor) } : {}),
            ...(soldDate ? { soldDate } : {}),
            ...buyerFields
        };
        if (vehicleId) payload.vehicleId = vehicleId;

        const newDealerCar = await DealerCar.create(payload);

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'CREATE_DEALER_CAR',
            target: newDealerCar._id.toString(),
            metadata: { dealer: dealerName, make, model },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            data: newDealerCar
        });
    } catch (error) {
        console.error("Error creating dealer car:", error);
        res.status(500).json({ success: false, error: "Server Error creating dealer car" });
    }
};

// @desc    Update a dealer car (or mark as sold)
// @route   PUT /api/dealer-cars/:id
// @access  Private (Admin/SuperAdmin)
export const updateDealerCar = async (req, res) => {
    try {
        const dealerCar = await DealerCar.findById(req.params.id);

        if (!dealerCar) {
            return res.status(404).json({ success: false, error: 'Dealer car not found' });
        }

        let uploadedDoc = null;
        if (req.file) {
            uploadedDoc = await uploadLicenseBufferToCloudinary(req.file);
        }

        const buyerFields = buildBuyerFields(req.body, dealerCar, uploadedDoc);
        const updatePayload = {
            ...req.body,
            ...buyerFields
        };
        delete updatePayload.removeLicenseDocument;
        delete updatePayload.licenseNumber;
        delete updatePayload.licenseHolderName;
        delete updatePayload.licenseIssuingState;
        delete updatePayload.licenseExpiryDate;
        delete updatePayload.licenseClass;
        delete updatePayload.addressLine1;
        delete updatePayload.addressLine2;
        delete updatePayload.suburb;
        delete updatePayload.state;
        delete updatePayload.postcode;
        delete updatePayload.country;

        const updatedDealerCar = await DealerCar.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true, runValidators: true }
        );

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'UPDATE_DEALER_CAR',
            target: dealerCar._id.toString(),
            metadata: { status: updatedDealerCar.status },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: updatedDealerCar
        });
    } catch (error) {
        console.error("Error updating dealer car:", error);
        res.status(500).json({ success: false, error: "Server Error updating dealer car" });
    }
};

// @desc    Delete (soft delete) a dealer car
// @route   DELETE /api/dealer-cars/:id
// @access  Private (Admin/SuperAdmin)
export const deleteDealerCar = async (req, res) => {
    try {
        const dealerCar = await DealerCar.findById(req.params.id);

        if (!dealerCar) {
            return res.status(404).json({ success: false, error: 'Dealer car not found' });
        }

        dealerCar.isActive = false;
        await dealerCar.save();

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'DELETE_DEALER_CAR',
            target: dealerCar._id.toString(),
            metadata: { },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error("Error deleting dealer car:", error);
        res.status(500).json({ success: false, error: "Server Error deleting dealer car" });
    }
};
