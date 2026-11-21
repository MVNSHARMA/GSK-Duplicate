import mongoose from 'mongoose';

const vehicleDocumentSchema = new mongoose.Schema({
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    documentType: {
        type: String,
        enum: ['Pink Slip', 'Blue Slip', 'Compliance Certificate', 'Inspection Report', 'Arrival', 'Existing Damage', 'Completion', 'Registration', 'Insurance', 'Service', 'Condition Report', 'Other'],
        required: true
    },
    documentName: {
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
    fileSize: {
        type: Number
    },
    documentDate: {
        type: Date
    },
    expiryDate: {
        type: Date
    },
    notes: {
        type: String
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

vehicleDocumentSchema.index({ vehicleId: 1 });
vehicleDocumentSchema.index({ isActive: 1 });

export default mongoose.model('VehicleDocument', vehicleDocumentSchema);
