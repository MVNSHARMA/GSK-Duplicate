import mongoose from 'mongoose';

const vehicleTemplateSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number },
    variant: { type: String },
    notes: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

vehicleTemplateSchema.index({ customerId: 1 });
vehicleTemplateSchema.index({ isActive: 1 });

export default mongoose.model('VehicleTemplate', vehicleTemplateSchema);
