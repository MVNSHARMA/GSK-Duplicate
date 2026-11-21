import mongoose from 'mongoose';
import { formatInTimeZone } from 'date-fns-tz';
const statusHistoryItemSchema = new mongoose.Schema({
    status: { type: String, required: true },
    timestamp: { type: Date, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const vehicleBatchMembershipSchema = new mongoose.Schema({
    batchId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'VehicleBatch', 
        required: true 
    },
    vehicleId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Vehicle', 
        required: false 
    },
    referenceNumber: { type: String, unique: true, sparse: true },
    registrationNumber: { type: String },
    make: { type: String },
    model: { type: String },
    year: { type: Number },
    vin: { type: String },
    serviceType: { type: String },
    status: { 
        type: String, 
        enum: ['Pending', 'Waiting', 'Completed', 'Expected', 'Received', 'Inspection', 'Waiting for Approval', 'In Service', 'Waiting for Parts', 'Compliance', 'Ready for Collection', 'Collected', 'Delivered', 'Cancelled', 'In Compliance', 'Stuck', 'Ready', 'Handed Over'],
        default: 'Expected'
    },
    statusHistory: [statusHistoryItemSchema],
    notes: { type: String },
    conditionNotes: { type: String },
    fuelLevel: { type: String },
    keysReceived: { type: Boolean, default: false },
    odometer: { type: Number },
    finalOdometer: { type: Number },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    jobCardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobCard'
    },
    // Compliance Fields
    complianceStatus: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Completed'],
        default: 'Not Started'
    },
    complianceNotes: { type: String },
    blueSlip: { type: String },
    pinkSlip: { type: String },
    addedAt: { type: Date, default: Date.now },
    receivedAt: { type: Date },
    inspectedAt: { type: Date },
    readyForCollectionAt: { type: Date },
    collectedAt: { type: Date },
    deliveredAt: { type: Date },
    deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    removedAt: { type: Date },
    statusUpdatedAt: { type: Date },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Prevent duplicate active membership for the same vehicle in the same batch (only if vehicleId exists)
vehicleBatchMembershipSchema.index(
    { batchId: 1, vehicleId: 1, isActive: 1 },
    { unique: true, partialFilterExpression: { vehicleId: { $exists: true }, isActive: true } }
);

vehicleBatchMembershipSchema.pre('save', function () {
    if (this.isModified('status')) {
        const now = new Date();
        const sydneyTime = formatInTimeZone(now, 'Australia/Sydney', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
        this.statusUpdatedAt = new Date(sydneyTime);
    }
});

vehicleBatchMembershipSchema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    if (update.status || (update.$set && update.$set.status)) {
        const now = new Date();
        const sydneyTime = formatInTimeZone(now, 'Australia/Sydney', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
        if (update.$set) {
            update.$set.statusUpdatedAt = new Date(sydneyTime);
        } else {
            update.statusUpdatedAt = new Date(sydneyTime);
        }
    }
});

vehicleBatchMembershipSchema.index({ vehicleId: 1 });
vehicleBatchMembershipSchema.index({ batchId: 1 });

vehicleBatchMembershipSchema.pre('save', async function() {
    if (this.isModified('status')) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date(),
            // Unfortunately, without request context in model, we can't always get updatedBy here.
            // updatedBy: null // We will leave updatedBy null if modified directly without push
        });
    }
});

export default mongoose.model('VehicleBatchMembership', vehicleBatchMembershipSchema);
