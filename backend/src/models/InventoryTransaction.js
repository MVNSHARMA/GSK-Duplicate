import mongoose from 'mongoose';

const inventoryTransactionSchema = new mongoose.Schema({
    inventoryId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Inventory', 
        required: true 
    },
    variantId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['IN', 'OUT', 'ADJUSTMENT', 'JOB_CARD_USAGE', 'PURCHASE_RECEIPT'], 
        required: true 
    },
    quantity: { 
        type: Number, 
        required: true 
    },
    unitPurchasePrice: {
    type: Number,
    min: 0
    },
    previousQuantity: { 
        type: Number, 
        required: true,
        min: 0
    },
    newQuantity: { 
        type: Number, 
        required: true,
        min: 0
    },
    reason: { 
        type: String 
    },
    jobCardId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'JobCard' 
    },
    purchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder'
    },
    performedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    }
}, { timestamps: true });

inventoryTransactionSchema.index({ inventoryId: 1, variantId: 1 });
inventoryTransactionSchema.index({ jobCardId: 1 });
inventoryTransactionSchema.index({ purchaseOrderId: 1 });
inventoryTransactionSchema.index({ createdAt: -1 });
inventoryTransactionSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('InventoryTransaction', inventoryTransactionSchema);
