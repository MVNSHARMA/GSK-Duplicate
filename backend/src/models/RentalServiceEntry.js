import mongoose from 'mongoose';

/**
 * RentalServiceEntry — Parent model.
 * Represents ONE service visit / intake for a rental company.
 * The vehicles within this visit are tracked in the child model:
 *   RentalServiceEntryVehicle
 *
 * Overall status is NOT stored here; it is computed deterministically
 * from the child vehicles' statuses using lowest-ordinal precedence.
 */
const rentalServiceEntrySchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    notes: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

rentalServiceEntrySchema.index({ customerId: 1 });
rentalServiceEntrySchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model('RentalServiceEntry', rentalServiceEntrySchema);
