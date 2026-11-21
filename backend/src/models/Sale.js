import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema({
    customerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Customer' 
    },
    items: [{
        inventoryId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Inventory',
            required: true
        },
        quantity: { 
            type: Number, 
            required: true,
            min: 1
        },
        unitPrice: { 
            type: Number, 
            required: true 
        },
        discount: {
            type: Number,
            default: 0
        },
        subtotal: {
            type: Number,
            required: true
        }
    }],
    paymentMethod: { 
        type: String, 
        enum: ['Cash', 'Card', 'EFTPOS'],
        required: true
    },
    totalAmount: { 
        type: Number, 
        required: true 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

export default mongoose.model('Sale', saleSchema);
