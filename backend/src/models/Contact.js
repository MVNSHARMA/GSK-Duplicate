import mongoose from 'mongoose';

const contactReplySchema = new mongoose.Schema({
    communicationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    communicationType: { type: String, enum: ['Message', 'Quote'], default: 'Message', required: true },
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

const contactSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    subject: { type: String },
    message: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Unread', 'Read', 'Replied'], 
        default: 'Unread' 
    },
    replies: {
        type: [contactReplySchema],
        default: []
    },
    internalNotes: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

contactSchema.index({ status: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({ customerId: 1 });
contactSchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model('Contact', contactSchema);
