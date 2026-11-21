import express from 'express';
import protect, { authorizeRoles, requirePermission } from '../middleware/auth.js';
import {
    getQuotes,
    getQuoteById,
    getQuoteHistory,
    updateQuoteStatus,
    getMessages,
    getMessageById,
    getMessageHistory,
    updateMessageStatus,
    getBookings,
    getBookingById,
    updateBookingStatus,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    replyToQuote,
    replyToMessage,
    updateQuoteMeta,
    updateMessageMeta,
    updateBookingMeta,
    getCommunicationsSummary,
    addCustomerDetailsToBooking,
    deleteQuote,
    deleteMessage,
    deleteBooking,
    bulkDeleteCommunications
} from '../controllers/communicationsController.js';
import { requirePageAccess } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication + admin/super_admin role
router.use(protect);
router.use(requirePageAccess('communications'));
router.use(authorizeRoles('admin', 'super_admin'));

// Bulk Delete (Placed before parameterized routes to avoid /:id mismatch)
router.post('/bulk-delete', requirePermission('communications.delete'), bulkDeleteCommunications);

// Summary
router.get('/summary', requirePermission('communications.view'), getCommunicationsSummary);

// Quotes
router.get('/quotes', requirePermission('communications.view'), getQuotes);
router.get('/quotes/:id/history', requirePermission('communications.view'), getQuoteHistory);
router.get('/quotes/:id', requirePermission('communications.view'), getQuoteById);
router.put('/quotes/:id/status', requirePermission('communications.edit'), updateQuoteStatus);
router.put('/quotes/:id/meta', requirePermission('communications.edit'), updateQuoteMeta);
router.post('/quotes/:id/reply', requirePermission('communications.reply'), replyToQuote);
router.delete('/quotes/:id', requirePermission('communications.delete'), deleteQuote);

// Messages
router.get('/messages', requirePermission('communications.view'), getMessages);
router.get('/messages/:id/history', requirePermission('communications.view'), getMessageHistory);
router.get('/messages/:id', requirePermission('communications.view'), getMessageById);
router.put('/messages/:id/status', requirePermission('communications.edit'), updateMessageStatus);
router.put('/messages/:id/meta', requirePermission('communications.edit'), updateMessageMeta);
router.post('/messages/:id/reply', requirePermission('communications.reply'), replyToMessage);
router.delete('/messages/:id', requirePermission('communications.delete'), deleteMessage);

// Bookings (Service Requests)
router.get('/bookings', requirePermission('communications.view'), getBookings);
router.get('/bookings/:id', requirePermission('communications.view'), getBookingById);
router.put('/bookings/:id/status', requirePermission('communications.edit'), updateBookingStatus);
router.put('/bookings/:id/meta', requirePermission('communications.edit'), updateBookingMeta);
router.post('/bookings/:id/add-customer-details', requirePermission('communications.edit'), addCustomerDetailsToBooking);
router.delete('/bookings/:id', requirePermission('communications.delete'), deleteBooking);

// Notifications — static routes BEFORE parameterized routes
router.get('/notifications/unread-count', requirePermission('communications.view'), getUnreadCount);
router.put('/notifications/read-all', requirePermission('communications.edit'), markAllNotificationsRead);
router.get('/notifications', requirePermission('communications.view'), getNotifications);
router.put('/notifications/:id/read', requirePermission('communications.edit'), markNotificationRead);

export default router;
