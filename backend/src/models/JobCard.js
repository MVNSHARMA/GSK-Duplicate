import mongoose from 'mongoose';

const jobCardSchema = new mongoose.Schema({
    vehicleId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Vehicle', 
        required: function() {
            // Required if no trackerCarId is present
            return !this.trackerCarId;
        }
    },
    trackerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VehicleBatch'
    },
    trackerCarId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VehicleBatchMembership'
    },
    // NOTE: Despite the name, this references a RentalServiceEntryVehicle (child),
    // not the parent RentalServiceEntry. Field name retained for compatibility.
    // rentalEntryId === RentalServiceEntryVehicle._id
    rentalEntryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RentalServiceEntryVehicle'
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    technicianId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    mechanic: {
        type: String
    },
    servicesOrdered: [{ type: String }],
    servicesProvided: [{
        name: { type: String, required: true },
        cost: { type: Number, default: 0 },
        quantity: { type: Number, default: 1 },
        total: { type: Number, default: 0 }
    }],
    partsUsed: [{
        inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
        variantId: { type: mongoose.Schema.Types.ObjectId },
        variantName: { type: String },
        quantity: { type: Number, required: true, default: 1, min: [1, 'Quantity must be at least 1'] },
        unitPrice: { type: Number, required: true, default: 0, min: [0, 'Unit price cannot be negative'] }
    }],
    needsAttention: [{ type: String }],
    repairsOrdered: { type: String },
    labourHours: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },
    charges: {
        lubricantsOil: { type: Number, default: 0 },
        differentialOil: { type: Number, default: 0 },
        miscellaneous: { type: Number, default: 0 },
        transmission: { type: Number, default: 0 },
        brakeFluid: { type: Number, default: 0 }
    },
    notes: { type: String },
    status: { 
        type: String, 
        enum: ['Open', 'In Progress', 'Waiting For Parts', 'Cancelled', 'Stuck', 'Completed', 'Waiting for Parts', 'Waiting for Review'],
        default: 'Open'
    },
    isActive: { type: Boolean, default: true },
    thankYouEmailSent: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completionNotificationSent: { type: Boolean, default: false },
    // Explicit Financial Fields
    discountAmount: { type: Number, default: 0, min: [0, 'Discount cannot be negative'] },
    subtotal: { type: Number },
    gstRate: { type: Number },
    gstAmount: { type: Number },
    finalAmount: { type: Number, default: null, min: [0, 'Final amount cannot be negative'] },
    financialsFinalized: { type: Boolean, default: false },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalizedAt: { type: Date, default: null },
    totalAmount: { 
        type: Number,
        get: function(v) {
            if (this.finalAmount != null && this.financialsFinalized) return this.finalAmount;
            if (v != null) return v;
            // Fallback logic for old records without stored totals (GST exclusive)
            let labourTotal = (this.labourHours || 0) * (this.hourlyRate || 0);
            let partsTotal = (this.charges?.lubricantsOil || 0) + 
                             (this.charges?.differentialOil || 0) + 
                             (this.charges?.miscellaneous || 0) + 
                             (this.charges?.transmission || 0) + 
                             (this.charges?.brakeFluid || 0);
            return Math.max(0, labourTotal + partsTotal - (this.discountAmount || 0));
        }
    }
}, { timestamps: true });

// Ensure getters are included in toJSON
jobCardSchema.set('toJSON', { getters: true, virtuals: true });
jobCardSchema.set('toObject', { getters: true, virtuals: true });

jobCardSchema.index({ customerId: 1 });
jobCardSchema.index({ vehicleId: 1 });
jobCardSchema.index({ bookingId: 1 });
jobCardSchema.index({ status: 1 });
jobCardSchema.index({ isActive: 1, createdAt: -1 });
jobCardSchema.index({ isActive: 1, status: 1, createdAt: -1 });

export default mongoose.model('JobCard', jobCardSchema);
