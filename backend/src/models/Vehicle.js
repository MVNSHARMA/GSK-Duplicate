import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true, min: 1900, max: 2100 },
    registrationNumber: { type: String, uppercase: true, trim: true },
    vin: { type: String, uppercase: true, trim: true },
    engineNo: { type: String, trim: true },
    speedo: { type: String, trim: true },
    mileage: { type: Number, min: 0 },
    dailyRate: { type: Number, min: 0 },
    status: { 
        type: String, 
        enum: ['Available', 'Rented', 'Maintenance'],
        default: 'Available'
    },
    imageUrl: { type: String },
    isActive: { type: Boolean, default: true },
    notes: { type: String }
}, { timestamps: true });

vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ vin: 1 });
vehicleSchema.index({ customerId: 1 });
vehicleSchema.index({ isActive: 1, createdAt: -1 });
vehicleSchema.index({ customerId: 1, isActive: 1 });

export default mongoose.model('Vehicle', vehicleSchema);
