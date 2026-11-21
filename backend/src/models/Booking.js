import mongoose from 'mongoose';
import { IMPORT_APPROVAL_STATUSES } from '../utils/bookingServices.js';

// Extra details collected only when the 'Import Compliance' service is requested.
// Make / model / year are intentionally NOT duplicated here - they are the booking's vehicleInfo fields.
const importVehicleInfoSchema = new mongoose.Schema({
    vin: { type: String, trim: true },
    countryOfOrigin: { type: String, trim: true },
    approvalStatus: { type: String, enum: IMPORT_APPROVAL_STATUSES },
    additionalInfo: { type: String, trim: true }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
    customerInfo: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, required: true },
        contactMethod: { type: String, enum: ['call', 'email'], default: 'email' }
    },
    vehicleInfo: {
        make: { type: String, required: true },
        model: { type: String, required: true },
        year: { type: String },
        regNo: { type: String, required: true },
        kilometers: { type: String },
        transmission: { type: String },
        fuelType: { type: String },
        engineSize: { type: String }
    },
    services: [{ type: String }],
    // Present only on Import Compliance bookings; absent (undefined) on all existing/other bookings.
    importVehicleInfo: { type: importVehicleInfoSchema, default: undefined },
    appointment: {
        date: { type: String, required: true },
        time: { type: String, required: true }
    },
    additionalInfo: { type: String },
    images: [{
        url: { type: String, required: true },
        publicId: { type: String, required: true }
    }],
    status: { 
        type: String, 
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'], 
        default: 'Pending' 
    },
    internalNotes: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    isActive: { type: Boolean, default: true },
    oneDayReminderSent: { type: Boolean, default: false },
    sameDayReminderSent: { type: Boolean, default: false },
    // Customer-facing reference shared by all vehicles in one submission (never the internal _id)
    bookingReference: { type: String, trim: true },
    // Customer confirmation email lifecycle. 'accepted' = Brevo accepted the request (NOT proof of delivery);
    // 'delivered' is only set after Brevo reports a delivered event.
    confirmationEmail: {
        status: {
            type: String,
            enum: ['not_sent', 'sending', 'accepted', 'delivered', 'failed', 'skipped'],
            default: 'not_sent'
        },
        messageId: { type: String },
        attempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date },
        acceptedAt: { type: Date },
        deliveredAt: { type: Date },
        lastError: { type: String },
        skipReason: { type: String }
    }
}, { timestamps: true });

bookingSchema.index({ 'appointment.date': 1, 'appointment.time': 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ customerId: 1 });
bookingSchema.index({ vehicleId: 1 });
bookingSchema.index({ bookingReference: 1 });
bookingSchema.index({ isActive: 1, status: 1, createdAt: -1 });
bookingSchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model('Booking', bookingSchema);
