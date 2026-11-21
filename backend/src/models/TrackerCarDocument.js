import mongoose from 'mongoose';

const trackerCarDocumentSchema = new mongoose.Schema({
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VehicleBatch',
        required: true
    },
    membershipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VehicleBatchMembership',
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    type: {
        type: String,
        enum: ['Document', 'Photo'],
        required: true
    },
    category: {
        type: String,
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    publicId: {
        type: String,
        required: true
    },
    mimeType: {
        type: String
    },
    originalName: {
        type: String
    },
    isCustomerVisible: {
        type: Boolean,
        default: false
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

trackerCarDocumentSchema.index({ membershipId: 1 });
trackerCarDocumentSchema.index({ batchId: 1 });
trackerCarDocumentSchema.index({ customerId: 1 });
trackerCarDocumentSchema.index({ isActive: 1 });

export default mongoose.model('TrackerCarDocument', trackerCarDocumentSchema);
