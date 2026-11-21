import Booking from '../models/Booking.js';
import BookingSlot from '../models/BookingSlot.js';
import Quote from '../models/Quote.js';
import Contact from '../models/Contact.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import Notification from '../models/Notification.js';
import getCloudinary from '../config/cloudinary.js';
import EmailService from '../services/EmailService.js';
import { withTransaction } from '../utils/transaction.js';

// identityResolver is no longer imported because public intake must NOT create master records.
import { DateTime } from 'luxon';
import crypto from 'crypto';
import { parseSydneyDateTime, SYDNEY_ZONE } from '../utils/sydneyTime.js';
import {
    IMPORT_COMPLIANCE_SERVICE,
    bookingIncludesImportCompliance,
    validateImportComplianceVehicle
} from '../utils/bookingServices.js';

// Helper to parse "9:30 AM" into minutes from midnight
const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    const [time, modifier] = timeStr.split(' ');
    if (!modifier) return 0;
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    if (hours === 12) hours = 0;
    if (modifier === 'PM' || modifier === 'P.M.') hours += 12;
    return hours * 60 + parseInt(minutes);
};

// @desc    Submit a booking request
// @route   POST /api/intake/book
// @access  Public
export const createBooking = async (req, res) => {
    try {
        // Support both JSON and FormData (multipart) submissions
        let customerInfo, vehicleInfo, services, appointment, additionalInfo, vehicles;

        if (req.is('multipart/form-data') || req.files) {
            // FormData: fields arrive as stringified JSON in text fields
            customerInfo = JSON.parse(req.body.customerInfo || '{}');
            vehicleInfo = JSON.parse(req.body.vehicleInfo || '{}');
            services = JSON.parse(req.body.services || '[]');
            appointment = JSON.parse(req.body.appointment || '{}');
            additionalInfo = req.body.additionalInfo || '';
            vehicles = JSON.parse(req.body.vehicles || 'null');
        } else {
            // Standard JSON body
            ({ customerInfo, vehicleInfo, services, appointment, additionalInfo, vehicles } = req.body);
        }

        // Normalize vehicles array (backward compatibility for single vehicle requests)
        if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
            vehicles = [{
                vehicleInfo: vehicleInfo,
                services: services
            }];
        }
        
        const requestedSlots = vehicles.length;

        // Import Compliance: validate the imported-vehicle details per vehicle BEFORE any
        // image upload / slot transaction so an invalid request has no side effects.
        const importInfoByIndex = [];
        for (let i = 0; i < vehicles.length; i++) {
            if (bookingIncludesImportCompliance(vehicles[i]?.services)) {
                const result = validateImportComplianceVehicle(vehicles[i]);
                if (result.error) {
                    return res.status(400).json({
                        success: false,
                        error: vehicles.length > 1 ? `Vehicle ${i + 1}: ${result.error}` : result.error
                    });
                }
                importInfoByIndex[i] = result.importVehicleInfo;
            }
        }

        // 1. Validate Date & Time (Timezone Aware - Australia/Sydney)
        if (appointment && appointment.date && appointment.time) {
            const targetDateTime = parseSydneyDateTime(appointment.date, appointment.time);
            if (!targetDateTime || !targetDateTime.isValid) {
                return res.status(400).json({ success: false, error: 'Invalid date or time format.' });
            }

            const nowSydney = DateTime.now().setZone(SYDNEY_ZONE);
            if (targetDateTime.startOf('minute') < nowSydney.startOf('minute')) {
                return res.status(400).json({
                    success: false,
                    error: 'The selected appointment time has already passed. Please select an available future time slot.'
                });
            }
        }

        // Upload images to Cloudinary from memory buffers (outside transaction)
        const images = [];
        if (req.files && req.files.length > 0) {
            const cloudinary = getCloudinary();
            for (const file of req.files) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: 'gsk-automotive/bookings', resource_type: 'image' },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    stream.end(file.buffer);
                });
                images.push({ url: result.secure_url, publicId: result.public_id });
            }
        }

        // 2. Concurrency-safe Booking Creation via Transaction
        let createdBookings;
        try {
            createdBookings = await withTransaction(async (session) => {
                // explicitly do not resolve identity on intake. only admin can link.
                const customerId = null;
                const vehicleId = null;

                // Re-verify that the requested slot has not expired in Australia/Sydney
                if (appointment && appointment.date && appointment.time) {
                    const targetDateTime = parseSydneyDateTime(appointment.date, appointment.time);
                    const currentSydney = DateTime.now().setZone(SYDNEY_ZONE);
                    if (targetDateTime && targetDateTime.startOf('minute') < currentSydney.startOf('minute')) {
                        throw new Error('The selected appointment time has expired. Please choose an upcoming time slot.');
                    }
                }

                // Upsert the slot config to ensure it exists
                const slot = await BookingSlot.findOneAndUpdate(
                    { date: appointment.date, time: appointment.time },
                    { $setOnInsert: { capacity: 3, isDisabled: false } },
                    { upsert: true, new: true, setDefaultsOnInsert: true, session }
                );

                if (slot.isDisabled) {
                    throw new Error('This time slot has been disabled by the administrator.');
                }

                // Lock the slot document to prevent write skew across concurrent transactions
                await BookingSlot.updateOne(
                    { _id: slot._id }, 
                    { $set: { lastBookedAt: new Date() } }, 
                    { session }
                );

                // Count active bookings for this slot
                const activeBookingsCount = await Booking.countDocuments({
                    'appointment.date': appointment.date,
                    'appointment.time': appointment.time,
                    status: { $ne: 'Cancelled' }
                }).session(session);

                if (activeBookingsCount + requestedSlots > slot.capacity) {
                    const spacesLeft = Math.max(0, slot.capacity - activeBookingsCount);
                    throw new Error(`The selected slot only has ${spacesLeft} spaces left. You requested ${requestedSlots}. Please choose another time.`);
                }

                // Generate a unique, customer-facing booking reference (e.g. GSK-BK-20261028-A1B2)
                const nowSydney = DateTime.now().setZone(SYDNEY_ZONE);
                const datePart = nowSydney.toFormat('yyyyMMdd');
                const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
                const bookingReference = `GSK-BK-${datePart}-${randomPart}`;

                // Create the actual bookings (one per vehicle)
                const bookingsToCreate = vehicles.map((v, i) => ({
                    bookingReference,
                    customerInfo,
                    vehicleInfo: v.vehicleInfo,
                    services: v.services,
                    // Only persisted for Import Compliance vehicles (validated above); never for other services.
                    ...(importInfoByIndex[i] ? { importVehicleInfo: importInfoByIndex[i] } : {}),
                    appointment,
                    additionalInfo,
                    images,
                    customerId,
                    vehicleId
                }));

                const newBookings = await Booking.create(bookingsToCreate, { session, ordered: true });
                return newBookings;
            });
        } catch (txnError) {
            return res.status(400).json({ success: false, error: txnError.message });
        }

        // 1. Send customer confirmation email for the booking request
        try {
            await EmailService.sendBookingConfirmation(createdBookings);
        } catch (err) {
            console.error("[intakeController] Failed to send customer booking confirmation email:", err.message);
        }

        // 2. Send internal notifications for each vehicle record
        for (const booking of createdBookings) {
            try {
                await EmailService.sendBookingAdminNotification(booking);
            } catch (adminErr) {
                console.error("[intakeController] Failed to send admin booking notification email:", adminErr.message);
            }

            try {
                const vehicleLabel = `${booking.vehicleInfo.year || ''} ${booking.vehicleInfo.make || ''} ${booking.vehicleInfo.model || ''}`.replace(/\s+/g, ' ').trim();
                const isImportCompliance = bookingIncludesImportCompliance(booking.services);
                const who = `${customerInfo.firstName} ${customerInfo.lastName}`;
                const when = `${appointment.date} at ${appointment.time}`;
                await Notification.create({
                    type: 'new_booking',
                    title: isImportCompliance ? 'New Import Compliance Request' : 'New Service Request',
                    message: isImportCompliance
                        ? `${who} requested ${IMPORT_COMPLIANCE_SERVICE} for ${vehicleLabel}${booking.importVehicleInfo?.vin ? ` (VIN/Chassis: ${booking.importVehicleInfo.vin})` : ''} on ${when}`.trim()
                        : `${who} requested service for ${vehicleLabel} on ${when}`.trim(),
                    relatedModel: 'Booking',
                    relatedId: booking._id
                });
            } catch (notifErr) {
                console.error('[intakeController] Failed to create booking notification:', notifErr.message);
            }
        }

        const bookingRef = createdBookings?.[0]?.bookingReference;
        res.status(201).json({ 
            success: true, 
            data: createdBookings, 
            bookingReference: bookingRef,
            message: 'Booking request submitted successfully.' 
        });
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Submit a quote request
// @route   POST /api/intake/quote
// @access  Public
export const createQuote = async (req, res) => {
    try {
        let customerInfo, vehicleInfo, services, description;

        if (req.is('multipart/form-data') || req.files) {
            customerInfo = JSON.parse(req.body.customerInfo || '{}');
            vehicleInfo = JSON.parse(req.body.vehicleInfo || '{}');
            services = JSON.parse(req.body.services || '[]');
            description = req.body.description || '';
        } else {
            ({ customerInfo, vehicleInfo, services, description } = req.body);
        }

        // Upload images to Cloudinary from memory buffers
        const images = [];
        if (req.files && req.files.length > 0) {
            const cloudinary = getCloudinary();
            for (const file of req.files) {
                const result = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: 'gsk-automotive/quotes', resource_type: 'image' },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    stream.end(file.buffer);
                });
                images.push({ url: result.secure_url, publicId: result.public_id });
            }
        }

        let quote;
        try {
            quote = await withTransaction(async (session) => {
                // explicitly do not resolve identity on intake. only admin can link.
                const customerId = null;
                const vehicleId = null;

                const created = await Quote.create([{
                    customerInfo,
                    vehicleInfo,
                    services,
                    description,
                    images,
                    customerId,
                    vehicleId
                }], { session });

                return created[0];
            });
        } catch (txnError) {
            return res.status(400).json({ success: false, error: txnError.message });
        }

        // Send Customer Confirmation Email
        try {
            await EmailService.sendQuoteConfirmation(quote);
        } catch (err) {
            console.error("Failed to send quote emails:", err);
        }

        // Generate admin notification
        try {
            await Notification.create({
                type: 'new_quote',
                title: 'New Quote Request',
                message: `${customerInfo.fullName || 'Customer'} requested a quote for ${vehicleInfo.year || ''} ${vehicleInfo.make || ''} ${vehicleInfo.model || ''} (${vehicleInfo.regNo || 'N/A'})`.trim(),
                relatedModel: 'Quote',
                relatedId: quote._id
            });
        } catch (notifErr) {
            console.error('Failed to create quote notification:', notifErr);
        }

        res.status(201).json({ success: true, data: quote, message: 'Quote request submitted successfully.' });
    } catch (error) {
        console.error('Quote error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Submit a contact message
// @route   POST /api/intake/contact
// @access  Public
export const submitContact = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, subject, message } = req.body;

        let contact;
        try {
            contact = await withTransaction(async (session) => {
                // explicitly do not resolve identity on intake. only admin can link.
                const customerId = null;
                
                const created = await Contact.create([{
                    firstName,
                    lastName,
                    email,
                    phone,
                    subject,
                    message,
                    customerId
                }], { session });

                return created[0];
            });
        } catch (txnError) {
            return res.status(400).json({ success: false, error: txnError.message });
        }



        // Generate admin notification
        try {
            await Notification.create({
                type: 'new_message',
                title: 'New Customer Message',
                message: `${firstName} ${lastName} sent a message: "${(subject || message || '').substring(0, 80)}${(subject || message || '').length > 80 ? '...' : ''}"`,
                relatedModel: 'Contact',
                relatedId: contact._id
            });
        } catch (notifErr) {
            console.error('Failed to create contact notification:', notifErr);
        }

        res.status(201).json({ success: true, data: contact, message: 'Message sent successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
