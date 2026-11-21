import mongoose from 'mongoose';

const invoiceEmailLogSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true
        },
        customerName: {
            type: String,
            default: ''
        },
        recipientEmail: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        invoiceIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Invoice',
                required: true
            }
        ],
        invoiceNumbers: [
            {
                type: String,
                required: true
            }
        ],
        invoiceCount: {
            type: Number,
            required: true,
            default: 1
        },
        combinedAmount: {
            type: Number,
            required: true,
            default: 0
        },
        currency: {
            type: String,
            default: 'AUD'
        },
        mode: {
            type: String,
            enum: ['single', 'consolidated'],
            default: 'consolidated'
        },
        subject: {
            type: String,
            default: ''
        },
        sentBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        sentByName: {
            type: String,
            default: 'GSK Automotive Admin'
        },
        sentAt: {
            type: Date,
            default: Date.now
        },
        brevoMessageId: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            enum: ['accepted', 'delivered', 'failed', 'partial_failure'],
            required: true
        },
        failureReason: {
            type: String,
            default: null
        },
        attachmentFilenames: [
            {
                type: String
            }
        ],
        totalAttachmentBytes: {
            type: Number,
            default: 0
        },
        isResend: {
            type: Boolean,
            default: false
        },
        idempotencyKey: {
            type: String,
            default: null,
            index: true
        }
    },
    {
        timestamps: true
    }
);

invoiceEmailLogSchema.index({ customerId: 1, sentAt: -1 });
invoiceEmailLogSchema.index({ invoiceIds: 1 });

export default mongoose.model('InvoiceEmailLog', invoiceEmailLogSchema);

