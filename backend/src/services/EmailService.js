import sendEmail from '../utils/sendEmail.js';
import { resolveBusinessAddress, resolveBusinessPhone } from '../utils/businessInfo.js';
import { generateInvoicePDF } from '../utils/generateInvoicePDF.js';
import { generatePurchaseOrderPDF } from '../utils/generatePurchaseOrderPDF.js';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import {
    buildInternalNotification,
    buildQuoteRequestConfirmation,
    buildServiceReminder,
    buildThankYouEmail,
    buildInvoiceEmail,
    buildAuthEmail,
    buildAdminReply,
    buildPurchaseOrderSubject,
    buildPurchaseOrderEmail,
    buildPurchaseOrderText,
    computeAuthoritativeInvoiceAmounts,
    buildConsolidatedInvoiceSubject,
    buildConsolidatedInvoiceEmail,
    buildConsolidatedInvoiceText
} from '../utils/emailTemplates.js';
import {
    buildBookingSubject,
    buildBookingConfirmationHtml,
    buildBookingConfirmationText,
    escapeHtml
} from '../utils/bookingConfirmationTemplate.js';
import { bookingIncludesImportCompliance } from '../utils/bookingServices.js';

class EmailService {
    static async getSettings() {
        try {
            const Setting = mongoose.model('Setting');
            const settings = await Setting.findOne();
            return settings || {};
        } catch (error) {
            console.error('[EmailService] Error fetching settings:', error);
            return {};
        }
    }

    static getAdminEmail() {
        const candidate = process.env.TEST_EMAIL_RECIPIENT || process.env.ADMIN_EMAIL;
        if (candidate && candidate.includes('@') && candidate.includes('.')) {
            return candidate;
        }
        return 'admin@gskautomotive.com';
    }

    // ==========================================
    // 1. CUSTOMER -> COMPANY (Internal Notifications)
    // ==========================================

    static async sendQuoteAdminNotification(quote) {
        try {
            const settings = await this.getSettings();
            const html = buildInternalNotification(settings, {
                title: 'New Quote Request',
                type: 'Quote Request',
                customer: quote.customerInfo,
                vehicle: quote.vehicleInfo,
                details: {
                    'Services': quote.services?.join(', ') || 'None selected',
                    'Description': quote.description || 'N/A'
                }
            });

            await sendEmail({
                to: this.getAdminEmail(),
                subject: 'New Quote Request — GSK Automotive',
                html
            });
            console.log('[EmailService] Quote Admin Notification sent.');
        } catch (error) {
            console.error('[EmailService] Failed to send Quote Admin Notification:', error.message);
            // Log safely, do not throw to break business flow
        }
    }

    static async sendContactAdminNotification(contact) {
        try {
            const settings = await this.getSettings();
            const html = buildInternalNotification(settings, {
                title: 'New Customer Message',
                type: 'Contact Message',
                customer: {
                    name: `${contact.firstName} ${contact.lastName}`,
                    email: contact.email,
                    phone: contact.phone || 'N/A'
                },
                vehicle: null,
                details: {
                    'Subject': contact.subject || 'N/A',
                    'Message': contact.message
                }
            });

            await sendEmail({
                to: this.getAdminEmail(),
                subject: 'New Customer Message — GSK Automotive',
                html
            });
            console.log('[EmailService] Contact Admin Notification sent.');
        } catch (error) {
            console.error('[EmailService] Failed to send Contact Admin Notification:', error.message);
        }
    }

    static async sendBookingAdminNotification(booking) {
        try {
            const settings = await this.getSettings();
            const isImportCompliance = bookingIncludesImportCompliance(booking.services);
            const importInfo = isImportCompliance ? (booking.importVehicleInfo || {}) : null;
            // Customer-supplied values are HTML-escaped because the internal template renders details raw.
            const details = {
                'Date': escapeHtml(booking.appointment?.date || 'N/A'),
                'Time': escapeHtml(booking.appointment?.time || 'N/A'),
                'Services': escapeHtml(booking.services?.join(', ') || 'None selected'),
                'Additional Info': escapeHtml(booking.additionalInfo || 'N/A')
            };
            if (importInfo) {
                details['VIN / Chassis Number'] = escapeHtml(importInfo.vin || 'N/A');
                details['Country of Origin'] = escapeHtml(importInfo.countryOfOrigin || 'N/A');
                details['Import Approval Status'] = escapeHtml(importInfo.approvalStatus || 'N/A');
                if (importInfo.additionalInfo) details['Import Notes'] = escapeHtml(importInfo.additionalInfo);
            }

            const html = buildInternalNotification(settings, {
                title: isImportCompliance ? 'New Import Compliance Request' : 'New Service Request',
                type: isImportCompliance ? 'Import Compliance Request' : 'Service Request',
                customer: booking.customerInfo,
                vehicle: booking.vehicleInfo,
                details
            });

            await sendEmail({
                to: this.getAdminEmail(),
                subject: isImportCompliance
                    ? 'New Import Compliance Request — GSK Automotive'
                    : 'New Service Request — GSK Automotive',
                html
            });
            console.log('[EmailService] Booking Admin Notification sent.');
        } catch (error) {
            console.error('[EmailService] Failed to send Booking Admin Notification:', error.message);
        }
    }

    // ==========================================
    // 2. COMPANY -> CUSTOMER (Confirmations)
    // ==========================================

    static async sendQuoteConfirmation(quote) {
        if (!quote.customerInfo?.email) return;
        try {
            const settings = await this.getSettings();
            const html = buildQuoteRequestConfirmation(settings, {
                customerName: quote.customerInfo.firstName || 'Customer',
                vehicleYear: quote.vehicleInfo?.year,
                vehicleMake: quote.vehicleInfo?.make || quote.vehicleInfo?.brand,
                vehicleModel: quote.vehicleInfo?.model
            });

            await sendEmail({
                to: quote.customerInfo.email,
                subject: 'Quote Request Received — GSK Automotive',
                html
            });
        } catch (error) {
            console.error('[EmailService] Failed to send Quote Confirmation:', error.message);
        }
    }

    static buildBookingEmailModel(bookingInput, settings = {}) {
        const bookings = (Array.isArray(bookingInput) ? bookingInput : [bookingInput]).filter(Boolean);
        const primary = bookings[0] || {};
        const customerInfo = primary.customerInfo || (primary.customerId && typeof primary.customerId === 'object' ? primary.customerId : {});
        const customerName = `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim() || 'Valued Customer';
        const rawStatus = (primary.status || 'Pending').toLowerCase();
        const statusKind = rawStatus === 'confirmed' ? 'confirmed' : 'pending';

        let formattedDate = primary.appointment?.date || 'To be confirmed';
        try {
            if (primary.appointment?.date) {
                const dt = DateTime.fromISO(primary.appointment.date, { zone: 'Australia/Sydney' });
                if (dt.isValid) {
                    formattedDate = dt.toFormat('cccc, d MMMM yyyy');
                }
            }
        } catch (_) {}

        const vehicles = bookings.map(b => {
            const v = b.vehicleInfo || {};
            const parts = [v.year, v.make || v.brand, v.model].filter(Boolean);
            const desc = parts.join(' ').trim();
            const rego = v.regNo || v.registrationNumber || '';
            const services = Array.isArray(b.services)
                ? b.services.filter(Boolean)
                : (b.services ? [b.services] : []);
            const imp = bookingIncludesImportCompliance(services) ? (b.importVehicleInfo || null) : null;
            return {
                description: desc || 'Vehicle',
                rego,
                services,
                importInfo: imp ? {
                    vin: imp.vin || '',
                    countryOfOrigin: imp.countryOfOrigin || '',
                    approvalStatus: imp.approvalStatus || '',
                    additionalInfo: imp.additionalInfo || ''
                } : null
            };
        });

        const contact = {
            phone: resolveBusinessPhone(settings),
            email: settings.businessEmail || 'info@gskautomotive.com.au',
            address: resolveBusinessAddress(settings)
        };

        return {
            businessName: settings.businessName || 'GSK Automotive',
            statusKind,
            bookingReference: primary.bookingReference || '',
            customerName,
            appointmentDate: formattedDate,
            appointmentTime: primary.appointment?.time || 'To be confirmed',
            timezoneLabel: 'Australia/Sydney time (AEST/AEDT)',
            vehicles,
            additionalInfo: primary.additionalInfo || '',
            contact
        };
    }

    static async sendBookingConfirmation(bookingInput, options = {}) {
        if (!bookingInput) return { success: false, reason: 'missing_booking' };

        const bookings = (Array.isArray(bookingInput) ? bookingInput : [bookingInput]).filter(Boolean);
        if (!bookings.length) return { success: false, reason: 'missing_booking' };

        const primary = bookings[0];
        const rawEmail = primary.customerInfo?.email || (primary.customerId && typeof primary.customerId === 'object' ? primary.customerId.email : '') || '';
        const email = String(rawEmail).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const bookingIds = bookings.map(b => b._id).filter(Boolean);

        if (!email || !emailRegex.test(email)) {
            console.warn(`[EmailService] Booking ${bookingIds.join(', ') || 'unknown'} has invalid or missing email (${email}). Confirmation email skipped.`);
            if (bookingIds.length > 0) {
                try {
                    const Booking = mongoose.model('Booking');
                    await Booking.updateMany(
                        { _id: { $in: bookingIds } },
                        {
                            $set: {
                                'confirmationEmail.status': 'skipped',
                                'confirmationEmail.skipReason': 'invalid_or_missing_email',
                                'confirmationEmail.lastAttemptAt': new Date()
                            }
                        }
                    );
                } catch (skipErr) {
                    console.error('[EmailService] Failed to record skipped status in DB:', skipErr.message);
                }
            }
            return { success: false, skipped: true, reason: 'invalid_or_missing_email' };
        }

        // Duplicate-prevention: Atomic status lock
        if (bookingIds.length > 0 && !options.force) {
            try {
                const Booking = mongoose.model('Booking');
                const claimResult = await Booking.updateMany(
                    {
                        _id: { $in: bookingIds },
                        'confirmationEmail.status': { $nin: ['accepted', 'delivered', 'sending'] }
                    },
                    {
                        $set: {
                            'confirmationEmail.status': 'sending',
                            'confirmationEmail.lastAttemptAt': new Date()
                        },
                        $inc: {
                            'confirmationEmail.attempts': 1
                        }
                    }
                );
                if (claimResult.matchedCount === 0) {
                    console.log(`[EmailService] Confirmation email already sent/in-flight for bookings ${bookingIds.join(', ')}. Skipping duplicate.`);
                    return { success: true, skipped: true, reason: 'duplicate_prevented' };
                }
            } catch (lockErr) {
                console.error(`[EmailService] Error checking duplicate status for bookings ${bookingIds.join(', ')}:`, lockErr.message);
            }
        }

        try {
            const settings = await this.getSettings();
            const model = this.buildBookingEmailModel(bookings, settings);
            const subject = buildBookingSubject(model);
            const html = buildBookingConfirmationHtml(model);
            const text = buildBookingConfirmationText(model);

            const info = await sendEmail({
                to: email,
                subject,
                html,
                text,
                tags: ['booking-confirmation', model.statusKind],
                sandbox: options.sandbox || false
            });

            if (bookingIds.length > 0) {
                try {
                    const Booking = mongoose.model('Booking');
                    await Booking.updateMany(
                        { _id: { $in: bookingIds } },
                        {
                            $set: {
                                'confirmationEmail.status': 'accepted',
                                'confirmationEmail.messageId': info?.messageId || '',
                                'confirmationEmail.acceptedAt': new Date(),
                                'confirmationEmail.lastError': null
                            }
                        }
                    );
                } catch (dbErr) {
                    console.error('[EmailService] Failed to record accepted status in DB:', dbErr.message);
                }
            }

            console.log(`[EmailService] Booking confirmation email accepted by Brevo (${info?.messageId}) to ${email}`);
            return { success: true, messageId: info?.messageId, status: 'accepted' };
        } catch (error) {
            if (bookingIds.length > 0) {
                try {
                    const Booking = mongoose.model('Booking');
                    await Booking.updateMany(
                        { _id: { $in: bookingIds } },
                        {
                            $set: {
                                'confirmationEmail.status': 'failed',
                                'confirmationEmail.lastError': error.message
                            }
                        }
                    );
                } catch (dbErr) {
                    console.error('[EmailService] Failed to record email failure in DB:', dbErr.message);
                }
            }
            console.error(`[EmailService] Failed to send Booking Confirmation to ${email}:`, error.message);
            return { success: false, error: error.message, status: 'failed' };
        }
    }


    static async sendAdminReply(email, customerName, subject, originalMessage, replyMessage, options = {}) {
        if (!email) {
            throw new Error('Recipient email is required');
        }
        try {
            const settings = await this.getSettings();
            const html = buildAdminReply(settings, {
                customerName,
                subject,
                originalMessage,
                replyMessage
            });

            const info = await sendEmail({
                to: email,
                subject,
                html,
                text: replyMessage,
                tags: options.tags || ['admin-reply'],
                sandbox: options.sandbox || false
            });

            return {
                success: true,
                messageId: info?.messageId || '',
                senderName: process.env.BREVO_SENDER_NAME || settings?.businessName || 'GSK Automotive',
                senderEmail: process.env.BREVO_SENDER_EMAIL || settings?.businessEmail || 'admin@gskautomotive.com',
                deliveryStatus: 'accepted'
            };
        } catch (error) {
            console.error('[EmailService] Failed to send Admin Reply:', error.message);
            throw error; // Let controller handle failure if it wants to
        }
    }

    // ==========================================
    // 3. REMINDERS & THANK YOU
    // ==========================================

    static async sendServiceReminder(booking, isSameDay = false) {
        // Find email - it could be in customerInfo or in populated customerId
        const email = booking.customerId?.email || booking.customerInfo?.email;
        if (!email) return false;

        const customerName = booking.customerId?.name || booking.customerInfo?.firstName || 'Customer';
        const rego = booking.vehicleId?.registrationNumber || booking.vehicleInfo?.regNo;
        const vehicleDetails = booking.vehicleId 
            ? `${booking.vehicleId.year || ''} ${booking.vehicleId.brand || ''} ${booking.vehicleId.model || ''} (Rego No: ${rego || 'N/A'})`.trim()
            : `${booking.vehicleInfo?.year || ''} ${booking.vehicleInfo?.make || ''} ${booking.vehicleInfo?.model || ''} (Rego No: ${rego || 'N/A'})`.trim();

        try {
            const settings = await this.getSettings();
            const html = buildServiceReminder(settings, {
                customerName,
                vehicleDetails,
                date: booking.appointment?.date,
                time: booking.appointment?.time,
                isSameDay
            });

            const subject = isSameDay 
                ? 'Your Service Is Scheduled for Today — GSK Automotive'
                : 'Service Reminder — GSK Automotive';

            await sendEmail({ to: email, subject, html });
            return true;
        } catch (error) {
            console.error(`[EmailService] Failed to send ${isSameDay ? 'same-day' : 'one-day'} reminder:`, error.message);
            return false;
        }
    }

    static async sendThankYouEmail(jobCard) {
        if (!jobCard.customerId?.email) return false;
        try {
            const settings = await this.getSettings();
            
            const vehicleDetails = jobCard.vehicleId 
                ? `${jobCard.vehicleId.year || ''} ${jobCard.vehicleId.brand || ''} ${jobCard.vehicleId.model || ''}`.trim()
                : 'your vehicle';

            const servicesPerformed = jobCard.servicesOrdered && jobCard.servicesOrdered.length > 0 
                ? jobCard.servicesOrdered.join(', ')
                : '';

            const html = buildThankYouEmail(settings, {
                customerName: jobCard.customerId.name || 'Customer',
                vehicleDetails,
                servicesPerformed
            });

            await sendEmail({
                to: jobCard.customerId.email,
                subject: 'Thank You for Visiting GSK Automotive',
                html
            });
            return true;
        } catch (error) {
            console.error('[EmailService] Failed to send Thank You Email:', error.message);
            return false;
        }
    }

    // ==========================================
    // 4. INVOICES
    // ==========================================

    static async sendInvoiceEmail(invoice, options = {}) {
        if (!invoice.customerId?.email) return false;
        
        try {
            const settings = await this.getSettings();
            
            // Calculate totals safely using stored values with fallback for legacy invoices
            const subtotal = invoice.subtotal !== undefined ? invoice.subtotal : (invoice.partsAndLabour?.reduce((sum, item) => sum + ((item.qty || 1) * (item.price || 0)), 0) || 0);
            const gstRate = invoice.gstRate !== undefined ? invoice.gstRate : (settings.gstRate || 10);
            const tax = invoice.gstAmount !== undefined ? invoice.gstAmount : ((subtotal * gstRate) / 100);
            const total = invoice.totalAmount !== undefined ? invoice.totalAmount : (subtotal + tax);

            const html = buildInvoiceEmail(settings, {
                invoiceNo: invoice.invoiceNo,
                date: new Date(invoice.createdAt).toLocaleDateString('en-AU'),
                customer: invoice.customerId,
                vehicle: invoice.vehicleId || invoice.trackerCarId,
                partsAndLabour: invoice.partsAndLabour,
                subtotal,
                gstRate,
                tax,
                total,
                terms: settings.invoiceTerms || 'Payment is due upon receipt.',
                paymentStatus: invoice.status || 'Unpaid',
                amountPaid: invoice.amountPaid || 0
            });

            const pdfBuffer = await generateInvoicePDF(invoice, settings);
            const pdfFilename = `GSK-Automotive-Invoice-${invoice.invoiceNo || 'Draft'}.pdf`;
            const subject = `Your GSK Automotive Invoice — ${invoice.invoiceNo}`;

            const info = await sendEmail({
                to: invoice.customerId.email,
                subject,
                html,
                attachments: [
                    {
                        filename: pdfFilename,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }
                ],
                tags: options.tags || ['invoice-single', invoice.invoiceNo || 'invoice'],
                sandbox: Boolean(options.sandbox)
            });
            return {
                success: true,
                messageId: info?.messageId || '',
                recipientEmail: invoice.customerId.email,
                subject,
                deliveryStatus: 'accepted',
                pdfFilename
            };
        } catch (error) {
            console.error('[EmailService] Failed to send Invoice Email:', error.message);
            return false;
        }
    }

    // Default max raw PDF attachment bytes per consolidated email: 15 MB (~20 MB base64 for Brevo/Vercel limits)
    static get DEFAULT_MAX_INVOICE_ATTACHMENT_BYTES() {
        return Number(process.env.MAX_INVOICE_ATTACHMENT_BYTES) || (15 * 1024 * 1024);
    }

    static async sendConsolidatedInvoicesEmail(invoices, customer, options = {}) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipientEmail = String(customer?.email || '').trim().toLowerCase();

        if (!recipientEmail || !emailRegex.test(recipientEmail)) {
            const err = new Error('Customer does not have a valid registered email address.');
            err.code = 'INVALID_CUSTOMER_EMAIL';
            throw err;
        }

        if (!Array.isArray(invoices) || invoices.length === 0) {
            const err = new Error('At least one eligible invoice is required.');
            err.code = 'NO_INVOICES_SELECTED';
            throw err;
        }

        const canonicalCustomerId = String(customer?._id || '');
        for (const inv of invoices) {
            const invCustId = String(inv?.customerId?._id || inv?.customerId || '');
            if (!canonicalCustomerId || invCustId !== canonicalCustomerId) {
                const err = new Error('You have selected invoices belonging to different customers. Please select invoices belonging to a single customer to send them together.');
                err.code = 'MULTIPLE_CUSTOMERS_SELECTED';
                throw err;
            }
        }

        const settings = await this.getSettings();
        const maxAttachmentBytes = options.maxAttachmentBytes !== undefined
            ? Number(options.maxAttachmentBytes)
            : this.DEFAULT_MAX_INVOICE_ATTACHMENT_BYTES;

        const attachments = [];
        const attachmentFilenames = [];
        let totalAttachmentBytes = 0;
        let combinedAmount = 0;

        for (const inv of invoices) {
            const amounts = computeAuthoritativeInvoiceAmounts(inv, settings);
            combinedAmount += amounts.totalAmount;

            const safeInvNo = String(inv.invoiceNo || 'Draft').replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `Invoice_${safeInvNo}.pdf`;

            const pdfBuffer = await generateInvoicePDF(inv, settings);
            if (!pdfBuffer || pdfBuffer.length === 0) {
                const err = new Error(`Failed to generate PDF attachment for invoice ${inv.invoiceNo}.`);
                err.code = 'PDF_GENERATION_FAILED';
                throw err;
            }

            totalAttachmentBytes += pdfBuffer.length;
            if (totalAttachmentBytes > maxAttachmentBytes) {
                const limitMb = (maxAttachmentBytes / (1024 * 1024)).toFixed(2);
                const actualMb = (totalAttachmentBytes / (1024 * 1024)).toFixed(2);
                const err = new Error(
                    `Combined PDF attachments (${actualMb} MB) exceed the maximum supported email attachment limit of ${limitMb} MB. Please select fewer invoices per email.`
                );
                err.code = 'ATTACHMENT_SIZE_LIMIT_EXCEEDED';
                err.totalAttachmentBytes = totalAttachmentBytes;
                err.maxAttachmentBytes = maxAttachmentBytes;
                throw err;
            }

            attachments.push({
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf'
            });
            attachmentFilenames.push(filename);
        }

        combinedAmount = Number(combinedAmount.toFixed(2));
        const subject = buildConsolidatedInvoiceSubject(customer?.name, settings?.businessName || 'GSK Automotive');
        const html = buildConsolidatedInvoiceEmail(settings, {
            customer,
            invoices,
            attachmentFilenames
        });
        const text = buildConsolidatedInvoiceText(settings, {
            customer,
            invoices,
            attachmentFilenames
        });

        const info = await sendEmail({
            to: recipientEmail,
            subject,
            html,
            text,
            attachments,
            tags: options.tags || ['invoice-consolidated', `count-${invoices.length}`],
            sandbox: Boolean(options.sandbox)
        });

        return {
            success: true,
            messageId: info?.messageId || '',
            recipientEmail,
            subject,
            deliveryStatus: 'accepted',
            attachmentFilenames,
            totalAttachmentBytes,
            combinedAmount,
            invoiceCount: invoices.length
        };
    }

    // ==========================================
    // 5. AUTHENTICATION
    // ==========================================

    static async sendPasswordReset(user, resetUrl) {
        if (!user.email) return;
        try {
            const settings = await this.getSettings();
            const html = buildAuthEmail(settings, {
                title: 'Password Reset',
                customerName: user.name || 'User',
                message: 'You are receiving this email because you (or someone else) have requested the reset of a password. Please click the button below to complete the process. This link is valid for 15 minutes.',
                actionText: 'RESET PASSWORD',
                actionUrl: resetUrl
            });

            await sendEmail({
                to: user.email,
                subject: 'Password Reset — GSK Automotive',
                html
            });
            return true;
        } catch (error) {
            console.error('[EmailService] Failed to send Password Reset Email:', error.message);
            throw error; // Re-throw for Auth controller to handle if needed
        }
    }

    // ==========================================
    // CUSTOMER SERVICE UPDATE NOTIFICATION
    // ==========================================
    static async sendCustomerServiceUpdateEmail({ customerEmail, customerName, vehicleRego, message }) {
        try {
            if (!customerEmail) {
                console.warn('[EmailService] No customer email provided for service update notification.');
                return false;
            }

            const settings = await this.getSettings();
            const businessName = settings?.businessName || 'GSK Automotive';

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #333; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">${businessName} — Service Update</h2>
                    <p style="color: #555;">Hi ${customerName || 'Valued Customer'},</p>
                    <p style="color: #555;">We have an update regarding the service for your vehicle <strong>${vehicleRego || ''}</strong>:</p>
                    <div style="background: #f8f9fa; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="color: #333; margin: 0;">${message}</p>
                    </div>
                    <p style="color: #555;">If you have any questions, please don't hesitate to contact us.</p>
                    <p style="color: #999; font-size: 12px; margin-top: 30px;">— ${businessName}</p>
                </div>
            `;

            await sendEmail({
                to: customerEmail,
                subject: `Service Update for ${vehicleRego || 'Your Vehicle'} — ${businessName}`,
                html
            });
            console.log('[EmailService] Customer Service Update email sent to', customerEmail);
            return true;
        } catch (error) {
            console.error('[EmailService] Failed to send Customer Service Update email:', error.message);
            return false; // Do NOT throw - the update record must be preserved regardless
        }
    }

    // ==========================================
    // 6. SUPPLIER PURCHASE ORDER EMAIL
    // ==========================================
    static async sendPurchaseOrderEmail(po, supplier, options = {}) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const recipientEmail = String(supplier?.email || '').trim().toLowerCase();

        if (!recipientEmail || !emailRegex.test(recipientEmail)) {
            throw new Error('Supplier does not have a valid registered email address.');
        }

        const settings = await this.getSettings();
        const senderEmail = String(process.env.BREVO_SENDER_EMAIL || '').trim();
        const senderName = String(process.env.BREVO_SENDER_NAME || settings?.businessName || 'GSK Automotive').trim();
        const subject = buildPurchaseOrderSubject(po.purchaseOrderNumber);
        const html = buildPurchaseOrderEmail(settings, { po, supplier });
        const text = buildPurchaseOrderText(settings, { po, supplier });

        const attachments = [];
        let pdfAttached = false;
        const safePoNum = String(po.purchaseOrderNumber || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');
        const pdfFilename = `GSK_PO_${safePoNum}.pdf`;

        try {
            const pdfBuffer = await generatePurchaseOrderPDF(po, supplier, settings);
            if (pdfBuffer && pdfBuffer.length > 0) {
                attachments.push({
                    filename: pdfFilename,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                });
                pdfAttached = true;
            }
        } catch (pdfError) {
            console.error(`[EmailService] Warning: Failed to generate PDF for ${po.purchaseOrderNumber}, proceeding with complete HTML/text email:`, pdfError.message);
        }

        const attachmentMetadata = attachments.map(a => ({
            filename: a.filename || '',
            contentType: a.contentType || 'application/octet-stream',
            size: Buffer.isBuffer(a.content) ? a.content.length : 0
        }));

        try {
            const info = await sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
                attachments,
                tags: options.tags || ['purchase-order', po.purchaseOrderNumber || 'po'],
                sandbox: Boolean(options.sandbox)
            });

            return {
                success: true,
                messageId: info?.messageId || '',
                senderEmail,
                senderName,
                recipientEmail,
                subject,
                htmlContent: html,
                textContent: text,
                deliveryStatus: 'accepted',
                pdfAttached,
                pdfFilename: pdfAttached ? pdfFilename : '',
                attachments: attachmentMetadata
            };
        } catch (err) {
            err.emailSnapshot = {
                senderEmail,
                senderName,
                recipientEmail,
                subject,
                htmlContent: html,
                textContent: text,
                pdfAttached,
                pdfFilename: pdfAttached ? pdfFilename : '',
                attachments: attachmentMetadata
            };
            throw err;
        }
    }
}

export default EmailService;
