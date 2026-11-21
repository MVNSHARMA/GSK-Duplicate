import mongoose from 'mongoose';

const invoiceEmailHistoryEntrySchema = new mongoose.Schema(
    {
        batchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InvoiceEmailLog',
            default: null
        },
        mode: {
            type: String,
            enum: ['single', 'consolidated'],
            default: 'single'
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            default: null
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
                ref: 'Invoice'
            }
        ],
        invoiceNumbers: [
            {
                type: String
            }
        ],
        invoiceCount: {
            type: Number,
            default: 1
        },
        combinedAmount: {
            type: Number,
            default: 0
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
            enum: ['accepted', 'delivered', 'failed'],
            required: true
        },
        failureReason: {
            type: String,
            default: null
        },
        pdfFilename: {
            type: String,
            default: ''
        },
        isResend: {
            type: Boolean,
            default: false
        }
    },
    { _id: true }
);

const invoiceSchema = new mongoose.Schema(
    {
        invoiceNo: {
            type: String,
            required: true,
            unique: true
        },

        type: {
            type: String,
            enum: [
                'Service Invoice',
                'General Invoice',
                'Rental Invoice',
                'Custom Invoice'
            ],
            required: true
        },

        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true
        },

        // Permanent vehicle for regular customers
        vehicleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vehicle'
        },

        // Fleet/rental/import tracker relationship
        trackerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VehicleBatch'
        },

        trackerCarId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VehicleBatchMembership'
        },

        jobCardId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'JobCard'
        },

        mechanic: {
            type: String
        },

        // Legacy compatibility
        rentalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Rental'
        },

        partsAndLabour: [
            {
                inventoryId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Inventory'
                },

                variantId: {
                    type: mongoose.Schema.Types.ObjectId
                },

                description: {
                    type: String
                },

                qty: {
                    type: Number,
                    default: 1
                },

                price: {
                    type: Number,
                    default: 0
                }
            }
        ],

        checklist: [{ type: String }],

        recommendations: [{ type: String }],

        notes: {
            type: String
        },

        status: {
            type: String,
            enum: ['Draft', 'Unpaid', 'Partially Paid', 'Paid', 'Cancelled', 'Voided'],
            default: 'Unpaid'
        },

        invoiceDate: {
            type: Date,
            default: Date.now
        },

        issuedAt: {
            type: Date,
            default: null
        },

        customerSnapshot: {
            name: { type: String, default: '' },
            email: { type: String, default: '' },
            phone: { type: String, default: '' },
            address: { type: String, default: '' },
            customerType: { type: String, default: 'individual' },
            idType: { type: String, default: '' },
            idNumber: { type: String, default: '' },
            capturedAt: { type: Date, default: null }
        },

        vehicleSnapshot: {
            registrationNumber: { type: String, default: '' },
            brand: { type: String, default: '' },
            make: { type: String, default: '' },
            model: { type: String, default: '' },
            year: { type: String, default: '' },
            vin: { type: String, default: '' }
        },

        isArchived: {
            type: Boolean,
            default: false
        },

        archiveStatus: {
            type: String,
            enum: ['active', 'archived'],
            default: 'active'
        },

        archivedAt: {
            type: Date,
            default: null
        },

        archivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },

        archiveReason: {
            type: String,
            default: ''
        },

        cancellationDetails: {
            cancelledAt: { type: Date, default: null },
            cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            cancelledByName: { type: String, default: '' },
            reason: { type: String, default: '' },
            actionType: { type: String, enum: ['Cancelled', 'Voided', null], default: null },
            originalStatus: { type: String, default: '' },
            originalTotalAmount: { type: Number, default: 0 },
            history: [
                {
                    action: { type: String },
                    status: { type: String },
                    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
                    performedByName: { type: String, default: '' },
                    reason: { type: String, default: '' },
                    performedAt: { type: Date, default: Date.now }
                }
            ]
        },

        lastMeaningfulActivityAt: {
            type: Date,
            default: Date.now
        },

        retentionMetadata: {
            retentionPeriodYears: { type: Number, default: 5 },
            retainUntil: { type: Date, default: null },
            legalHold: { type: Boolean, default: false },
            legalHoldReason: { type: String, default: '' },
            reviewStatus: {
                type: String,
                enum: ['not_due', 'pending_review', 'retained', 'approved_for_disposal'],
                default: 'not_due'
            },
            draftReviewStatus: {
                type: String,
                enum: ['active', 'pending_review', 'retained', 'approved_for_deletion'],
                default: 'active'
            },
            lastReviewedAt: { type: Date, default: null },
            lastReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            lastReviewedByName: { type: String, default: '' },
            reviewNotes: { type: String, default: '' }
        },

        amountPaid: {
            type: Number,
            default: 0
        },

        isActive: {
            type: Boolean,
            default: true
        },

        invoiceEmailSent: {
            type: Boolean,
            default: false
        },

        invoiceEmailSentAt: {
            type: Date
        },

        lastEmailStatus: {
            status: {
                type: String,
                enum: ['not_sent', 'accepted', 'delivered', 'failed'],
                default: 'not_sent'
            },
            mode: {
                type: String,
                enum: ['single', 'consolidated', null],
                default: null
            },
            sentAt: { type: Date, default: null },
            recipientEmail: { type: String, default: '' },
            sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            sentByName: { type: String, default: '' },
            brevoMessageId: { type: String, default: '' },
            batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'InvoiceEmailLog', default: null },
            invoiceNumbersInBatch: [{ type: String }],
            invoiceCountInBatch: { type: Number, default: 0 },
            failureReason: { type: String, default: null }
        },

        emailHistory: {
            type: [invoiceEmailHistoryEntrySchema],
            default: []
        },

        paidAt: {
            type: Date
        },

        // Financial fields
        subtotal: {
            type: Number
        },

        gstRate: {
            type: Number
        },

        gstAmount: {
            type: Number
        },

        totalAmount: {
            type: Number,
            get: function (v) {
                // Use stored total when available
                if (v != null) {
                    return v;
                }

                // Fallback for older invoices
                if (
                    !this.partsAndLabour ||
                    this.partsAndLabour.length === 0
                ) {
                    return 0;
                }

                return this.partsAndLabour.reduce(
                    (total, item) =>
                        total + (item.qty * item.price),
                    0
                );
            }
        }
    },
    {
        timestamps: true
    }
);


// ============================================================
// VALIDATION
// ============================================================

invoiceSchema.pre('validate', function () {
    if (this.isArchived) {
        this.archiveStatus = 'archived';
    } else if (!this.archiveStatus) {
        this.archiveStatus = 'active';
    }

    // Draft, General and Custom invoices don't require
    // a vehicle or tracker relationship.
    if (
        this.status === 'Draft' ||
        this.type === 'General Invoice' ||
        this.type === 'Custom Invoice'
    ) {
        return;
    }


    // Rental invoices belong to a Rental Tracker + Tracker Car.
    if (this.type === 'Rental Invoice') {

        if (!this.trackerId || !this.trackerCarId) {
            throw new Error('Rental invoices require trackerId and trackerCarId.');
        }

        return;
    }


    // Service invoices can belong to either:
    //
    // Regular customer:
    //     vehicleId
    //
    // Fleet/tracker customer:
    //     trackerId + trackerCarId
    //
    if (
        !this.vehicleId &&
        (!this.trackerId || !this.trackerCarId)
    ) {
        throw new Error('Service invoices require either vehicleId or trackerId + trackerCarId.');
    }
});


// ============================================================
// JSON / OBJECT OPTIONS
// ============================================================

invoiceSchema.set('toJSON', {
    getters: true,
    virtuals: true
});

invoiceSchema.set('toObject', {
    getters: true,
    virtuals: true
});


// ============================================================
// INDEXES
// ============================================================

invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ vehicleId: 1 });
invoiceSchema.index({ trackerId: 1 });
invoiceSchema.index({ trackerCarId: 1 });
invoiceSchema.index({ jobCardId: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ isActive: 1, isArchived: 1, status: 1, invoiceDate: -1 });
invoiceSchema.index({ isActive: 1, status: 1, lastMeaningfulActivityAt: 1 });
invoiceSchema.index({ invoiceDate: 1 });
invoiceSchema.index({ 'customerSnapshot.name': 1 });
invoiceSchema.index({ 'vehicleSnapshot.registrationNumber': 1 });


// ============================================================
// MODEL
// ============================================================

export default mongoose.model('Invoice', invoiceSchema);