import mongoose from 'mongoose';

const quoteReplySchema = new mongoose.Schema({
    communicationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    communicationType: { type: String, enum: ['Message', 'Quote'], default: 'Quote', required: true },
    senderName: { type: String, default: 'GSK Automotive' },
    senderEmail: { type: String, default: '' },
    authorName: { type: String, default: 'GSK Automotive' },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recipientEmail: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    message: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    brevoMessageId: { type: String, default: '' },
    deliveryStatus: {
        type: String,
        enum: ['accepted', 'delivered', 'opened', 'deferred', 'bounced', 'blocked', 'invalid', 'error'],
        default: 'accepted'
    },
    idempotencyKey: { type: String, default: null }
}, { _id: true });

const quoteSchema = new mongoose.Schema({
    customerInfo: {
        fullName: { type: String, required: true },
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
        transmission: { type: String }
    },
    services: [{ type: String }],
    description: { type: String },
    images: [{
        url: String,
        publicId: String
    }],
    status: { 
        type: String, 
        enum: ['Pending', 'In Review', 'Quoted', 'Responded', 'Closed'], 
        default: 'Pending' 
    },
    replies: {
        type: [quoteReplySchema],
        default: []
    },
    internalNotes: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    convertedToInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    convertedToJobCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobCard', default: null },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    retentionReview: {
        reviewStatus: {
            type: String,
            enum: ['not_due', 'pending_review', 'retained', 'archived'],
            default: 'not_due'
        },
        lastReviewedAt: { type: Date, default: null },
        lastReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        lastReviewedByName: { type: String, default: '' },
        reviewNotes: { type: String, default: '' }
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

quoteSchema.index({ status: 1 });
quoteSchema.index({ customerId: 1 });
quoteSchema.index({ vehicleId: 1 });
quoteSchema.index({ isActive: 1, createdAt: -1 });
quoteSchema.index({ isActive: 1, isArchived: 1, createdAt: 1 });

export default mongoose.model('Quote', quoteSchema);
