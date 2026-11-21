import mongoose from 'mongoose';

const purchaseOrderItemSchema = new mongoose.Schema({
    inventoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory',
        required: true
    },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    // Historical Snapshots
    productName: {
        type: String,
        required: true
    },
    variantName: {
        type: String,
        required: true
    },
    hierarchyPath: {
        type: String,
        default: ''
    },
    sku: {
        type: String
    },
    quantityOrdered: {
        type: Number,
        required: true,
        min: 1
    },
    quantityReceived: {
        type: Number,
        default: 0,
        min: 0
    },
    unitPurchasePrice: {
        type: Number,
        required: true,
        min: 0
    }
});

const purchaseOrderEmailLogSchema = new mongoose.Schema({
    purchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    purchaseOrderNumber: {
        type: String,
        required: true
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    supplierEmail: {
        type: String,
        required: true
    },
    senderName: {
        type: String,
        default: ''
    },
    senderEmail: {
        type: String,
        default: ''
    },
    subject: {
        type: String,
        default: ''
    },
    htmlContent: {
        type: String,
        default: ''
    },
    textContent: {
        type: String,
        default: ''
    },
    attachments: [{
        filename: { type: String, default: '' },
        contentType: { type: String, default: '' },
        size: { type: Number, default: 0 }
    }],
    sentAt: {
        type: Date,
        default: Date.now
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
    brevoMessageId: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['accepted', 'delivered', 'opened', 'deferred', 'bounced', 'blocked', 'failed'],
        required: true
    },
    failureReason: {
        type: String,
        default: null
    },
    isResend: {
        type: Boolean,
        default: false
    },
    pdfAttached: {
        type: Boolean,
        default: false
    },
    pdfFilename: {
        type: String,
        default: ''
    },
    idempotencyKey: {
        type: String,
        default: null
    }
}, { _id: true });

const purchaseOrderSchema = new mongoose.Schema({
    purchaseOrderNumber: {
        type: String,
        required: true,
        unique: true
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    status: {
        type: String,
        enum: ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'],
        default: 'Draft'
    },
    items: [purchaseOrderItemSchema],
    notes: {
        type: String
    },
    expectedDeliveryDate: {
        type: Date
    },
    // Financials
    subtotal: {
        type: Number,
        required: true,
        default: 0
    },
    taxAmount: {
        type: Number,
        required: true,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        default: 0
    },
    gstRate: {
        type: Number,
        default: 10
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderedAt: {
        type: Date
    },
    receivedAt: {
        type: Date
    },
    emailHistory: {
        type: [purchaseOrderEmailLogSchema],
        default: []
    },
    lastEmailStatus: {
        status: {
            type: String,
            enum: ['not_sent', 'accepted', 'delivered', 'opened', 'deferred', 'bounced', 'blocked', 'failed'],
            default: 'not_sent'
        },
        lastSentAt: {
            type: Date,
            default: null
        },
        lastRecipientEmail: {
            type: String,
            default: ''
        },
        lastBrevoMessageId: {
            type: String,
            default: ''
        },
        lastFailureReason: {
            type: String,
            default: null
        },
        sendCount: {
            type: Number,
            default: 0
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

purchaseOrderSchema.index({ supplierId: 1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ isActive: 1 });
purchaseOrderSchema.index({ createdAt: -1 });
purchaseOrderSchema.index({ isActive: 1, status: 1, createdAt: -1 });
purchaseOrderSchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
