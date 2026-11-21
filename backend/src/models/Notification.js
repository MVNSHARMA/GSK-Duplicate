import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['new_booking', 'new_quote', 'new_message', 'booking_update', 'system', 'job_review', 'job_completed', 'rental_update'],
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    relatedModel: {
        type: String,
        enum: ['Booking', 'Quote', 'Contact', 'JobCard', 'RentalServiceEntry', null],
        default: null
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

// Index for efficient queries
notificationSchema.index({ isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });



export default mongoose.model('Notification', notificationSchema);
