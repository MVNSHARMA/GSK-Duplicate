import express from 'express';
import { requireCustomerUser, requireB2BCustomer } from '../middleware/customerAuth.js';
import protect from '../middleware/auth.js';
import {
    getDashboard,
    getVehicles,
    getVehicleById,
    getJobCards,
    getJobCardById,
    getInvoices,
    getInvoiceById,
    downloadInvoicePDF,
    getBookings,
    getBatches,
    getBatchById,
    getBatchVehicles,
    getBatchFinancialSummary,
    getBatchInvoices,
    getTrackerCarDetail,
    getTrackerCarDocuments,
    getServiceHistory,
    getCustomerJobCardServiceUpdates
} from '../controllers/customerPortalController.js';

const router = express.Router();

// Apply auth and customer validation to all routes in this router
router.use(protect);
router.use(requireCustomerUser);

// Dashboard
router.get('/dashboard', getDashboard);

// Vehicles
router.get('/vehicles', getVehicles);
router.get('/vehicles/:id', getVehicleById);

// Job Cards (Service Records)
router.get('/job-cards', getJobCards);
router.get('/job-cards/:id', getJobCardById);
router.get('/job-cards/:id/service-updates', getCustomerJobCardServiceUpdates);

// Invoices & Payments
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoiceById);
router.get('/invoices/:id/pdf', downloadInvoicePDF);

// Bookings
router.get('/bookings', getBookings);

// Batches (For Fleet/Rental/Import Customers)
router.use('/batches', requireB2BCustomer);
router.get('/batches', getBatches);
router.get('/batches/:id', getBatchById);
router.get('/batches/:id/vehicles', getBatchVehicles);
router.get('/batches/:id/financial-summary', getBatchFinancialSummary);
router.get('/batches/:id/invoices', getBatchInvoices);
router.get('/batches/:batchId/cars/:carId', getTrackerCarDetail);
router.get('/batches/:batchId/cars/:carId/documents', getTrackerCarDocuments);

// Service History
router.get('/service-history', getServiceHistory);

export default router;
