import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    contactPerson: { 
        type: String,
        trim: true
    },
    email: { 
        type: String,
        trim: true,
        lowercase: true
    },
    phone: { 
        type: String,
        trim: true
    },
    address: { 
        type: String,
        trim: true
    },
    notes: { 
        type: String 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

supplierSchema.index({ name: 'text' });
supplierSchema.index({ isActive: 1 });

export default mongoose.model('Supplier', supplierSchema);
