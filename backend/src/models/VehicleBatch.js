import mongoose from 'mongoose';

const vehicleBatchSchema = new mongoose.Schema({
    batchNumber: { 
        type: String, 
        required: true, 
        unique: true 
    },
    customerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Customer', 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['IMPORT', 'RENTAL', 'FLEET_SERVICE'],
        required: true 
    },
    referenceNumber: { type: String },
    expectedVehicleCount: { type: Number, default: 0 },
    status: { 
        type: String, 
        enum: ['DRAFT', 'EXPECTED', 'RECEIVED', 'IN_PROGRESS', 'IN PROGRESS', 'WAITING FOR APPROVAL', 'WAITING FOR PARTS', 'COMPLIANCE', 'READY FOR COLLECTION', 'PARTIALLY_COMPLETED', 'COMPLETED', 'COLLECTED', 'DELIVERED', 'CANCELLED', 'ACTIVE'],
        default: 'EXPECTED'
    },
    expectedArrivalDate: { type: Date },
    expectedCompletionDate: { type: Date },
    notes: { type: String },
    carSequenceCounter: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

vehicleBatchSchema.index({ customerId: 1 });
vehicleBatchSchema.index({ type: 1 });
vehicleBatchSchema.index({ status: 1 });

export default mongoose.model('VehicleBatch', vehicleBatchSchema);
