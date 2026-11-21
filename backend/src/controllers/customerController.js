import mongoose from 'mongoose';
import Customer, { CUSTOMER_TYPES } from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import AuditLog from '../models/AuditLog.js';
import { getUnifiedHistory } from '../services/historyService.js';
import { escapeRegex } from '../utils/sanitize.js';

// Human-readable labels for customer types
const CUSTOMER_TYPE_LABELS = {
    regular: 'Regular Customer',
    import_company: 'Import Company',
    rental_company: 'Rental Company'
};

// @desc    Get all customers (filtered, searched, paginated)
// @route   GET /api/customers
// @access  Private (Admin/SuperAdmin)
export const getCustomers = async (req, res, overrideFilter = {}) => {
    try {
        const { customerType, search, page = 1, limit = 50, status, hasVehicles } = req.query;

        // Build filter
        const filter = { ...overrideFilter };
        let regoVehicleMap = {}; // mapping customerId -> vehicle info

        // Status filter (Active/Inactive)
        if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }

        if (customerType && CUSTOMER_TYPES.includes(customerType) && !overrideFilter.customerType) {
            filter.customerType = customerType;
        }

        if (search) {
            const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
            
            // Allow searching by Vehicle Rego No for Rentals
            let matchedCustomerIds = [];
            if (customerType === 'rental_company') {
                const Vehicle = (await import('../models/Vehicle.js')).default;
                const regoMatches = await Vehicle.find({ registrationNumber: searchRegex, isActive: true }).select('customerId registrationNumber brand model');
                matchedCustomerIds = regoMatches.map(v => v.customerId).filter(Boolean);
                
                regoMatches.forEach(v => {
                    if (v.customerId) {
                        regoVehicleMap[v.customerId.toString()] = {
                            registrationNumber: v.registrationNumber,
                            brand: v.brand,
                            model: v.model
                        };
                    }
                });
            }

            filter.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex }
            ];

            if (matchedCustomerIds.length > 0) {
                filter.$or.push({ _id: { $in: matchedCustomerIds } });
            }
        }

        if (hasVehicles === 'true' || hasVehicles === 'false') {
            const customersWithVehicles = await Vehicle.find({ isActive: true, customerId: { $ne: null } }).distinct('customerId');
            if (hasVehicles === 'true') {
                filter._id = { $in: customersWithVehicles };
            } else {
                filter._id = { $nin: customersWithVehicles };
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [total, customersQuery, metricsAggregation] = await Promise.all([
            Customer.countDocuments(filter),
            Customer.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            // Metrics: counts per type (always from active customers, ignoring search/type filter)
            Customer.aggregate([
                { $match: { isActive: true } },
                { 
                    $facet: {
                        totalCustomers: [{ $count: "count" }],
                        regularCount: [
                            { $match: { customerType: 'regular' } },
                            { $count: "count" }
                        ],
                        importCount: [
                            { $match: { customerType: 'import_company' } },
                            { $count: "count" }
                        ],
                        rentalCount: [
                            { $match: { customerType: 'rental_company' } },
                            { $count: "count" }
                        ]
                    }
                }
            ])
        ]);
            
        let customers = customersQuery;
        if (search && Object.keys(regoVehicleMap).length > 0) {
            customers = customersQuery.map(c => {
                const customerObj = c.toObject ? c.toObject() : { ...c };
                const matchedVehicle = regoVehicleMap[customerObj._id.toString()];
                if (matchedVehicle) {
                    customerObj.matchedVehicle = matchedVehicle;
                }
                return customerObj;
            });
        }

        const aggResult = metricsAggregation[0];
        const totalCustomers = aggResult.totalCustomers[0]?.count || 0;
        const regularCount = aggResult.regularCount[0]?.count || 0;
        const importCount = aggResult.importCount[0]?.count || 0;
        const rentalCount = aggResult.rentalCount[0]?.count || 0;

        res.status(200).json({
            success: true,
            data: customers,
            metrics: {
                totalCustomers,
                regularCount,
                importCount,
                rentalCount
            },
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ success: false, error: "Server Error fetching customers" });
    }
};

// @desc    Get all regular customers with vehicle counts (Enforced server-side)
// @route   GET /api/customers/regular
// @access  Private (Admin/SuperAdmin)
export const getRegularCustomers = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        // Build match filter — always regular, always active
        const matchFilter = { customerType: 'regular', isActive: true };

        if (search) {
            const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
            matchFilter.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Customer.countDocuments(matchFilter);

        // Use aggregation pipeline with $lookup for accurate vehicle count
        const customers = await Customer.aggregate([
            { $match: matchFilter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'vehicles',
                    let: { custId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [
                            { $eq: ['$customerId', '$$custId'] },
                            { $eq: ['$isActive', true] }
                        ]}}},
                        { $count: 'count' }
                    ],
                    as: 'vehicleCountArr'
                }
            },
            {
                $addFields: {
                    vehicleCount: { $ifNull: [{ $arrayElemAt: ['$vehicleCountArr.count', 0] }, 0] }
                }
            },
            { $project: { vehicleCountArr: 0 } }
        ]);

        res.status(200).json({
            success: true,
            data: customers,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error fetching regular customers:", error);
        res.status(500).json({ success: false, error: "Server Error fetching regular customers" });
    }
};

// @desc    Create a regular customer (forces customerType = 'regular')
// @route   POST /api/customers/regular
// @access  Private (Admin/SuperAdmin)
export const createRegularCustomer = async (req, res) => {
    // Force customerType to 'regular' regardless of what the client sends
    req.body.customerType = 'regular';
    return createCustomer(req, res);
};

// @desc    Update a regular customer
// @route   PUT /api/customers/regular/:id
// @access  Private (Admin/SuperAdmin)
export const updateRegularCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
        if (customer.customerType !== 'regular') return res.status(400).json({ success: false, error: 'Cannot update non-regular customer through this endpoint' });
        
        // Ensure type cannot be changed
        req.body.customerType = 'regular';
        
        // Let the canonical update logic handle the rest
        return updateCustomer(req, res);
    } catch (error) {
        console.error("Error updating regular customer:", error);
        res.status(500).json({ success: false, error: "Server Error updating regular customer" });
    }
};

// @desc    Delete a regular customer
// @route   DELETE /api/customers/regular/:id
// @access  Private (Admin/SuperAdmin)
export const deleteRegularCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
        if (customer.customerType !== 'regular') return res.status(400).json({ success: false, error: 'Cannot delete non-regular customer through this endpoint' });
        
        // Let the canonical delete logic handle the rest
        return deleteCustomer(req, res);
    } catch (error) {
        console.error("Error deleting regular customer:", error);
        res.status(500).json({ success: false, error: "Server Error deleting regular customer" });
    }
};


// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private (Admin/SuperAdmin)
export const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }
        res.status(200).json({ success: true, data: customer });
    } catch (error) {
        console.error("Error fetching customer:", error);
        res.status(500).json({ success: false, error: "Server Error fetching customer" });
    }
};
// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private (Admin/SuperAdmin)
export const createCustomer = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { name, phone, email, address, customerType, idType, idNumber, notes, vehicleId } = req.body;

        if (!name || !phone) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, error: 'Name and Phone are required' });
        }

        // Validate customerType if provided
        if (customerType && !CUSTOMER_TYPES.includes(customerType)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                error: `Invalid customer type. Must be one of: ${CUSTOMER_TYPES.join(', ')}`
            });
        }

        let targetVehicle = null;
        if (vehicleId) {
            targetVehicle = await Vehicle.findById(vehicleId).session(session);
            if (!targetVehicle) {
                await session.abortTransaction();
                session.endSession();
                return res.status(404).json({ success: false, error: 'Target Vehicle not found' });
            }
            if (!targetVehicle.isActive) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, error: 'Target Vehicle is inactive' });
            }
            if (targetVehicle.customerId) {
                await session.abortTransaction();
                session.endSession();
                return res.status(409).json({ success: false, error: 'This vehicle is already assigned to another customer. Use Reassign Vehicle if you intentionally want to change ownership.' });
            }
        }

        const normalizedEmail = email?.trim().toLowerCase();
        const normalizedPhone = phone.trim();
        const duplicate = await Customer.findOne({
            isActive: true,
            $or: [
                ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
                { phone: normalizedPhone }
            ]
        }).session(session);

        if (duplicate) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ success: false, error: 'An active customer with this email or phone already exists' });
        }

        const newCustomer = new Customer({
            name,
            phone: normalizedPhone,
            email: normalizedEmail,
            address,
            customerType: customerType || 'regular',
            idType,
            idNumber,
            notes
        });
        
        await newCustomer.save({ session });

        // Log action for customer creation
        await AuditLog.create([{
            actor: req.user._id,
            action: 'CREATE_CUSTOMER',
            target: newCustomer._id.toString(),
            metadata: { name, customerType: newCustomer.customerType },
            ipAddress: req.ip
        }], { session });

        if (targetVehicle) {
            targetVehicle.customerId = newCustomer._id;
            await targetVehicle.save({ session });

            await AuditLog.create([{
                actor: req.user._id,
                action: 'LINK_VEHICLE',
                target: targetVehicle._id.toString(),
                metadata: { vehicle: `${targetVehicle.brand} ${targetVehicle.model}`, regoNo: targetVehicle.registrationNumber, customerId: newCustomer._id },
                ipAddress: req.ip
            }], { session });
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            data: newCustomer
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error creating customer:", error);
        res.status(500).json({ success: false, error: "Server Error creating customer" });
    }
};

// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private (Admin/SuperAdmin)
export const updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        const normalizedEmail = req.body.email?.trim().toLowerCase();
        const normalizedPhone = req.body.phone?.trim();

        if (normalizedEmail || normalizedPhone) {
            const duplicate = await Customer.findOne({
                _id: { $ne: customer._id },
                isActive: true,
                $or: [
                    ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
                    ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
                ]
            });
            if (duplicate) {
                return res.status(409).json({ success: false, error: 'An active customer with this email or phone already exists' });
            }
        }

        // Validate customerType if it's being changed
        if (req.body.customerType && !CUSTOMER_TYPES.includes(req.body.customerType)) {
            return res.status(400).json({
                success: false,
                error: `Invalid customer type. Must be one of: ${CUSTOMER_TYPES.join(', ')}`
            });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                phone: normalizedPhone,
                email: normalizedEmail,
                address: req.body.address,
                customerType: req.body.customerType,
                idType: req.body.idType,
                idNumber: req.body.idNumber,
                notes: req.body.notes
            },
            { new: true, runValidators: true }
        );

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'UPDATE_CUSTOMER',
            target: customer._id.toString(),
            metadata: { name: updatedCustomer.name, customerType: updatedCustomer.customerType },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: updatedCustomer
        });
    } catch (error) {
        console.error("Error updating customer:", error);
        res.status(500).json({ success: false, error: "Server Error updating customer" });
    }
};

// @desc    Delete (soft delete) a customer
// @route   DELETE /api/customers/:id
// @access  Private (Admin/SuperAdmin)
export const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        customer.isActive = false;
        await customer.save();

        // Log action
        await AuditLog.create({
            actor: req.user._id,
            action: 'DELETE_CUSTOMER',
            target: customer._id.toString(),
            metadata: { name: customer.name },
            ipAddress: req.ip
        });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error("Error deleting customer:", error);
        res.status(500).json({ success: false, error: "Server Error deleting customer" });
    }
};

// @desc    Get customer's unified history
// @route   GET /api/customers/:id/history
// @access  Private (Admin/SuperAdmin)
export const getCustomerHistory = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        
        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        const { typeFilter, page, limit } = req.query;

        const historyData = await getUnifiedHistory({
            query: { customerId: customer._id },
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
        console.error("Error fetching customer history:", error);
        res.status(500).json({ success: false, error: "Server Error fetching history" });
    }
};

// @desc    Get customer's service requests (Bookings and Quotes)
// @route   GET /api/customers/:id/service-requests
// @access  Private (Admin/SuperAdmin)
export const getServiceRequests = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        
        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer not found' });
        }

        // Dynamically import models
        const { default: Booking } = await import('../models/Booking.js');
        const { default: Quote } = await import('../models/Quote.js');
        const { default: JobCard } = await import('../models/JobCard.js');
        const { default: Invoice } = await import('../models/Invoice.js');
        const { sanitizeJobCardForRole } = await import('./jobCardController.js');

        const isMechanic = req.user?.role === 'mechanic' || req.user?.role === 'user';

        // Fetch bookings for this customer
        const bookings = await Booking.find({ customerId: customer._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        // Fetch quotes for this customer
        const quotes = await Quote.find({ customerId: customer._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        // Fetch Job Cards
        const jobCards = await JobCard.find({ customerId: customer._id })
            .populate('vehicleId', 'brand model year registrationNumber')
            .lean();

        // Fetch Invoices (only for Admin / Super Admin)
        const invoices = isMechanic
            ? []
            : await Invoice.find({ customerId: customer._id })
                .populate('vehicleId', 'brand model year registrationNumber')
                .lean();

        // Add a type field to distinguish them
        const typedBookings = bookings.map(b => ({ ...b, requestType: 'booking' }));
        const typedQuotes = quotes.map(q => ({ ...q, requestType: 'quote' }));
        const typedJobCards = jobCards.map(jc => ({
            ...sanitizeJobCardForRole(jc, req.user?.role),
            requestType: 'jobcard'
        }));
        const typedInvoices = invoices.map(i => ({ ...i, requestType: 'invoice' }));

        // Merge and sort by createdAt descending
        const serviceRequests = [...typedBookings, ...typedQuotes, ...typedJobCards, ...typedInvoices].sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.status(200).json({
            success: true,
            data: serviceRequests
        });
    } catch (error) {
        console.error("Error fetching customer service requests:", error);
        res.status(500).json({ success: false, error: "Server Error fetching service requests" });
    }
};

// @desc    Get valid customer types (for frontend dropdowns)
// @route   GET /api/customers/types
// @access  Private (Admin/SuperAdmin)
export const getCustomerTypes = (req, res) => {
    res.status(200).json({
        success: true,
        data: CUSTOMER_TYPES.map(type => ({
            value: type,
            label: CUSTOMER_TYPE_LABELS[type]
        }))
    });
};

// @desc    Get customer vehicles
// @route   GET /api/customers/:id/vehicles
// @access  Private (Admin/SuperAdmin)
export const getCustomerVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ customerId: req.params.id, isActive: true })
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: vehicles });
    } catch (error) {
        console.error("Error fetching customer vehicles:", error);
        res.status(500).json({ success: false, error: "Server Error fetching customer vehicles" });
    }
};

// @desc    Link an existing vehicle to a customer
// @route   POST /api/customers/:id/vehicles/link
// @access  Private (Admin/SuperAdmin)
export const linkVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.body;
        const customerId = req.params.id;

        if (!vehicleId) return res.status(400).json({ success: false, error: "vehicleId is required" });

        const customer = await Customer.findOne({ _id: customerId, isActive: true });
        if (!customer) return res.status(404).json({ success: false, error: "Customer not found" });

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) return res.status(404).json({ success: false, error: "Vehicle not found" });

        if (vehicle.customerId && vehicle.customerId.toString() === customerId) {
            return res.status(200).json({ success: true, data: vehicle }); // Already linked
        }

        if (vehicle.customerId && vehicle.customerId.toString() !== customerId) {
            return res.status(409).json({ success: false, error: "This Vehicle is already linked to another Customer. Reassign the Vehicle first." });
        }

        vehicle.customerId = customerId;
        await vehicle.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'LINK_VEHICLE',
            target: vehicle._id.toString(),
            metadata: { vehicle: `${vehicle.brand} ${vehicle.model}`, regoNo: vehicle.registrationNumber, customerId },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: vehicle });
    } catch (error) {
        console.error("Error linking vehicle:", error);
        res.status(500).json({ success: false, error: "Server Error linking vehicle" });
    }
};

// @desc    Unlink a vehicle from a customer
// @route   POST /api/customers/:id/vehicles/unlink
// @access  Private (Admin/SuperAdmin)
export const unlinkVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.body;
        const customerId = req.params.id;

        if (!vehicleId) return res.status(400).json({ success: false, error: "vehicleId is required" });

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) return res.status(404).json({ success: false, error: "Vehicle not found" });

        if (vehicle.customerId && vehicle.customerId.toString() !== customerId) {
            return res.status(403).json({ success: false, error: "Vehicle does not belong to this customer" });
        }

        vehicle.customerId = null;
        await vehicle.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'UNLINK_VEHICLE',
            target: vehicle._id.toString(),
            metadata: { vehicle: `${vehicle.brand} ${vehicle.model}`, regoNo: vehicle.registrationNumber, previousCustomer: customerId },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: vehicle });
    } catch (error) {
        console.error("Error unlinking vehicle:", error);
        res.status(500).json({ success: false, error: "Server Error unlinking vehicle" });
    }
};

// @desc    Explicitly reassign a vehicle to a customer
// @route   POST /api/customers/:id/vehicles/reassign
// @access  Private (Admin/SuperAdmin)
export const reassignVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.body;
        const targetCustomerId = req.params.id;

        if (!vehicleId) return res.status(400).json({ success: false, error: "vehicleId is required" });

        const targetCustomer = await Customer.findOne({ _id: targetCustomerId, isActive: true });
        if (!targetCustomer) return res.status(404).json({ success: false, error: "Target Customer not found" });

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) return res.status(404).json({ success: false, error: "Vehicle not found" });

        const previousCustomer = vehicle.customerId;

        vehicle.customerId = targetCustomerId;
        await vehicle.save();

        await AuditLog.create({
            actor: req.user._id,
            action: 'REASSIGN_VEHICLE',
            target: vehicle._id.toString(),
            metadata: { vehicle: `${vehicle.brand} ${vehicle.model}`, regoNo: vehicle.registrationNumber, newCustomer: targetCustomerId, previousCustomer: previousCustomer || null },
            ipAddress: req.ip
        });

        res.status(200).json({ success: true, data: vehicle });
    } catch (error) {
        console.error("Error reassigning vehicle:", error);
        res.status(500).json({ success: false, error: "Server Error reassigning vehicle" });
    }
};

// @desc    Provision a portal user account for a customer
// @route   POST /api/customers/:id/provision-portal
// @access  Private (Admin/SuperAdmin)
export const provisionPortalAccess = async (req, res) => {
    try {
        const { name, email } = req.body;
        const customerId = req.params.id;

        if (!name || !email) {
            return res.status(400).json({ success: false, error: 'Name and email are required to provision access.' });
        }

        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, error: 'Customer not found.' });
        }

        // Dynamically import User model to avoid circular deps if any
        const { default: User } = await import('../models/User.js');

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'A user with this email already exists.' });
        }

        // Generate a random temporary password (will be overwritten when they reset it)
        const { randomBytes } = await import('crypto');
        const tempPassword = randomBytes(16).toString('hex');

        const newUser = await User.create({
            name,
            email,
            password: tempPassword,
            role: 'user', // strictly customer user
            customerId: customer._id,
            status: 'active'
        });

        // Generate reset token for them to set their own password immediately
        const resetToken = newUser.getResetPasswordToken();
        await newUser.save({ validateBeforeSave: false });

        const baseUrl = process.env.FRONTEND_URL || (req ? `${req.protocol}://${req.get('host')}` : 'https://gskautomotive.vercel.app');
        const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

        // Send email
        const { buildAuthEmail } = await import('../utils/emailTemplates.js');
        const sendEmail = (await import('../utils/sendEmail.js')).default;

        const message = buildAuthEmail({
            title: "Welcome to GSK Automotive Portal",
            customerName: name,
            message: `An account has been created for you to access the GSK Automotive Customer Portal for <strong>${customer.name}</strong>.<br/><br/>Please click the button below to set your password and log in.`,
            actionText: "Set Password & Login",
            actionUrl: resetUrl
        });

        try {
            await sendEmail({
                to: email,
                subject: "Your GSK Automotive Portal Account",
                html: message,
            });
        } catch (err) {
            console.error("Failed to send provision email:", err);
            // Don't fail the API call if email fails, but maybe log it
        }

        await AuditLog.create({
            actor: req.user._id,
            action: 'PROVISION_PORTAL_USER',
            target: customer._id.toString(),
            metadata: { userEmail: email, userId: newUser._id.toString() },
            ipAddress: req.ip
        });

        res.status(201).json({ success: true, data: { _id: newUser._id, name: newUser.name, email: newUser.email } });
    } catch (error) {
        console.error("Error provisioning portal user:", error);
        res.status(500).json({ success: false, error: "Server Error provisioning portal user" });
    }
};

// @desc    Get portal users for a customer
// @route   GET /api/customers/:id/portal-users
// @access  Private (Admin/SuperAdmin)
export const getPortalUsers = async (req, res) => {
    try {
        const { default: User } = await import('../models/User.js');
        const users = await User.find({ customerId: req.params.id, role: 'user' }).select('name email status lastLoginAt createdAt');
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error("Error fetching portal users:", error);
        res.status(500).json({ success: false, error: "Server Error fetching portal users" });
    }
};
