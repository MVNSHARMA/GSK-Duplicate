import mongoose from 'mongoose';
import Quote from '../models/Quote.js';
import Contact from '../models/Contact.js';
import Booking from '../models/Booking.js';
import Notification from '../models/Notification.js';
import JobCard from '../models/JobCard.js';
import RentalServiceEntry from '../models/RentalServiceEntry.js';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import EmailService from '../services/EmailService.js';

import { resolveCustomerIdentity, resolveVehicleIdentity } from '../utils/identityResolver.js';
import { withTransaction } from '../utils/transaction.js';
import AuditLog from '../models/AuditLog.js';
import { escapeRegex } from '../utils/sanitize.js';
import { IMPORT_COMPLIANCE_SERVICE } from '../utils/bookingServices.js';

// In-flight lock to prevent concurrent duplicate sends from double-clicks or rapid retries
const inFlightReplies = new Map();
const DUPLICATE_REPLY_WINDOW_MS = 15000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeReplies = (replies, commId, commType, defaultRecipientEmail, defaultSubject) => {
    if (!Array.isArray(replies)) return [];
    const defaultSenderEmail = process.env.BREVO_SENDER_EMAIL || 'admin@gskautomotive.com';
    return [...replies]
        .map(r => {
            const raw = typeof r?.toObject === 'function' ? r.toObject() : (r || {});
            const sentTime = raw.sentAt || raw.createdAt || new Date();
            const senderName = raw.senderName || raw.authorName || 'GSK Automotive';
            const body = raw.body ?? raw.message ?? '';
            return {
                _id: raw._id,
                communicationId: raw.communicationId || commId,
                communicationType: raw.communicationType || commType,
                senderName,
                senderEmail: raw.senderEmail || defaultSenderEmail,
                authorName: raw.authorName || senderName,
                sentBy: raw.sentBy || null,
                recipientEmail: raw.recipientEmail || defaultRecipientEmail || '',
                subject: raw.subject || defaultSubject || '',
                body,
                message: raw.message ?? body,
                sentAt: sentTime,
                createdAt: raw.createdAt || sentTime,
                brevoMessageId: raw.brevoMessageId || '',
                deliveryStatus: raw.deliveryStatus || 'accepted',
                idempotencyKey: raw.idempotencyKey || null
            };
        })
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
};

const enrichQuoteRecord = (quoteDoc) => {
    if (!quoteDoc) return null;
    const obj = typeof quoteDoc.toObject === 'function' ? quoteDoc.toObject() : { ...quoteDoc };
    const customerName = obj.customerInfo?.fullName || obj.customerId?.name || 'Customer';
    const customerEmail = obj.customerInfo?.email || obj.customerId?.email || '';
    const defaultSubject = 'Re: Your Quote Request at GSK Automotive';
    const normalizedReplies = normalizeReplies(obj.replies, obj._id, 'Quote', customerEmail, defaultSubject);
    obj.replies = normalizedReplies;

    const vehicleDesc = [obj.vehicleInfo?.year, obj.vehicleInfo?.make, obj.vehicleInfo?.model].filter(Boolean).join(' ') || 'Vehicle';
    const originalBody = obj.description
        || (Array.isArray(obj.services) && obj.services.length > 0 ? `Requested services: ${obj.services.join(', ')}` : 'Quote request submitted.');

    const originalEntry = {
        _id: `orig-quote-${obj._id}`,
        communicationId: obj._id,
        communicationType: 'Quote',
        direction: 'inbound',
        senderType: 'customer',
        senderName: customerName,
        senderEmail: customerEmail,
        recipientName: 'GSK Automotive',
        recipientEmail: process.env.BREVO_SENDER_EMAIL || 'admin@gskautomotive.com',
        subject: `Quote Request — ${vehicleDesc} (${obj.vehicleInfo?.regNo || 'N/A'})`,
        body: originalBody,
        message: originalBody,
        services: obj.services || [],
        vehicleInfo: obj.vehicleInfo || {},
        sentAt: obj.createdAt,
        createdAt: obj.createdAt
    };

    const replyEntries = normalizedReplies.map(r => ({
        ...r,
        direction: 'outbound',
        senderType: 'admin',
        recipientName: customerName
    }));

    obj.conversationHistory = [originalEntry, ...replyEntries];
    return obj;
};

const enrichMessageRecord = (msgDoc) => {
    if (!msgDoc) return null;
    const obj = typeof msgDoc.toObject === 'function' ? msgDoc.toObject() : { ...msgDoc };
    const customerName = `${obj.firstName || ''} ${obj.lastName || ''}`.trim() || obj.customerId?.name || 'Customer';
    const customerEmail = obj.email || obj.customerId?.email || '';
    const defaultSubject = `Re: ${obj.subject || 'Your Message to GSK Automotive'}`;
    const normalizedReplies = normalizeReplies(obj.replies, obj._id, 'Message', customerEmail, defaultSubject);
    obj.replies = normalizedReplies;

    const originalEntry = {
        _id: `orig-msg-${obj._id}`,
        communicationId: obj._id,
        communicationType: 'Message',
        direction: 'inbound',
        senderType: 'customer',
        senderName: customerName,
        senderEmail: customerEmail,
        recipientName: 'GSK Automotive',
        recipientEmail: process.env.BREVO_SENDER_EMAIL || 'admin@gskautomotive.com',
        subject: obj.subject || 'Customer Inquiry',
        body: obj.message || '',
        message: obj.message || '',
        sentAt: obj.createdAt,
        createdAt: obj.createdAt
    };

    const replyEntries = normalizedReplies.map(r => ({
        ...r,
        direction: 'outbound',
        senderType: 'admin',
        recipientName: customerName
    }));

    obj.conversationHistory = [originalEntry, ...replyEntries];
    return obj;
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
const applyDateFilter = (filter, datePreset, fromDate, toDate) => {
    const now = new Date();
    switch (datePreset) {
        case 'last_30_days':
            filter.createdAt = { $gte: new Date(now.setDate(now.getDate() - 30)) };
            break;
        case 'last_6_months':
            filter.createdAt = { $gte: new Date(now.setMonth(now.getMonth() - 6)) };
            break;
        case 'last_1_year':
            filter.createdAt = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
            break;
        case 'older_1_year':
            filter.createdAt = { $lt: new Date(now.setFullYear(now.getFullYear() - 1)) };
            break;
        case 'older_3_years':
            filter.createdAt = { $lt: new Date(now.setFullYear(now.getFullYear() - 3)) };
            break;
        case 'older_5_years':
            filter.createdAt = { $lt: new Date(now.setFullYear(now.getFullYear() - 5)) };
            break;
        case 'custom':
            if (fromDate || toDate) {
                filter.createdAt = {};
                if (fromDate) filter.createdAt.$gte = new Date(fromDate);
                if (toDate) filter.createdAt.$lte = new Date(new Date(toDate).setHours(23, 59, 59, 999));
            }
            break;
    }
};

// ─── QUOTES ──────────────────────────────────────────────────────────────────

// @desc    Get all quotes (paginated, searchable, filterable)
// @route   GET /api/communications/quotes
// @access  Private (Admin/Super Admin)
export const getQuotes = async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc', datePreset, fromDate, toDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filter = { isActive: { $ne: false } };
        if (status) filter.status = status;
        applyDateFilter(filter, datePreset, fromDate, toDate);
        if (search) {
            const safeSearch = escapeRegex(search);
            filter.$or = [
                { 'customerInfo.fullName': { $regex: safeSearch, $options: 'i' } },
                { 'customerInfo.email': { $regex: safeSearch, $options: 'i' } },
                { 'customerInfo.phone': { $regex: safeSearch, $options: 'i' } },
                { 'vehicleInfo.make': { $regex: safeSearch, $options: 'i' } },
                { 'vehicleInfo.model': { $regex: safeSearch, $options: 'i' } },
                { 'vehicleInfo.regNo': { $regex: safeSearch, $options: 'i' } }
            ];
        }

        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [quotes, total] = await Promise.all([
            Quote.find(filter)
                .populate('customerId', 'name email phone customerType')
                .populate('vehicleId', 'brand model registrationNumber')
                .populate('assignedTo', 'name email role')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            Quote.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: quotes.map(enrichQuoteRecord),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({ success: false, error: 'Server error fetching quotes' });
    }
};

// @desc    Get single quote by ID
// @route   GET /api/communications/quotes/:id
// @access  Private (Admin/Super Admin)
export const getQuoteById = async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id)
            .populate('customerId', 'name email phone address customerType')
            .populate('vehicleId', 'brand model registrationNumber year mileage')
            .populate('assignedTo', 'name email role');

        if (!quote) {
            return res.status(404).json({ success: false, error: 'Quote not found' });
        }

        res.status(200).json({ success: true, data: enrichQuoteRecord(quote) });
    } catch (error) {
        console.error('Error fetching quote:', error);
        res.status(500).json({ success: false, error: 'Server error fetching quote' });
    }
};

// @desc    Get conversation history for a quote
// @route   GET /api/communications/quotes/:id/history
// @access  Private (Admin/Super Admin)
export const getQuoteHistory = async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id)
            .populate('customerId', 'name email phone address customerType')
            .populate('vehicleId', 'brand model registrationNumber year mileage')
            .populate('assignedTo', 'name email role');

        if (!quote) {
            return res.status(404).json({ success: false, error: 'Quote not found' });
        }

        const enriched = enrichQuoteRecord(quote);
        const historyPayload = {
            communicationId: enriched._id,
            communicationType: 'Quote',
            originalCommunication: enriched.conversationHistory[0],
            replies: enriched.replies,
            conversationHistory: enriched.conversationHistory
        };
        res.status(200).json({
            success: true,
            ...historyPayload,
            data: historyPayload
        });
    } catch (error) {
        console.error('Error fetching quote conversation history:', error);
        res.status(500).json({ success: false, error: 'Server error fetching quote conversation history' });
    }
};

// @desc    Update quote status
// @route   PUT /api/communications/quotes/:id/status
// @access  Private (Admin/Super Admin)
export const updateQuoteStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'In Review', 'Quoted', 'Responded', 'Closed'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const quote = await Quote.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        )
            .populate('customerId', 'name email phone address customerType')
            .populate('vehicleId', 'brand model registrationNumber year mileage')
            .populate('assignedTo', 'name email role');

        if (!quote) {
            return res.status(404).json({ success: false, error: 'Quote not found' });
        }

        res.status(200).json({ success: true, data: enrichQuoteRecord(quote) });
    } catch (error) {
        console.error('Error updating quote status:', error);
        res.status(500).json({ success: false, error: 'Server error updating quote status' });
    }
};

// @desc    Reply to a quote via email and persist reply in conversation log
// @route   POST /api/communications/quotes/:id/reply
// @access  Private (Admin/Super Admin)
export const replyToQuote = async (req, res) => {
    const rawMessage = req.body?.message ?? req.body?.body;
    const trimmedMessage = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    if (!trimmedMessage) {
        return res.status(400).json({ success: false, error: 'Reply message is required' });
    }

    const idempotencyKey = req.body?.idempotencyKey ? String(req.body.idempotencyKey).trim() : null;
    const customSubject = req.body?.subject ? String(req.body.subject).trim() : '';
    const lockKey = `Quote:${req.params.id}:${idempotencyKey || trimmedMessage}`;

    if (inFlightReplies.has(lockKey)) {
        try {
            const existingResult = await inFlightReplies.get(lockKey);
            return res.status(200).json({
                ...existingResult,
                duplicatePrevented: true,
                message: 'Duplicate concurrent reply prevented; returning recorded reply.'
            });
        } catch (_) {
            // Fall through if previous in-flight attempt failed
        }
    }

    let resolveInFlight, rejectInFlight;
    const inFlightPromise = new Promise((resolve, reject) => {
        resolveInFlight = resolve;
        rejectInFlight = reject;
    });
    inFlightPromise.catch(() => {}); // Prevent unhandled rejection warning
    inFlightReplies.set(lockKey, inFlightPromise);

    try {
        const quote = await Quote.findById(req.params.id)
            .populate('customerId', 'name email phone address customerType')
            .populate('vehicleId', 'brand model registrationNumber year mileage')
            .populate('assignedTo', 'name email role');

        if (!quote) {
            inFlightReplies.delete(lockKey);
            return res.status(404).json({ success: false, error: 'Quote not found' });
        }

        const customerEmail = (quote.customerInfo?.email || quote.customerId?.email || '').trim();
        if (!customerEmail || !EMAIL_REGEX.test(customerEmail)) {
            inFlightReplies.delete(lockKey);
            return res.status(400).json({ success: false, error: 'Valid customer email not found' });
        }

        // Check for duplicate retry (by idempotencyKey or identical body within recent window)
        const nowMs = Date.now();
        const existingReply = (quote.replies || []).find(r => {
            if (idempotencyKey && r.idempotencyKey === idempotencyKey) return true;
            if (!req.body?.allowDuplicate && (r.body === trimmedMessage || r.message === trimmedMessage)) {
                const sentTime = new Date(r.sentAt || r.createdAt || 0).getTime();
                if (nowMs - sentTime < DUPLICATE_REPLY_WINDOW_MS) return true;
            }
            return false;
        });

        if (existingReply) {
            const enrichedExisting = enrichQuoteRecord(quote);
            const matchedFormatted = enrichedExisting.replies.find(
                r => String(r._id) === String(existingReply._id)
            ) || enrichedExisting.replies[enrichedExisting.replies.length - 1];
            const payload = {
                success: true,
                duplicatePrevented: true,
                message: 'Duplicate reply request ignored; existing reply returned.',
                reply: matchedFormatted,
                data: enrichedExisting,
                replies: enrichedExisting.replies,
                conversationHistory: enrichedExisting.conversationHistory
            };
            resolveInFlight(payload);
            return res.status(200).json(payload);
        }

        const customerName = quote.customerInfo?.fullName || quote.customerId?.name || 'Customer';
        const replySubject = customSubject || 'Re: Your Quote Request at GSK Automotive';

        let emailResult;
        try {
            emailResult = await EmailService.sendAdminReply(
                customerEmail,
                customerName,
                replySubject,
                quote.description || '',
                trimmedMessage,
                { sandbox: Boolean(req.body?.sandbox) }
            );
        } catch (emailError) {
            console.error('Failed to send quote reply email via Brevo:', emailError.message);
            rejectInFlight(emailError);
            return res.status(500).json({
                success: false,
                emailSent: false,
                logSaved: false,
                error: 'Failed to send email via Brevo. Reply was not logged as sent.'
            });
        }

        const adminSenderName = req.user?.name
            ? `${req.user.name} (GSK Automotive)`
            : (emailResult?.senderName || 'GSK Automotive');
        const senderEmail = emailResult?.senderEmail || process.env.BREVO_SENDER_EMAIL || req.user?.email || 'admin@gskautomotive.com';
        const sentTimestamp = new Date();

        const newReplyEntry = {
            communicationId: quote._id,
            communicationType: 'Quote',
            senderName: adminSenderName,
            senderEmail,
            authorName: req.user?.name || 'GSK Automotive',
            sentBy: req.user?._id || null,
            recipientEmail: customerEmail,
            subject: replySubject,
            body: trimmedMessage,
            message: trimmedMessage,
            sentAt: sentTimestamp,
            createdAt: sentTimestamp,
            brevoMessageId: emailResult?.messageId || '',
            deliveryStatus: emailResult?.deliveryStatus || 'accepted',
            idempotencyKey
        };

        try {
            if (!Array.isArray(quote.replies)) {
                quote.replies = [];
            }
            quote.replies.push(newReplyEntry);

            if (['Pending', 'In Review'].includes(quote.status)) {
                quote.status = 'Responded';
            }

            await quote.save();
        } catch (dbError) {
            console.error(`[CRITICAL PARTIAL FAILURE] Brevo accepted quote reply (${emailResult?.messageId || 'no-id'}) for Quote ${quote._id}, but MongoDB persistence failed:`, dbError);
            rejectInFlight(dbError);
            return res.status(500).json({
                success: false,
                partialFailure: true,
                emailSent: true,
                logSaved: false,
                deliveryStatus: 'accepted',
                brevoMessageId: emailResult?.messageId || '',
                error: 'Email was accepted by Brevo, but saving the reply to the conversation log failed. Please refresh before retrying to avoid duplicate emails.',
                details: dbError.message
            });
        }

        const enriched = enrichQuoteRecord(quote);
        const savedReply = enriched.replies[enriched.replies.length - 1];
        const responsePayload = {
            success: true,
            emailSent: true,
            logSaved: true,
            message: 'Reply accepted by Brevo and saved to conversation log',
            reply: savedReply,
            data: enriched,
            replies: enriched.replies,
            conversationHistory: enriched.conversationHistory
        };

        resolveInFlight(responsePayload);
        return res.status(200).json(responsePayload);
    } catch (error) {
        console.error('Error replying to quote:', error);
        rejectInFlight(error);
        return res.status(500).json({ success: false, error: 'Failed to process reply' });
    } finally {
        inFlightReplies.delete(lockKey);
    }
};


// ─── MESSAGES (CONTACTS) ─────────────────────────────────────────────────────

// @desc    Get all messages (paginated, searchable, filterable)
// @route   GET /api/communications/messages
// @access  Private (Admin/Super Admin)
export const getMessages = async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc', datePreset, fromDate, toDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filter = { isActive: { $ne: false } };
        if (status) filter.status = status;
        applyDateFilter(filter, datePreset, fromDate, toDate);
        if (search) {
            const safeSearch = escapeRegex(search);
            filter.$or = [
                { firstName: { $regex: safeSearch, $options: 'i' } },
                { lastName: { $regex: safeSearch, $options: 'i' } },
                { email: { $regex: safeSearch, $options: 'i' } },
                { subject: { $regex: safeSearch, $options: 'i' } },
                { message: { $regex: safeSearch, $options: 'i' } }
            ];
        }

        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [messages, total] = await Promise.all([
            Contact.find(filter)
                .populate('customerId', 'name email phone customerType')
                .populate('assignedTo', 'name email role')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            Contact.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: messages.map(enrichMessageRecord),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, error: 'Server error fetching messages' });
    }
};

// @desc    Get single message by ID
// @route   GET /api/communications/messages/:id
// @access  Private (Admin/Super Admin)
export const getMessageById = async (req, res) => {
    try {
        const message = await Contact.findById(req.params.id)
            .populate('customerId', 'name email phone address customerType')
            .populate('assignedTo', 'name email role');

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        res.status(200).json({ success: true, data: enrichMessageRecord(message) });
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ success: false, error: 'Server error fetching message' });
    }
};

// @desc    Get conversation history for a message
// @route   GET /api/communications/messages/:id/history
// @access  Private (Admin/Super Admin)
export const getMessageHistory = async (req, res) => {
    try {
        const message = await Contact.findById(req.params.id)
            .populate('customerId', 'name email phone address customerType')
            .populate('assignedTo', 'name email role');

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        const enriched = enrichMessageRecord(message);
        const historyPayload = {
            communicationId: enriched._id,
            communicationType: 'Message',
            originalCommunication: enriched.conversationHistory[0],
            replies: enriched.replies,
            conversationHistory: enriched.conversationHistory
        };
        res.status(200).json({
            success: true,
            ...historyPayload,
            data: historyPayload
        });
    } catch (error) {
        console.error('Error fetching message conversation history:', error);
        res.status(500).json({ success: false, error: 'Server error fetching message conversation history' });
    }
};

// @desc    Update message status (Read/Unread/Replied)
// @route   PUT /api/communications/messages/:id/status
// @access  Private (Admin/Super Admin)
export const updateMessageStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Unread', 'Read', 'Replied'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const messageRecord = await Contact.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        )
            .populate('customerId', 'name email phone address customerType')
            .populate('assignedTo', 'name email role');

        if (!messageRecord) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        res.status(200).json({ success: true, data: enrichMessageRecord(messageRecord) });
    } catch (error) {
        console.error('Error updating message status:', error);
        res.status(500).json({ success: false, error: 'Server error updating message status' });
    }
};

// @desc    Reply to a message via email and persist reply in conversation log
// @route   POST /api/communications/messages/:id/reply
// @access  Private (Admin/Super Admin)
export const replyToMessage = async (req, res) => {
    const rawMessage = req.body?.message ?? req.body?.body;
    const trimmedMessage = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    if (!trimmedMessage) {
        return res.status(400).json({ success: false, error: 'Reply message is required' });
    }

    const idempotencyKey = req.body?.idempotencyKey ? String(req.body.idempotencyKey).trim() : null;
    const customSubject = req.body?.subject ? String(req.body.subject).trim() : '';
    const lockKey = `Message:${req.params.id}:${idempotencyKey || trimmedMessage}`;

    if (inFlightReplies.has(lockKey)) {
        try {
            const existingResult = await inFlightReplies.get(lockKey);
            return res.status(200).json({
                ...existingResult,
                duplicatePrevented: true,
                message: 'Duplicate concurrent reply prevented; returning recorded reply.'
            });
        } catch (_) {
            // Fall through if previous in-flight attempt failed
        }
    }

    let resolveInFlight, rejectInFlight;
    const inFlightPromise = new Promise((resolve, reject) => {
        resolveInFlight = resolve;
        rejectInFlight = reject;
    });
    inFlightPromise.catch(() => {}); // Prevent unhandled rejection warning
    inFlightReplies.set(lockKey, inFlightPromise);

    try {
        const msgRecord = await Contact.findById(req.params.id)
            .populate('customerId', 'name email phone address customerType')
            .populate('assignedTo', 'name email role');

        if (!msgRecord) {
            inFlightReplies.delete(lockKey);
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        const recipientEmail = (msgRecord.email || msgRecord.customerId?.email || '').trim();
        if (!recipientEmail || !EMAIL_REGEX.test(recipientEmail)) {
            inFlightReplies.delete(lockKey);
            return res.status(400).json({ success: false, error: 'Valid customer email not found' });
        }

        // Check for duplicate retry (by idempotencyKey or identical body within recent window)
        const nowMs = Date.now();
        const existingReply = (msgRecord.replies || []).find(r => {
            if (idempotencyKey && r.idempotencyKey === idempotencyKey) return true;
            if (!req.body?.allowDuplicate && (r.body === trimmedMessage || r.message === trimmedMessage)) {
                const sentTime = new Date(r.sentAt || r.createdAt || 0).getTime();
                if (nowMs - sentTime < DUPLICATE_REPLY_WINDOW_MS) return true;
            }
            return false;
        });

        if (existingReply) {
            const enrichedExisting = enrichMessageRecord(msgRecord);
            const matchedFormatted = enrichedExisting.replies.find(
                r => String(r._id) === String(existingReply._id)
            ) || enrichedExisting.replies[enrichedExisting.replies.length - 1];
            const payload = {
                success: true,
                duplicatePrevented: true,
                message: 'Duplicate reply request ignored; existing reply returned.',
                reply: matchedFormatted,
                data: enrichedExisting,
                replies: enrichedExisting.replies,
                conversationHistory: enrichedExisting.conversationHistory
            };
            resolveInFlight(payload);
            return res.status(200).json(payload);
        }

        const customerName = `${msgRecord.firstName || ''} ${msgRecord.lastName || ''}`.trim() || msgRecord.customerId?.name || 'Customer';
        const replySubject = customSubject || `Re: ${msgRecord.subject || 'Your Message to GSK Automotive'}`;

        let emailResult;
        try {
            emailResult = await EmailService.sendAdminReply(
                recipientEmail,
                msgRecord.firstName || customerName,
                replySubject,
                msgRecord.message,
                trimmedMessage,
                { sandbox: Boolean(req.body?.sandbox) }
            );
        } catch (emailError) {
            console.error('Failed to send message reply email via Brevo:', emailError.message);
            rejectInFlight(emailError);
            return res.status(500).json({
                success: false,
                emailSent: false,
                logSaved: false,
                error: 'Failed to send email via Brevo. Reply was not logged as sent.'
            });
        }

        const adminSenderName = req.user?.name
            ? `${req.user.name} (GSK Automotive)`
            : (emailResult?.senderName || 'GSK Automotive');
        const senderEmail = emailResult?.senderEmail || process.env.BREVO_SENDER_EMAIL || req.user?.email || 'admin@gskautomotive.com';
        const sentTimestamp = new Date();

        const newReplyEntry = {
            communicationId: msgRecord._id,
            communicationType: 'Message',
            senderName: adminSenderName,
            senderEmail,
            authorName: req.user?.name || 'GSK Automotive',
            sentBy: req.user?._id || null,
            recipientEmail,
            subject: replySubject,
            body: trimmedMessage,
            message: trimmedMessage,
            sentAt: sentTimestamp,
            createdAt: sentTimestamp,
            brevoMessageId: emailResult?.messageId || '',
            deliveryStatus: emailResult?.deliveryStatus || 'accepted',
            idempotencyKey
        };

        try {
            if (!Array.isArray(msgRecord.replies)) {
                msgRecord.replies = [];
            }
            msgRecord.replies.push(newReplyEntry);

            if (['Unread', 'Read'].includes(msgRecord.status)) {
                msgRecord.status = 'Replied';
            }

            await msgRecord.save();
        } catch (dbError) {
            console.error(`[CRITICAL PARTIAL FAILURE] Brevo accepted message reply (${emailResult?.messageId || 'no-id'}) for Message ${msgRecord._id}, but MongoDB persistence failed:`, dbError);
            rejectInFlight(dbError);
            return res.status(500).json({
                success: false,
                partialFailure: true,
                emailSent: true,
                logSaved: false,
                deliveryStatus: 'accepted',
                brevoMessageId: emailResult?.messageId || '',
                error: 'Email was accepted by Brevo, but saving the reply to the conversation log failed. Please refresh before retrying to avoid duplicate emails.',
                details: dbError.message
            });
        }

        const enriched = enrichMessageRecord(msgRecord);
        const savedReply = enriched.replies[enriched.replies.length - 1];
        const responsePayload = {
            success: true,
            emailSent: true,
            logSaved: true,
            message: 'Reply accepted by Brevo and saved to conversation log',
            reply: savedReply,
            data: enriched,
            replies: enriched.replies,
            conversationHistory: enriched.conversationHistory
        };

        resolveInFlight(responsePayload);
        return res.status(200).json(responsePayload);
    } catch (error) {
        console.error('Error replying to message:', error);
        rejectInFlight(error);
        return res.status(500).json({ success: false, error: 'Failed to process reply' });
    } finally {
        inFlightReplies.delete(lockKey);
    }
};


// ─── SERVICE REQUESTS (BOOKINGS) ─────────────────────────────────────────────

// @desc    Get all bookings (paginated, searchable, filterable)
// @route   GET /api/communications/bookings
// @access  Private (Admin/Super Admin)
export const getBookings = async (req, res) => {
    try {
        const { page = 1, limit = 15, search = '', status = '', sortBy = 'createdAt', sortOrder = 'desc', serviceType = '', datePreset, fromDate, toDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const filter = { isActive: { $ne: false } };
        if (status) filter.status = status;
        applyDateFilter(filter, datePreset, fromDate, toDate);
        if (serviceType) {
            if (serviceType === 'Pink Slip') {
                filter.services = 'Pink Slip';
            } else if (serviceType === 'Blue Slip') {
                filter.services = 'Blue Slip';
            } else if (serviceType === IMPORT_COMPLIANCE_SERVICE) {
                filter.services = IMPORT_COMPLIANCE_SERVICE;
            } else if (serviceType === 'Other') {
                filter.services = { $nin: ['Pink Slip', 'Blue Slip', IMPORT_COMPLIANCE_SERVICE] };
            }
        }
        if (search) {
            const safeSearch = escapeRegex(search);
            filter.$or = [
                { 'customerInfo.firstName': { $regex: safeSearch, $options: 'i' } },
                { 'customerInfo.lastName': { $regex: safeSearch, $options: 'i' } },
                { 'customerInfo.email': { $regex: safeSearch, $options: 'i' } },
                { 'customerInfo.phone': { $regex: safeSearch, $options: 'i' } },
                { 'vehicleInfo.make': { $regex: safeSearch, $options: 'i' } },
                { 'vehicleInfo.model': { $regex: safeSearch, $options: 'i' } },
                { 'vehicleInfo.regNo': { $regex: safeSearch, $options: 'i' } }
            ];
        }

        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [bookings, total] = await Promise.all([
            Booking.find(filter)
                .populate('customerId', 'name email phone customerType')
                .populate('vehicleId', 'brand model registrationNumber')
                .populate('assignedTo', 'name email role')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            Booking.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: bookings,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ success: false, error: 'Server error fetching bookings' });
    }
};

// @desc    Get single booking by ID
// @route   GET /api/communications/bookings/:id
// @access  Private (Admin/Super Admin)
export const getBookingById = async (req, res) => {
    try {
        const bookingDoc = await Booking.findById(req.params.id)
            .populate('customerId', 'name email phone address customerType')
            .populate('vehicleId', 'brand model registrationNumber year mileage')
            .populate('assignedTo', 'name email role');

        if (!bookingDoc) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        const booking = bookingDoc.toObject();
        
        // If the populated document didn't exist, Mongoose might leave it as null
        // Ensure we explicitly set it to null so the frontend knows it's unlinked
        if (!booking.customerId) booking.customerId = null;
        if (!booking.vehicleId) booking.vehicleId = null;

        // Look up associated Job Card (not trashed/inactive)
        const jobCard = await JobCard.findOne({ bookingId: booking._id, isActive: true })
            .select('status createdAt jobCardNumber');
            
        if (jobCard) {
            booking.jobCard = jobCard;
        }

        res.status(200).json({ success: true, data: booking });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ success: false, error: 'Server error fetching booking' });
    }
};

// @desc    Update booking status
// @route   PUT /api/communications/bookings/:id/status
// @access  Private (Admin/Super Admin)
export const updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        res.status(200).json({ success: true, data: booking });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ success: false, error: 'Server error updating booking status' });
    }
};


// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

/**
 * Authoritative mapping from UI filter categories to Notification `type` / `relatedModel`.
 * Only categories backed by actual Notification records in the application are exposed.
 */
const NOTIFICATION_CATEGORY_MAP = {
    bookings: {
        types: ['new_booking', 'booking_update'],
        relatedModels: ['Booking']
    },
    job_cards: {
        types: ['job_review', 'job_completed'],
        relatedModels: ['JobCard']
    },
    rentals: {
        types: ['rental_update'],
        relatedModels: ['RentalServiceEntry']
    },
    communications: {
        types: ['new_quote', 'new_message'],
        relatedModels: ['Quote', 'Contact']
    },
    system: {
        types: ['system'],
        relatedModels: []
    }
};

const resolveNotificationCategory = (notif) => {
    if (!notif) return 'system';
    for (const [cat, cfg] of Object.entries(NOTIFICATION_CATEGORY_MAP)) {
        if (cat === 'system') continue;
        if (cfg.types.includes(notif.type) || (notif.relatedModel && cfg.relatedModels.includes(notif.relatedModel))) {
            return cat;
        }
    }
    return 'system';
};

// @desc    Get notifications (paginated, category/read/search filterable)
// @route   GET /api/communications/notifications
// @access  Private (Admin/Super Admin)
export const getNotifications = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            isRead = '',
            type = '',
            category = '',
            search = ''
        } = req.query;

        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (safePage - 1) * safeLimit;

        const andConditions = [];

        if (isRead === 'true') andConditions.push({ isRead: true });
        else if (isRead === 'false') andConditions.push({ isRead: false });

        if (type) {
            andConditions.push({ type });
        }

        const normalizedCategory = String(category || '').trim().toLowerCase();
        if (normalizedCategory && normalizedCategory !== 'all') {
            const catConfig = NOTIFICATION_CATEGORY_MAP[normalizedCategory];
            if (!catConfig) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    pagination: { total: 0, page: safePage, limit: safeLimit, pages: 0 }
                });
            }
            if (normalizedCategory === 'system') {
                andConditions.push({
                    type: 'system',
                    $or: [{ relatedModel: null }, { relatedModel: { $exists: false } }]
                });
            } else {
                andConditions.push({
                    $or: [
                        { type: { $in: catConfig.types } },
                        { relatedModel: { $in: catConfig.relatedModels } }
                    ]
                });
            }
        }

        const trimmedSearch = String(search || '').trim();
        if (trimmedSearch) {
            const safeSearch = escapeRegex(trimmedSearch);
            const searchOr = [
                { title: { $regex: safeSearch, $options: 'i' } },
                { message: { $regex: safeSearch, $options: 'i' } },
                { 'metadata.customerName': { $regex: safeSearch, $options: 'i' } },
                { 'metadata.jobCardNumber': { $regex: safeSearch, $options: 'i' } },
                { 'metadata.bookingReference': { $regex: safeSearch, $options: 'i' } },
                { 'metadata.invoiceNumber': { $regex: safeSearch, $options: 'i' } },
                { 'metadata.reference': { $regex: safeSearch, $options: 'i' } },
                { 'metadata.vehicleDetails': { $regex: safeSearch, $options: 'i' } }
            ];

            if (mongoose.Types.ObjectId.isValid(trimmedSearch)) {
                searchOr.push({ relatedId: new mongoose.Types.ObjectId(trimmedSearch) });
            }

            // Also match related records (customer name, bookingReference, JC-XXXX, quote/contact)
            const jcMatch = trimmedSearch.toUpperCase().startsWith('JC-')
                ? escapeRegex(trimmedSearch.substring(3))
                : safeSearch;

            const matchingCustomers = await Customer.find({
                name: { $regex: safeSearch, $options: 'i' }
            }).distinct('_id');

            const [bookingIds, quoteIds, contactIds, jobCardIds, rentalIds] = await Promise.all([
                Booking.find({
                    $or: [
                        { bookingReference: { $regex: safeSearch, $options: 'i' } },
                        { 'customerInfo.firstName': { $regex: safeSearch, $options: 'i' } },
                        { 'customerInfo.lastName': { $regex: safeSearch, $options: 'i' } },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $concat: [{ $ifNull: ['$customerInfo.firstName', ''] }, ' ', { $ifNull: ['$customerInfo.lastName', ''] }] },
                                    regex: safeSearch,
                                    options: 'i'
                                }
                            }
                        },
                        { 'vehicleInfo.regNo': { $regex: safeSearch, $options: 'i' } },
                        ...(matchingCustomers.length ? [{ customerId: { $in: matchingCustomers } }] : [])
                    ]
                }).distinct('_id'),
                Quote.find({
                    $or: [
                        { 'customerInfo.fullName': { $regex: safeSearch, $options: 'i' } },
                        { 'vehicleInfo.regNo': { $regex: safeSearch, $options: 'i' } },
                        ...(matchingCustomers.length ? [{ customerId: { $in: matchingCustomers } }] : [])
                    ]
                }).distinct('_id'),
                Contact.find({
                    $or: [
                        { firstName: { $regex: safeSearch, $options: 'i' } },
                        { lastName: { $regex: safeSearch, $options: 'i' } },
                        {
                            $expr: {
                                $regexMatch: {
                                    input: { $concat: [{ $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] }] },
                                    regex: safeSearch,
                                    options: 'i'
                                }
                            }
                        },
                        { subject: { $regex: safeSearch, $options: 'i' } },
                        ...(matchingCustomers.length ? [{ customerId: { $in: matchingCustomers } }] : [])
                    ]
                }).distinct('_id'),
                JobCard.find({
                    $or: [
                        { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: jcMatch, options: 'i' } } },
                        ...(matchingCustomers.length ? [{ customerId: { $in: matchingCustomers } }] : [])
                    ]
                }).distinct('_id'),
                matchingCustomers.length
                    ? RentalServiceEntry.find({ customerId: { $in: matchingCustomers } }).distinct('_id')
                    : Promise.resolve([])
            ]);

            if (bookingIds.length) searchOr.push({ relatedModel: 'Booking', relatedId: { $in: bookingIds } });
            if (quoteIds.length) searchOr.push({ relatedModel: 'Quote', relatedId: { $in: quoteIds } });
            if (contactIds.length) searchOr.push({ relatedModel: 'Contact', relatedId: { $in: contactIds } });
            if (jobCardIds.length) searchOr.push({ relatedModel: 'JobCard', relatedId: { $in: jobCardIds } });
            if (rentalIds.length) searchOr.push({ relatedModel: 'RentalServiceEntry', relatedId: { $in: rentalIds } });

            andConditions.push({ $or: searchOr });
        }

        const filter = andConditions.length > 0 ? { $and: andConditions } : {};

        const [rawNotifications, total] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean(),
            Notification.countDocuments(filter)
        ]);

        // Enrich booking notifications that lack metadata.bookingReference with a compact reference
        const bookingRelatedIds = rawNotifications
            .filter(n => n.relatedModel === 'Booking' && n.relatedId && !n.metadata?.bookingReference)
            .map(n => n.relatedId);

        let bookingRefMap = new Map();
        if (bookingRelatedIds.length > 0) {
            const bookings = await Booking.find({ _id: { $in: bookingRelatedIds } })
                .select('bookingReference')
                .lean();
            bookingRefMap = new Map(bookings.map(b => [String(b._id), b.bookingReference || '']));
        }

        const notifications = rawNotifications.map(n => {
            let relatedReference = n.metadata?.jobCardNumber || n.metadata?.bookingReference || n.metadata?.reference || '';
            if (!relatedReference && n.relatedModel === 'Booking' && n.relatedId) {
                relatedReference = bookingRefMap.get(String(n.relatedId)) || '';
            } else if (!relatedReference && n.relatedModel === 'JobCard' && n.relatedId) {
                relatedReference = `JC-${String(n.relatedId).slice(-4).toUpperCase()}`;
            }
            return {
                ...n,
                category: resolveNotificationCategory(n),
                relatedReference: relatedReference || null
            };
        });

        res.status(200).json({
            success: true,
            data: notifications,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                pages: Math.ceil(total / safeLimit)
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: 'Server error fetching notifications' });
    }
};

// @desc    Mark single notification as read
// @route   PUT /api/communications/notifications/:id/read
// @access  Private (Admin/Super Admin)
export const markNotificationRead = async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }

        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        console.error('Error marking notification:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/communications/notifications/read-all
// @access  Private (Admin/Super Admin)
export const markAllNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany({ isRead: false }, { isRead: true });
        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// @desc    Get unread notification count (and latest notification to avoid a second polling roundtrip)
// @route   GET /api/communications/notifications/unread-count
// @access  Private (Admin/Super Admin)
export const getUnreadCount = async (req, res) => {
    try {
        const [count, latestNotification] = await Promise.all([
            Notification.countDocuments({ isRead: false }),
            Notification.findOne({})
                .sort({ createdAt: -1, _id: -1 })
                .select('_id title message type relatedModel relatedId isRead metadata createdAt')
                .lean()
        ]);
        res.status(200).json({ success: true, count, latestNotification: latestNotification || null });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

// @desc    Get communications summary counts for dashboard
// @route   GET /api/communications/summary
// @access  Private (Admin/Super Admin)
export const getCommunicationsSummary = async (req, res) => {
    try {
        const [newQuotes, unreadMessages, pendingBookings, unreadNotifications, pinkSlipRequests, blueSlipRequests, importComplianceRequests, otherServiceRequests] = await Promise.all([
            Quote.countDocuments({ status: 'Pending', isActive: { $ne: false } }),
            Contact.countDocuments({ status: 'Unread', isActive: { $ne: false } }),
            Booking.countDocuments({ status: 'Pending', isActive: { $ne: false } }),
            Notification.countDocuments({ isRead: false }),
            Booking.countDocuments({ services: 'Pink Slip', isActive: { $ne: false } }),
            Booking.countDocuments({ services: 'Blue Slip', isActive: { $ne: false } }),
            Booking.countDocuments({ services: IMPORT_COMPLIANCE_SERVICE, isActive: { $ne: false } }),
            Booking.countDocuments({ services: { $nin: ['Pink Slip', 'Blue Slip', IMPORT_COMPLIANCE_SERVICE] }, isActive: { $ne: false } })
        ]);

        res.status(200).json({
            success: true,
            data: {
                newQuotes,
                unreadMessages,
                pendingBookings,
                unreadNotifications,
                pinkSlipRequests,
                blueSlipRequests,
                importComplianceRequests,
                otherServiceRequests
            }
        });
    } catch (error) {
        console.error('Error fetching communications summary:', error);
        res.status(500).json({ success: false, error: 'Server error fetching summary' });
    }
};

// @desc    Update quote metadata (internal notes and assignment)
// @route   PUT /api/communications/quotes/:id/meta
// @access  Private (Admin/Super Admin)
export const updateQuoteMeta = async (req, res) => {
    try {
        const { internalNotes, assignedTo } = req.body;
        const updateData = {};
        
        if (internalNotes !== undefined) {
            updateData.internalNotes = internalNotes;
        }

        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateData.assignedTo = null;
            } else {
                const user = await User.findOne({ _id: assignedTo, status: 'active', role: { $in: ['admin', 'super_admin', 'mechanic'] } });
                if (!user) {
                    return res.status(400).json({ success: false, error: 'Invalid or inactive assigned user.' });
                }
                updateData.assignedTo = assignedTo;
            }
        }

        const quote = await Quote.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('customerId', 'name email phone address customerType')
            .populate('vehicleId', 'brand model registrationNumber year mileage')
            .populate('assignedTo', 'name email role');

        if (!quote) {
            return res.status(404).json({ success: false, error: 'Quote not found' });
        }

        res.status(200).json({ success: true, data: enrichQuoteRecord(quote) });
    } catch (error) {
        console.error('Error updating quote metadata:', error);
        res.status(500).json({ success: false, error: 'Server error updating quote metadata' });
    }
};

// @desc    Update message metadata (internal notes and assignment)
// @route   PUT /api/communications/messages/:id/meta
// @access  Private (Admin/Super Admin)
export const updateMessageMeta = async (req, res) => {
    try {
        const { internalNotes, assignedTo } = req.body;
        const updateData = {};
        
        if (internalNotes !== undefined) {
            updateData.internalNotes = internalNotes;
        }

        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateData.assignedTo = null;
            } else {
                const user = await User.findOne({ _id: assignedTo, status: 'active', role: { $in: ['admin', 'super_admin', 'mechanic'] } });
                if (!user) {
                    return res.status(400).json({ success: false, error: 'Invalid or inactive assigned user.' });
                }
                updateData.assignedTo = assignedTo;
            }
        }

        const message = await Contact.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('customerId', 'name email phone address customerType')
            .populate('assignedTo', 'name email role');

        if (!message) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        res.status(200).json({ success: true, data: enrichMessageRecord(message) });
    } catch (error) {
        console.error('Error updating message metadata:', error);
        res.status(500).json({ success: false, error: 'Server error updating message metadata' });
    }
};

// @desc    Update booking metadata (internal notes and assignment)
// @route   PUT /api/communications/bookings/:id/meta
// @access  Private (Admin/Super Admin)
export const updateBookingMeta = async (req, res) => {
    try {
        const { internalNotes, assignedTo } = req.body;
        const updateData = {};
        
        if (internalNotes !== undefined) {
            updateData.internalNotes = internalNotes;
        }

        if (assignedTo !== undefined) {
            if (assignedTo === null || assignedTo === '') {
                updateData.assignedTo = null;
            } else {
                const user = await User.findOne({ _id: assignedTo, status: 'active', role: { $in: ['admin', 'super_admin', 'mechanic'] } });
                if (!user) {
                    return res.status(400).json({ success: false, error: 'Invalid or inactive assigned user.' });
                }
                updateData.assignedTo = assignedTo;
            }
        }

        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'name email role');

        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        res.status(200).json({ success: true, data: booking });
    } catch (error) {
        console.error('Error updating booking metadata:', error);
        res.status(500).json({ success: false, error: 'Server error updating booking metadata' });
    }
};

// @desc    Add Customer Details from a Service Request (Find or Create Customer/Vehicle)
// @route   POST /api/communications/bookings/:id/add-customer-details
// @access  Private (Admin/Super Admin)
export const addCustomerDetailsToBooking = async (req, res) => {
    try {
        const { customerId, vehicleId, createCustomer, createVehicle } = req.body;
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Service Request not found' });
        }

        const updatedBooking = await withTransaction(async (session) => {
            let finalCustomerId = booking.customerId || customerId;
            let finalVehicleId = booking.vehicleId || vehicleId;

            // 1. Process Customer
            if (!finalCustomerId && createCustomer && booking.customerInfo) {
                // Duplicate check
                const existingCust = await Customer.findOne({
                    $or: [
                        { email: booking.customerInfo.email?.toLowerCase() },
                        { phone: booking.customerInfo.phone }
                    ]
                }).session(session);

                if (existingCust) {
                    throw new Error('A customer with this email or phone already exists. Please search and link them instead.');
                }

                const newCustomer = new Customer({
                    name: `${booking.customerInfo.firstName} ${booking.customerInfo.lastName}`.trim(),
                    email: booking.customerInfo.email?.toLowerCase(),
                    phone: booking.customerInfo.phone,
                    customerType: 'regular'
                });
                await newCustomer.save({ session });
                finalCustomerId = newCustomer._id;
                
                await AuditLog.create([{
                    actor: req.user?._id || null,
                    action: 'CREATE_CUSTOMER',
                    description: 'Customer created from Service Request',
                    target: newCustomer._id.toString(),
                    metadata: { name: newCustomer.name, bookingId: booking._id },
                    ipAddress: req.ip
                }], { session });
            }

            // 2. Process Vehicle
            if (!finalVehicleId && createVehicle && booking.vehicleInfo) {
                if (!finalCustomerId) {
                    throw new Error('Customer must be linked or created before creating a vehicle.');
                }
                
                // Duplicate check based on Rego or VIN
                const query = [];
                if (booking.vehicleInfo.regNo) query.push({ registrationNumber: booking.vehicleInfo.regNo.toUpperCase() });
                if (booking.vehicleInfo.vin) query.push({ vin: booking.vehicleInfo.vin.toUpperCase() });
                
                if (query.length > 0) {
                    const existingVeh = await Vehicle.findOne({ $or: query }).session(session);
                    if (existingVeh) {
                        throw new Error('A vehicle with this Registration or VIN already exists. Please search and link it instead.');
                    }
                }

                const newVehicle = new Vehicle({
                    customerId: finalCustomerId,
                    brand: booking.vehicleInfo.brand || booking.vehicleInfo.make || 'Unknown',
                    model: booking.vehicleInfo.model || 'Unknown',
                    year: booking.vehicleInfo.year,
                    registrationNumber: booking.vehicleInfo.regNo ? booking.vehicleInfo.regNo.toUpperCase() : undefined,
                    vin: booking.vehicleInfo.vin ? booking.vehicleInfo.vin.toUpperCase() : undefined,
                    mileage: booking.vehicleInfo.kilometers,
                    transmission: booking.vehicleInfo.transmission,
                    fuelType: booking.vehicleInfo.fuelType
                });
                await newVehicle.save({ session });
                finalVehicleId = newVehicle._id;
                
                await AuditLog.create([{
                    actor: req.user?._id || null,
                    action: 'CREATE_VEHICLE',
                    description: 'Vehicle created from Service Request',
                    target: newVehicle._id.toString(),
                    metadata: { regNo: newVehicle.registrationNumber, bookingId: booking._id },
                    ipAddress: req.ip
                }], { session });
            }

            if (finalCustomerId) booking.customerId = finalCustomerId;
            if (finalVehicleId) booking.vehicleId = finalVehicleId;

            // Optional: Mark as confirmed/processed if linked
            if (finalCustomerId && finalVehicleId && booking.status === 'Pending') {
                booking.status = 'Confirmed';
            }

            await booking.save({ session });
            
            await AuditLog.create([{
                actor: req.user?._id || null,
                action: 'UPDATE_BOOKING',
                description: 'Service Request Processed & Linked',
                target: booking._id.toString(),
                metadata: { customerId: finalCustomerId, vehicleId: finalVehicleId },
                ipAddress: req.ip
            }], { session });

            return await Booking.findById(booking._id)
                .populate('customerId', 'name email phone customerType')
                .populate('vehicleId', 'brand model registrationNumber year')
                .session(session);
        });

        res.status(200).json({ success: true, data: updatedBooking, message: 'Request processed and linked successfully.' });
    } catch (error) {
        console.error('Error processing service request:', error);
        res.status(400).json({ success: false, error: error.message || 'Server error processing request' });
    }
};

// ─── DELETION ────────────────────────────────────────────────────────────────

// @desc    Soft delete a quote
// @route   DELETE /api/communications/quotes/:id
// @access  Private (Admin/Super Admin)
export const deleteQuote = async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id);
        if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });
        if (!quote.isActive) return res.status(400).json({ success: false, error: 'Quote is already deleted' });

        quote.isActive = false;
        await quote.save();

        res.status(200).json({ success: true, message: 'Quote moved to trash' });
    } catch (error) {
        console.error('Error deleting quote:', error);
        res.status(500).json({ success: false, error: 'Server error deleting quote' });
    }
};

// @desc    Soft delete a message
// @route   DELETE /api/communications/messages/:id
// @access  Private (Admin/Super Admin)
export const deleteMessage = async (req, res) => {
    try {
        const message = await Contact.findById(req.params.id);
        if (!message) return res.status(404).json({ success: false, error: 'Message not found' });
        if (!message.isActive) return res.status(400).json({ success: false, error: 'Message is already deleted' });

        message.isActive = false;
        await message.save();

        res.status(200).json({ success: true, message: 'Message moved to trash' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, error: 'Server error deleting message' });
    }
};

// @desc    Soft delete a booking
// @route   DELETE /api/communications/bookings/:id
// @access  Private (Admin/Super Admin)
export const deleteBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ success: false, error: 'Service Request not found' });
        if (!booking.isActive) return res.status(400).json({ success: false, error: 'Service Request is already deleted' });

        booking.isActive = false;
        await booking.save();

        res.status(200).json({ success: true, message: 'Service Request moved to trash' });
    } catch (error) {
        console.error('Error deleting service request:', error);
        res.status(500).json({ success: false, error: 'Server error deleting service request' });
    }
};

// @desc    Bulk soft-delete communications
// @route   POST /api/communications/bulk-delete
// @access  Private (Admin/Super Admin)
export const bulkDeleteCommunications = async (req, res) => {
    try {
        const { type, ids = [], selectAllMatching = false, filters = {} } = req.body;
        
        let Model;
        if (type === 'Quote') Model = Quote;
        else if (type === 'Message') Model = Contact;
        else if (type === 'Booking') Model = Booking;
        else return res.status(400).json({ success: false, error: 'Invalid communication type' });

        const filter = { isActive: { $ne: false } };

        if (selectAllMatching) {
            // Apply the same filters used in GET requests
            if (filters.status) filter.status = filters.status;
            
            if (type === 'Booking' && filters.serviceType) {
                if (filters.serviceType === 'Pink Slip') filter.services = 'Pink Slip';
                else if (filters.serviceType === 'Blue Slip') filter.services = 'Blue Slip';
                else if (filters.serviceType === IMPORT_COMPLIANCE_SERVICE) filter.services = IMPORT_COMPLIANCE_SERVICE;
                else if (filters.serviceType === 'Other') filter.services = { $nin: ['Pink Slip', 'Blue Slip', IMPORT_COMPLIANCE_SERVICE] };
            }

            applyDateFilter(filter, filters.datePreset, filters.fromDate, filters.toDate);

            if (filters.search) {
                if (type === 'Quote' || type === 'Booking') {
                    filter.$or = [
                        { 'customerInfo.fullName': { $regex: filters.search, $options: 'i' } },
                        { 'customerInfo.firstName': { $regex: filters.search, $options: 'i' } },
                        { 'customerInfo.lastName': { $regex: filters.search, $options: 'i' } },
                        { 'customerInfo.email': { $regex: filters.search, $options: 'i' } },
                        { 'customerInfo.phone': { $regex: filters.search, $options: 'i' } },
                        { 'vehicleInfo.make': { $regex: filters.search, $options: 'i' } },
                        { 'vehicleInfo.model': { $regex: filters.search, $options: 'i' } },
                        { 'vehicleInfo.regNo': { $regex: filters.search, $options: 'i' } }
                    ];
                } else if (type === 'Message') {
                    filter.$or = [
                        { firstName: { $regex: filters.search, $options: 'i' } },
                        { lastName: { $regex: filters.search, $options: 'i' } },
                        { email: { $regex: filters.search, $options: 'i' } },
                        { subject: { $regex: filters.search, $options: 'i' } },
                        { message: { $regex: filters.search, $options: 'i' } }
                    ];
                }
            }
        } else {
            // Only update specified IDs
            if (!ids || !ids.length) {
                return res.status(400).json({ success: false, error: 'No IDs provided for bulk deletion' });
            }
            filter._id = { $in: ids };
        }

        const result = await Model.updateMany(filter, { $set: { isActive: false } });

        res.status(200).json({ 
            success: true, 
            deletedCount: result.modifiedCount,
            message: `${result.modifiedCount} records moved to trash`
        });
    } catch (error) {
        console.error('Error in bulk delete communications:', error);
        res.status(500).json({ success: false, error: 'Server error during bulk delete' });
    }
};
