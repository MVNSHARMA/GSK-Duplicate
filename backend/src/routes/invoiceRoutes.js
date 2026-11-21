import express from 'express';
import {
    getInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    sendInvoiceEmail,
    sendConsolidatedInvoiceEmail,
    getInvoiceEmailHistory,
    getInvoiceEmailLogs,
    downloadInvoicePDF,
    cancelOrVoidInvoice,
    getRetentionOverview,
    triggerBatchArchival,
    archiveSingleInvoice,
    reviewInvoiceRetention,
    getQuotesForRetentionReview,
    reviewQuoteRetention,
    getDatabaseBackups,
    triggerDatabaseBackup,
    verifyDatabaseBackup
} from '../controllers/invoiceController.js';

import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and MANAGE_INVOICES permission
router.use(protect);
router.use(requirePageAccess('invoices'));

router.route('/')
    .get(requirePermission('invoices.view'), getInvoices)
    .post(requirePermission('invoices.create'), createInvoice);

// Consolidated multi-invoice email & batch logs (before /:id routes)
router.post('/send-consolidated-email', requirePermission('invoices.email'), sendConsolidatedInvoiceEmail);
router.post('/bulk-email', requirePermission('invoices.email'), sendConsolidatedInvoiceEmail);
router.get('/email-logs', requirePermission('invoices.view'), getInvoiceEmailLogs);

// Data Retention, Archival & Backup Management routes (before /:id routes)
router.get('/retention/overview', requirePermission('invoices.view'), getRetentionOverview);
router.post('/retention/run-archival', requirePermission('invoices.edit'), triggerBatchArchival);
router.get('/retention/quotes', requirePermission('invoices.view'), getQuotesForRetentionReview);
router.post('/retention/quotes/:id/review', requirePermission('invoices.edit'), reviewQuoteRetention);
router.get('/retention/backups', requirePermission('invoices.view'), getDatabaseBackups);
router.post('/retention/backups/create', requirePermission('invoices.edit'), triggerDatabaseBackup);
router.post('/retention/backups/verify', requirePermission('invoices.view'), verifyDatabaseBackup);

router.post('/:id/send-email', requirePermission('invoices.email'), sendInvoiceEmail);
router.get('/:id/email-history', requirePermission('invoices.view'), getInvoiceEmailHistory);
router.get('/:id/pdf', requirePermission('invoices.view'), downloadInvoicePDF);
router.post('/:id/cancel', requirePermission('invoices.edit'), cancelOrVoidInvoice);
router.post('/:id/archive', requirePermission('invoices.edit'), archiveSingleInvoice);
router.post('/:id/retention-review', requirePermission('invoices.edit'), reviewInvoiceRetention);

router.route('/:id')
    .get(requirePermission('invoices.view'), getInvoiceById)
    .put(requirePermission('invoices.edit'), updateInvoice)
    .delete(requirePermission('invoices.delete'), deleteInvoice);

export default router;
