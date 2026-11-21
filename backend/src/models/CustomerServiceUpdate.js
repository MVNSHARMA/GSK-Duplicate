import mongoose from 'mongoose';

const customerServiceUpdateSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    vehicleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle'
    },
    jobCardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobCard',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

customerServiceUpdateSchema.index({ jobCardId: 1 });
customerServiceUpdateSchema.index({ customerId: 1 });

export default mongoose.model('CustomerServiceUpdate', customerServiceUpdateSchema);
