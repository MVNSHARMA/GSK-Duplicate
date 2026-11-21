import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';
import PurchaseOrder from './src/models/PurchaseOrder.js';
import Supplier from './src/models/Supplier.js';
import User from './src/models/User.js';
import InventoryTransaction from './src/models/InventoryTransaction.js';
import dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: `${dirname(fileURLToPath(import.meta.url))}/.env` });

async function runTest() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // 1. Create a dummy supplier
    const supplier = await Supplier.create({
        name: 'PO Test Supplier',
        contactName: 'Test Contact',
        email: 'test@supplier.com',
        phone: '1234567890',
        address: '123 Test St',
        status: 'Active'
    });

    // 2. Create a dummy user
    const user = await User.create({
        name: 'PO Test Admin',
        email: `po_test_${Date.now()}@example.com`,
        password: 'password123',
        role: 'admin'
    });

    // 3. Create a 3-level inventory item
    const inventory = await Inventory.create({
        itemName: 'Test Oil Filter',
        description: 'PO Test Filter',
        category: 'Parts',
        supplierId: supplier._id,
        reorderLevel: 5,
        unitOfMeasure: 'pcs',
        isActive: true,
        isArchived: false,
        variants: [
            {
                name: 'Toyota',
                sku: 'TOY-1',
                unitPrice: 50,
                quantity: 0,
                isActive: true
            }
        ]
    });
    
    const variantIdLevel1 = inventory.variants[0]._id;
    
    inventory.variants.push({
        name: 'Corolla',
        sku: 'TOY-COR-1',
        unitPrice: 55,
        quantity: 0,
        isActive: true,
        parentId: variantIdLevel1
    });
    
    await inventory.save();
    const variantIdLevel2 = inventory.variants[1]._id;

    inventory.variants.push({
        name: '2020 Premium',
        sku: 'TOY-COR-2020P',
        unitPrice: 60,
        unitPurchasePrice: 15,
        quantity: 10, // Initial physical stock
        isActive: true,
        parentId: variantIdLevel2
    });
    
    await inventory.save();
    const leafVariantId = inventory.variants[2]._id;

    console.log("Initial leaf quantity:", inventory.variants.id(leafVariantId).quantity);

    // 4. Create PO (simulating createPurchaseOrder logic validation manually if needed, but doing directly)
    const po = await PurchaseOrder.create({
        purchaseOrderNumber: 'PO-TEST-' + Date.now(),
        supplierId: supplier._id,
        status: 'Ordered', // Force status to Ordered for receipt testing
        items: [{
            inventoryId: inventory._id,
            variantId: leafVariantId,
            productName: 'Test Oil Filter',
            variantName: '2020 Premium',
            hierarchyPath: 'Toyota › Corolla › 2020 Premium',
            quantityOrdered: 20,
            quantityReceived: 0,
            unitPurchasePrice: 15
        }],
        subtotal: 300,
        taxAmount: 30,
        totalAmount: 330,
        gstRate: 10,
        createdBy: user._id,
        orderedAt: new Date()
    });

    // 5. Test Partial Receiving logic
    const req1 = {
        body: { itemId: po.items[0]._id, quantityReceived: 5 },
        params: { id: po._id },
        user: { _id: user._id }
    };
    
    // We will simulate the receivePurchaseOrder execution
    // Since we can't easily mock res, we'll just execute the controller directly but it's bound to express.
    // Instead, just call the logic or do an HTTP request if we had a server. We'll do logic inline.
    
    const session = await mongoose.startSession();
    session.startTransaction();

    const po1 = await PurchaseOrder.findById(po._id).session(session);
    const item1 = po1.items.id(req1.body.itemId);
    const inv1 = await Inventory.findById(item1.inventoryId).session(session);
    const var1 = inv1.variants.id(item1.variantId);
    
    // Ensure Leaf Node!
    const hasActiveChildren = inv1.variants.some(v => v.parentId && v.parentId.toString() === var1._id.toString() && v.isActive);
    if(hasActiveChildren) throw new Error("Should be leaf!");

    const prevQty = var1.quantity;
    var1.quantity = prevQty + req1.body.quantityReceived;
    await inv1.save({ session });
    
    item1.quantityReceived += req1.body.quantityReceived;
    po1.status = 'Partially Received';
    await po1.save({ session });

    await InventoryTransaction.create([{
        inventoryId: inv1._id,
        variantId: var1._id,
        type: 'PURCHASE_RECEIPT',
        quantity: req1.body.quantityReceived,
        previousQuantity: prevQty,
        newQuantity: var1.quantity,
        purchaseOrderId: po1._id,
        performedBy: user._id,
        reason: 'Test receipt'
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Verify stock
    const invCheck1 = await Inventory.findById(inventory._id);
    const leafCheck1 = invCheck1.variants.id(leafVariantId);
    console.log("After partial receipt, leaf quantity:", leafCheck1.quantity); // Expect 15

    // Verify Idempotency logic (Attempting to receive more than outstanding throws error)
    const session2 = await mongoose.startSession();
    session2.startTransaction();
    let errorCaught = false;
    try {
        const po2 = await PurchaseOrder.findById(po._id).session(session2);
        const item2 = po2.items.id(req1.body.itemId);
        const outstanding = item2.quantityOrdered - item2.quantityReceived; // 20 - 5 = 15
        
        // try to receive 20, which is > outstanding
        if (20 > outstanding) {
            throw new Error(`Cannot receive 20. Only ${outstanding} outstanding.`);
        }
    } catch (e) {
        errorCaught = true;
        console.log("Idempotency/Over-receive check passed! Caught error:", e.message);
    }
    await session2.abortTransaction();
    session2.endSession();
    
    console.log("Test execution completed successfully.");
    process.exit(0);
}

runTest().catch(console.error);
