import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import JobCard from '../models/JobCard.js';
import Invoice from '../models/Invoice.js';
import TrackerCarDocument from '../models/TrackerCarDocument.js';
import Booking from '../models/Booking.js';
import VehicleBatch from '../models/VehicleBatch.js';
import VehicleBatchMembership from '../models/VehicleBatchMembership.js';
import CustomerServiceUpdate from '../models/CustomerServiceUpdate.js';
import { getUnifiedHistory } from '../services/historyService.js';
import { generateInvoicePDFContent } from '../utils/pdfGenerator.js';
import { escapeRegex } from '../utils/sanitize.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------
// CUSTOMER-SAFE DTO MAPPERS
// ---------------------------------------------------------

const mapVehicleDTO = (vehicle) => {
    if (!vehicle) return null;
    return {
        _id: vehicle._id,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        registrationNumber: vehicle.registrationNumber,
        vin: vehicle.vin,
        status: vehicle.status, // e.g. "Available", "In Service"
        createdAt: vehicle.createdAt,
    };
};

// Map Job Card status to customer-friendly wording if needed
const mapJobCardStatus = (status) => {
    switch (status) {
        case 'Open': return 'Service Scheduled / Awaiting Work';
        case 'In Progress': return 'Work In Progress';
        case 'Waiting for Parts': return 'Waiting for Parts';
        case 'Waiting for Review': return 'Awaiting Final Review';
        case 'Completed': return 'Completed';
        case 'Cancelled': return 'Cancelled';
        case 'Stuck': return 'Service Delayed / Attention Required';
        default: return status;
    }
};

const mapJobCardDTO = (jobCard) => {
    if (!jobCard) return null;
    return {
        _id: jobCard._id,
        jobNumber: `JC-${jobCard._id.toString().slice(-4).toUpperCase()}`,
        status: mapJobCardStatus(jobCard.status),
        description: jobCard.description,
        servicesOrdered: jobCard.servicesOrdered,
        dateIn: jobCard.createdAt,
        expectedCompletionDate: jobCard.expectedCompletionDate,
        vehicleId: typeof jobCard.vehicleId === 'object' && jobCard.vehicleId ? mapVehicleDTO(jobCard.vehicleId) : (typeof jobCard.trackerCarId === 'object' && jobCard.trackerCarId ? mapVehicleDTO({ ...jobCard.trackerCarId, brand: jobCard.trackerCarId.make }) : null),
        assignedMechanic: jobCard.technicianId ? {
            firstName: jobCard.technicianId.firstName || jobCard.technicianId.name?.split(' ')[0] || '',
            lastName: jobCard.technicianId.lastName || jobCard.technicianId.name?.split(' ').slice(1).join(' ') || ''
        } : null,
    };
};

const mapInvoiceDTO = (invoice) => {
    if (!invoice) return null;
    return {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNo || invoice.invoiceNumber,
        status: invoice.status,
        date: invoice.createdAt,
        dueDate: invoice.dueDate,
        subtotal: invoice.subtotal,
        gstRate: invoice.gstRate,
        gstAmount: invoice.gstAmount,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        amountRemaining: invoice.totalAmount - (invoice.amountPaid || 0),
        vehicleId: invoice.vehicleId ? mapVehicleDTO(invoice.vehicleId) : (invoice.trackerCarId ? mapVehicleDTO({ ...invoice.trackerCarId, brand: invoice.trackerCarId.make }) : null),
        jobCardId: invoice.jobCardId ? mapJobCardDTO(invoice.jobCardId) : null,
    };
};

const mapBookingDTO = (booking) => {
    if (!booking) return null;
    return {
        _id: booking._id,
        status: booking.status,
        preferredDate: booking.appointment?.date,
        preferredTime: booking.appointment?.time,
        serviceType: booking.services?.join(', ') || '',
        additionalInfo: booking.additionalInfo,
        vehicleId: typeof booking.vehicleId === 'object' ? mapVehicleDTO(booking.vehicleId) : booking.vehicleId,
        vehicleRego: booking.vehicleInfo?.regNo,
        vehicleMake: booking.vehicleInfo?.make,
        vehicleModel: booking.vehicleInfo?.model,
        createdAt: booking.createdAt,
    };
};

const mapBatchDTO = (batch) => {
    if (!batch) return null;
    return {
        _id: batch._id,
        batchNumber: batch.batchNumber,
        referenceNumber: batch.referenceNumber,
        type: batch.type,
        status: batch.status,
        expectedVehicleCount: batch.expectedVehicleCount,
        expectedArrivalDate: batch.expectedArrivalDate,
        createdAt: batch.createdAt,
    };
};

// ---------------------------------------------------------
// CONTROLLERS
// ---------------------------------------------------------

// @desc    Get Customer Dashboard
// @route   GET /api/customer-portal/dashboard
// @access  Private/Customer
export const getDashboard = async (req, res) => {
    try {
        const customerId = req.user.customerId;
        const customerType = req.customer.customerType || 'regular';

        // Base scoped queries
        const vehicleCount = await Vehicle.countDocuments({ customerId, isActive: true });
        
        // Active Job Cards (not completed or cancelled)
        const activeJobCards = await JobCard.find({
            customerId,
            isActive: true,
            status: { $nin: ['Completed', 'Cancelled'] }
        })
        .populate('vehicleId', 'brand model registrationNumber')
        .populate('trackerCarId', 'make model registrationNumber vin')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

        // Outstanding Invoices
        const outstandingInvoices = await Invoice.find({
            customerId,
            isActive: true,
            status: { $in: ['Unpaid', 'Partially Paid'] }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

        // Upcoming Bookings - Booking model uses appointment.date
        const upcomingBookings = await Booking.find({
            customerId,
            isActive: true,
            status: { $nin: ['Completed', 'Cancelled'] }
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

        // Recent Customer Service Updates
        const recentUpdates = await CustomerServiceUpdate.find({
            customerId,
            isActive: true
        })
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

        let batchMetrics = null;
        if (customerType === 'import_company' || customerType === 'rental_company') {
            const activeBatchesCount = await VehicleBatch.countDocuments({ 
                customerId, 
                isActive: true,
                status: { $nin: ['Completed', 'Cancelled'] }
            });
            
            batchMetrics = {
                activeBatches: activeBatchesCount
            };
        }

        res.status(200).json({
            success: true,
            data: {
                vehicleCount,
                activeJobCards: activeJobCards.map(mapJobCardDTO),
                outstandingInvoices: outstandingInvoices.map(mapInvoiceDTO),
                upcomingBookings: upcomingBookings.map(mapBookingDTO),
                recentUpdates: recentUpdates.map(update => ({
                    _id: update._id,
                    message: update.message,
                    createdAt: update.createdAt,
                    author: update.createdBy?.name || 'Staff'
                })),
                batchMetrics,
                customerType
            }
        });
    } catch (error) {
        console.error("Error in getDashboard:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Vehicles
// @route   GET /api/customer-portal/vehicles
// @access  Private/Customer
export const getVehicles = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const filter = { customerId: req.user.customerId, isActive: true };

        if (search) {
            const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
            filter.$or = [
                { registrationNumber: searchRegex },
                { vin: searchRegex },
                { brand: searchRegex },
                { model: searchRegex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [vehicles, total] = await Promise.all([
            Vehicle.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
            Vehicle.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: vehicles.map(mapVehicleDTO),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error in getVehicles:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Vehicle By ID
// @route   GET /api/customer-portal/vehicles/:id
// @access  Private/Customer
export const getVehicleById = async (req, res) => {
    try {
        const vehicle = await Vehicle.findOne({
            _id: req.params.id,
            customerId: req.user.customerId,
            isActive: true
        }).lean();

        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }

        // Include active job card status
        const activeJobCard = await JobCard.findOne({
            vehicleId: vehicle._id,
            isActive: true,
            status: { $nin: ['Completed', 'Cancelled'] }
        }).lean();

        const vehicleDTO = mapVehicleDTO(vehicle);
        vehicleDTO.activeService = activeJobCard ? mapJobCardDTO(activeJobCard) : null;

        res.status(200).json({ success: true, data: vehicleDTO });
    } catch (error) {
        console.error("Error in getVehicleById:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Job Cards
// @route   GET /api/customer-portal/job-cards
// @access  Private/Customer
export const getJobCards = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const filter = { customerId: req.user.customerId, isActive: true };

        if (status && status !== 'All') {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [jobCards, total] = await Promise.all([
            JobCard.find(filter)
                .populate('vehicleId', 'brand model year registrationNumber')
                .populate('trackerCarId', 'make model year registrationNumber vin')
                .populate('technicianId', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            JobCard.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: jobCards.map(mapJobCardDTO),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error in getJobCards:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Job Card By ID
// @route   GET /api/customer-portal/job-cards/:id
// @access  Private/Customer
export const getJobCardById = async (req, res) => {
    try {
        const jobCard = await JobCard.findOne({
            _id: req.params.id,
            customerId: req.user.customerId,
            isActive: true
        })
        .populate('vehicleId', 'brand model year registrationNumber vin')
        .populate('trackerCarId', 'make model year registrationNumber vin')
        .populate('technicianId', 'name')
        .lean();

        if (!jobCard) {
            return res.status(404).json({ success: false, error: 'Job Card not found' });
        }

        res.status(200).json({ success: true, data: mapJobCardDTO(jobCard) });
    } catch (error) {
        console.error("Error in getJobCardById:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Invoices
// @route   GET /api/customer-portal/invoices
// @access  Private/Customer
export const getInvoices = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const filter = { customerId: req.user.customerId, isActive: true };

        if (status && status !== 'All') {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .populate('vehicleId', 'brand model year registrationNumber')
                .populate('trackerCarId', 'make model year registrationNumber vin')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Invoice.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: invoices.map(mapInvoiceDTO),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error in getInvoices:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Invoice By ID
// @route   GET /api/customer-portal/invoices/:id
// @access  Private/Customer
export const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            _id: req.params.id,
            customerId: req.user.customerId,
            isActive: true
        })
        .populate('vehicleId', 'brand model year registrationNumber')
        .populate('trackerCarId', 'make model year registrationNumber vin')
        .populate('jobCardId', 'status description')
        .lean();

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        // For detail view, we include lineItems in the DTO
        const invoiceDTO = mapInvoiceDTO(invoice);
        const rawItems = Array.isArray(invoice.partsAndLabour) && invoice.partsAndLabour.length > 0
            ? invoice.partsAndLabour
            : (Array.isArray(invoice.lineItems) ? invoice.lineItems : []);
        invoiceDTO.lineItems = rawItems.map(item => {
            const quantity = item.qty ?? item.quantity ?? 1;
            const unitPrice = item.price ?? item.unitPrice ?? 0;
            return {
                description: item.description || 'Service / Part',
                quantity,
                unitPrice,
                totalPrice: item.totalPrice ?? (quantity * unitPrice)
            };
        });
        
        invoiceDTO.paymentHistory = invoice.paymentHistory ? invoice.paymentHistory.map(p => ({
            date: p.paymentDate,
            amount: p.amount,
            method: p.method,
            reference: p.reference
        })) : [];

        res.status(200).json({ success: true, data: invoiceDTO });
    } catch (error) {
        console.error("Error in getInvoiceById:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Download Customer Invoice PDF
// @route   GET /api/customer-portal/invoices/:id/pdf
// @access  Private/Customer
export const downloadInvoicePDF = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            _id: req.params.id,
            customerId: req.user.customerId, // Strict isolation
            isActive: true
        })
        .populate('customerId')
        .populate('vehicleId')
        .populate('trackerCarId');

        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        const pdfBuffer = await generateInvoicePDFContent(invoice);
        const fileName = `Invoice_${invoice.invoiceNo || invoice.invoiceNumber || 'Document'}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Error downloading customer invoice PDF:", error);
        res.status(500).json({ success: false, error: "Server Error downloading invoice PDF" });
    }
};

// @desc    Get Customer Bookings
// @route   GET /api/customer-portal/bookings
// @access  Private/Customer
export const getBookings = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const filter = { customerId: req.user.customerId, isActive: true };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [bookings, total] = await Promise.all([
            Booking.find(filter)
                .populate('vehicleId', 'brand model year registrationNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Booking.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: bookings.map(mapBookingDTO),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error in getBookings:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Batches
// @route   GET /api/customer-portal/batches
// @access  Private/Customer
export const getBatches = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const filter = { customerId: req.user.customerId, isActive: true };

        if (status && status !== 'All') {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [batches, total] = await Promise.all([
            VehicleBatch.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            VehicleBatch.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: batches.map(mapBatchDTO),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error in getBatches:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Batch By ID
// @route   GET /api/customer-portal/batches/:id
// @access  Private/Customer
export const getBatchById = async (req, res) => {
    try {
        const batch = await VehicleBatch.findOne({
            _id: req.params.id,
            customerId: req.user.customerId,
            isActive: true
        }).lean();

        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }

        const batchDTO = mapBatchDTO(batch);

        // Calculate progress stats for this specific customer batch
        const totalMembers = await VehicleBatchMembership.countDocuments({ batchId: batch._id, isActive: true });
        const receivedMembers = await VehicleBatchMembership.countDocuments({ batchId: batch._id, isActive: true, receivedAt: { $ne: null } });

        batchDTO.stats = {
            expected: batch.expectedVehicleCount || 0,
            received: receivedMembers,
            totalIdentified: totalMembers
        };

        res.status(200).json({ success: true, data: batchDTO });
    } catch (error) {
        console.error("Error in getBatchById:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Batch Vehicles
// @route   GET /api/customer-portal/batches/:id/vehicles
// @access  Private/Customer
export const getBatchVehicles = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;

        // First verify batch belongs to customer
        const batch = await VehicleBatch.findOne({
            _id: req.params.id,
            customerId: req.user.customerId,
            isActive: true
        }).lean();

        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }

        const query = { batchId: batch._id, isActive: true };

        // We'll pull the memberships, then populate the vehicle to search if needed
        let memberships = await VehicleBatchMembership.find(query)
            .populate('vehicleId', 'registrationNumber vin brand model year')
            .populate('jobCardId', 'jobCardNumber status')
            .lean();

        if (search) {
            const lowerSearch = search.toLowerCase();
            memberships = memberships.filter(m => 
                (m.vehicleId?.registrationNumber || '').toLowerCase().includes(lowerSearch) ||
                (m.vehicleId?.vin || '').toLowerCase().includes(lowerSearch) ||
                (m.vehicleId?.brand || '').toLowerCase().includes(lowerSearch)
            );
        }

        const total = memberships.length;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedMemberships = memberships.slice(skip, skip + parseInt(limit));

        const mappedMemberships = (limit === 'all' ? memberships : paginatedMemberships).map(m => ({
            _id: m._id,
            vehicleId: m.vehicleId?._id,
            referenceNumber: m.referenceNumber,
            vehicleDetails: {
                registrationNumber: m.vehicleId?.registrationNumber || m.registrationNumber,
                vin: m.vehicleId?.vin || m.vin,
                brand: m.vehicleId?.brand || m.make,
                model: m.vehicleId?.model || m.model,
                year: m.vehicleId?.year || m.year,
            },
            jobCard: m.jobCardId ? {
                _id: m.jobCardId._id,
                jobCardNumber: m.jobCardId.jobCardNumber || `JC-${m.jobCardId._id.toString().slice(-4).toUpperCase()}`,
                status: m.jobCardId.status
            } : null,
            receivedAt: m.receivedAt,
            readyForCollectionAt: m.readyForCollectionAt,
            deliveredAt: m.deliveredAt,
            collectedAt: m.collectedAt,
            derivedStatus: m.status || (m.jobCardId ? m.jobCardId.status : (m.receivedAt ? 'Not Started' : 'Expected')),
            
            // Extra fields for Rental/Import UI & Export
            odometer: m.odometer,
            finalOdometer: m.finalOdometer,
            complianceStatus: m.complianceStatus,
            blueSlip: m.blueSlip,
            pinkSlip: m.pinkSlip,
            complianceNotes: m.complianceNotes
        }));

        res.status(200).json({
            success: true,
            data: mappedMemberships,
            pagination: limit === 'all' ? { total, page: 1, limit: total, pages: 1 } : {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("Error in getBatchVehicles:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get Customer Service History
// @route   GET /api/customer-portal/service-history
// @access  Private/Customer
export const getServiceHistory = async (req, res) => {
    try {
        const { typeFilter, page = 1, limit = 20, vehicleId } = req.query;
        
        const query = { customerId: req.user.customerId };
        if (vehicleId) {
            // Ensure vehicleId belongs to customer before using it
            const vehicleCheck = await Vehicle.findOne({ _id: vehicleId, customerId: req.user.customerId, isActive: true });
            if (!vehicleCheck) return res.status(404).json({ success: false, error: 'Vehicle not found' });
            query.vehicleId = vehicleId;
        }

        // getUnifiedHistory already implements standard pagination and pulls from Bookings, JobCards, and Invoices.
        // We pass userRole='user' to ensure getUnifiedHistory strips mechanic notes inside its logic if needed.
        const historyData = await getUnifiedHistory({
            query,
            typeFilter,
            page: parseInt(page),
            limit: parseInt(limit),
            userRole: 'user' // Ensures service layer strips internal notes
        });

        res.status(200).json({
            success: true,
            data: historyData.events,
            metrics: historyData.metrics,
            pagination: historyData.pagination
        });
    } catch (error) {
        console.error("Error fetching service history:", error);
        res.status(500).json({ success: false, error: 'Server Error fetching service history' });
    }
};

// ---------------------------------------------------------
// CUSTOMER SERVICE UPDATES (Read-Only)
// ---------------------------------------------------------

// @desc    Get customer updates for a job card
// @route   GET /api/customer-portal/job-cards/:id/service-updates
// @access  Private/Customer
export const getCustomerJobCardServiceUpdates = async (req, res) => {
    try {
        const jobCardId = req.params.id;
        const customerId = req.user.customerId;

        // 1. Verify Job Card ownership
        const jobCard = await JobCard.findOne({
            _id: jobCardId,
            customerId,
            isActive: true
        }).lean();

        if (!jobCard) {
            return res.status(404).json({ success: false, error: 'Job Card not found' });
        }

        // 2. Fetch Active Service Updates
        const updates = await CustomerServiceUpdate.find({
            jobCardId: jobCard._id,
            customerId: customerId,
            isActive: true
        })
        .select('message createdAt updatedAt createdBy') // Do not expose other fields
        .populate('createdBy', 'name role') // Populate name but be careful what is returned
        .sort({ createdAt: -1 })
        .lean();

        // 3. Map to safe DTO (Remove internal identity specifics if necessary, but name is generally safe)
        const safeUpdates = updates.map(update => ({
            _id: update._id,
            message: update.message,
            createdAt: update.createdAt,
            updatedAt: update.updatedAt,
            author: update.createdBy ? update.createdBy.name : 'Staff'
        }));

        res.status(200).json({
            success: true,
            data: safeUpdates
        });

    } catch (error) {
        console.error("Error fetching customer service updates:", error);
        res.status(500).json({ success: false, error: 'Server Error fetching service updates' });
    }
};

// ---------------------------------------------------------
// NEW BATCH & TRACKER ENDPOINTS FOR PHASE 3
// ---------------------------------------------------------

export const getBatchFinancialSummary = async (req, res) => {
    try {
        const batch = await VehicleBatch.findOne({
            _id: req.params.id,
            customerId: req.user.customerId,
            isActive: true
        }).lean();

        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });

        const invoices = await Invoice.find({
            trackerId: batch._id,
            customerId: req.user.customerId,
            isActive: true
        }).lean();

        let totalInvoiced = 0;
        let totalPaid = 0;
        
        invoices.forEach(inv => {
            totalInvoiced += inv.totalAmount || 0;
            if (inv.status === 'Paid') {
                totalPaid += inv.totalAmount || 0;
            } else if (inv.status === 'Partially Paid') {
                totalPaid += inv.amountPaid || 0;
            }
        });
        
        res.status(200).json({
            success: true,
            data: {
                totalInvoiced,
                totalPaid,
                outstanding: totalInvoiced - totalPaid,
                invoiceCount: invoices.length
            }
        });
    } catch (error) {
        console.error("Error in getBatchFinancialSummary:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

export const getBatchInvoices = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const batch = await VehicleBatch.findOne({
            _id: req.params.id,
            customerId: req.user.customerId,
            isActive: true
        }).lean();

        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [invoices, total] = await Promise.all([
            Invoice.find({ trackerId: batch._id, customerId: req.user.customerId, isActive: true })
                .populate('trackerCarId', 'registrationNumber vin make model')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Invoice.countDocuments({ trackerId: batch._id, customerId: req.user.customerId, isActive: true })
        ]);

        const mapped = invoices.map(inv => ({
            _id: inv._id,
            invoiceNo: inv.invoiceNo,
            createdAt: inv.createdAt,
            totalAmount: inv.totalAmount,
            status: inv.status,
            trackerCar: inv.trackerCarId ? {
                registrationNumber: inv.trackerCarId.registrationNumber,
                vin: inv.trackerCarId.vin
            } : null
        }));

        res.status(200).json({
            success: true,
            data: mapped,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error in getBatchInvoices:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

export const getTrackerCarDetail = async (req, res) => {
    try {
        const batch = await VehicleBatch.findOne({
            _id: req.params.batchId,
            customerId: req.user.customerId,
            isActive: true
        }).lean();

        if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' });

        const membership = await VehicleBatchMembership.findOne({
            _id: req.params.carId,
            batchId: batch._id,
            isActive: true
        }).populate('vehicleId', 'registrationNumber vin brand model year').lean();

        if (!membership) return res.status(404).json({ success: false, error: 'Tracker car not found in this batch' });

        // Get Job Cards
        const jobCardsRaw = await JobCard.find({
            trackerCarId: membership._id,
            customerId: req.user.customerId,
            isActive: true
        }).lean();

        const jobCards = jobCardsRaw.map(jc => ({
            _id: jc._id,
            jobCardNumber: jc.jobCardNumber || `JC-${jc._id.toString().slice(-4).toUpperCase()}`,
            status: mapJobCardStatus(jc.status),
            description: jc.description,
            createdAt: jc.createdAt,
            completedAt: jc.completedAt,
            servicesOrdered: jc.servicesOrdered
        }));

        // Get Invoices
        const invoicesRaw = await Invoice.find({
            trackerCarId: membership._id,
            customerId: req.user.customerId,
            isActive: true
        }).lean();
        
        const invoices = invoicesRaw.map(inv => ({
            _id: inv._id,
            invoiceNo: inv.invoiceNo,
            createdAt: inv.createdAt,
            totalAmount: inv.totalAmount,
            status: inv.status
        }));

        res.status(200).json({
            success: true,
            data: {
                _id: membership._id,
                referenceNumber: membership.referenceNumber,
                vehicleDetails: {
                    registrationNumber: membership.vehicleId?.registrationNumber || membership.registrationNumber,
                    vin: membership.vehicleId?.vin || membership.vin,
                    brand: membership.vehicleId?.brand || membership.make,
                    model: membership.vehicleId?.model || membership.model,
                    year: membership.vehicleId?.year || membership.year,
                },
                trackerDetails: {
                    referenceNumber: batch.referenceNumber,
                    batchNumber: batch.batchNumber,
                    type: batch.type,
                    status: batch.status
                },
                status: membership.status,
                derivedStatus: membership.status || (membership.jobCardId ? 'In Service' : (membership.receivedAt ? 'Not Started' : 'Expected')),
                receivedAt: membership.receivedAt,
                inspectedAt: membership.inspectedAt,
                readyForCollectionAt: membership.readyForCollectionAt,
                collectedAt: membership.collectedAt,
                deliveredAt: membership.deliveredAt,
                
                odometer: membership.odometer,
                finalOdometer: membership.finalOdometer,
                complianceStatus: membership.complianceStatus,
                blueSlip: membership.blueSlip,
                pinkSlip: membership.pinkSlip,
                complianceNotes: membership.complianceNotes,

                jobCards,
                invoices
            }
        });

    } catch (error) {
        console.error("Error in getTrackerCarDetail:", error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// ==========================================
// TRACKER CAR DOCUMENTS (READ-ONLY)
// ==========================================

export const getTrackerCarDocuments = async (req, res) => {
    try {
        const { batchId, carId } = req.params;

        const docs = await TrackerCarDocument.find({ 
            membershipId: carId, 
            batchId, 
            customerId: req.user.customerId,
            isActive: true,
            isCustomerVisible: true
        })
        .populate('uploadedBy', 'name')
        .sort('-createdAt');

        res.status(200).json({ success: true, data: docs });
    } catch (error) {
        console.error('Error fetching customer documents:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
