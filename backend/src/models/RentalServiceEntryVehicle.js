import mongoose from 'mongoose';

/**
 * RentalServiceEntryVehicle — Child model.
 * Links a single Vehicle to a parent RentalServiceEntry.
 * Each vehicle has its own independent status and status history timeline.
 *
 * NOTE: JobCard.rentalEntryId references THIS model's _id.
 * See JobCard.js for the field documentation.
 */

const statusHistoryItemSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['Received', 'In Service', 'Stuck', 'Completed'],
        required: true
    },
    timestamp: { type: Date, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const rentalServiceEntryVehicleSchema = new mongoose.Schema({
    serviceEntryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RentalServiceEntry',
        required: true
    },
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    status: {
        type: String,
        enum: ['Received', 'In Service', 'Stuck', 'Completed'],
        default: 'Received'
    },
    statusUpdatedAt: { type: Date, default: Date.now },
    statusHistory: [statusHistoryItemSchema],
    completionOdometer: { type: Number },
    jobCardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobCard'
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

rentalServiceEntryVehicleSchema.index({ serviceEntryId: 1, isActive: 1 });
rentalServiceEntryVehicleSchema.index({ vehicleId: 1 });
rentalServiceEntryVehicleSchema.index({ jobCardId: 1 });

export default mongoose.model('RentalServiceEntryVehicle', rentalServiceEntryVehicleSchema);
