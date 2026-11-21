import mongoose from 'mongoose';

const CUSTOMER_TYPES = ['regular', 'import_company', 'rental_company'];

const customerSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String },
    customerType: {
        type: String,
        enum: CUSTOMER_TYPES,
        default: 'regular'
    },
    idType: { type: String },
    idNumber: { type: String },
    notes: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export { CUSTOMER_TYPES };

customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ customerType: 1 });
customerSchema.index({ isActive: 1, customerType: 1, createdAt: -1 });
customerSchema.index({ isActive: 1, createdAt: -1 });

export default mongoose.model('Customer', customerSchema);
