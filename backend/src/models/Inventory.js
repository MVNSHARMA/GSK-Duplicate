import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
    itemName: { 
        type: String, 
        required: true,
        trim: true
    },
    category: { 
        type: String, 
        required: true,
        trim: true
    },
    supplier: { 
        type: String,
        trim: true
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    variants: [{
        name: { type: String, required: true },
        sku: { type: String, trim: true },
        quantity: { type: Number, required: true, default: 0, min: 0 },
        minStockLevel: { type: Number, required: true, default: 0, min: 0 },
        unitPrice: { type: Number, required: true, default: 0, min: 0 },
        isActive: { type: Boolean, default: true },
        parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
        level: { type: Number, required: true, default: 1, min: 1, max: 3 },
        supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
        supplierSource: { type: String, enum: ['inherited', 'explicit'], default: 'inherited' }
    }]
}, { timestamps: true });

export default mongoose.model('Inventory', inventorySchema);
