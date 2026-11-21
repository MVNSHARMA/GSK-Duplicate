import mongoose from 'mongoose';

const dealerCarSchema = new mongoose.Schema({
    vehicleId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Vehicle'
        // required: false for backward compatibility
    },
    make: { type: String },
    model: { type: String },
    year: { type: Number },
    registrationNumber: { type: String },
    vin: { type: String },
    mileage: { type: Number },
    colour: { type: String },
    purchaseDate: { type: Date, default: Date.now },
    dealerName: { type: String, required: true },
    cost: { type: Number, required: true },
    sellPrice: { type: Number, required: true },
    notes: { type: String },
    status: { 
        type: String, 
        enum: ['In Stock', 'Sold'],
        default: 'In Stock'
    },
    soldFor: { type: Number },
    soldDate: { type: Date },
    buyerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Customer' 
    },
    buyerName: { type: String, trim: true },
    buyerPhone: { type: String, trim: true },
    buyerEmail: { type: String, trim: true },
    buyerLicense: {
        licenseNumber: { type: String, trim: true, default: '' },
        holderName: { type: String, trim: true, default: '' },
        issuingState: { type: String, trim: true, default: '' },
        expiryDate: { type: Date, default: null },
        licenseClass: { type: String, trim: true, default: '' },
        documentUrl: { type: String, default: '' },
        documentPublicId: { type: String, default: '' },
        documentName: { type: String, default: '' },
        documentMimeType: { type: String, default: '' },
        documentSize: { type: Number, default: null },
        uploadedAt: { type: Date, default: null }
    },
    buyerAddress: {
        addressLine1: { type: String, trim: true, default: '' },
        addressLine2: { type: String, trim: true, default: '' },
        suburb: { type: String, trim: true, default: '' },
        state: { type: String, trim: true, default: '' },
        postcode: { type: String, trim: true, default: '' },
        country: { type: String, trim: true, default: 'Australia' }
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

dealerCarSchema.index({ isActive: 1, status: 1, createdAt: -1 });
dealerCarSchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model('DealerCar', dealerCarSchema);
