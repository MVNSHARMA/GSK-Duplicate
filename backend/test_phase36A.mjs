import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';
import { computeInventoryStock } from './src/utils/inventoryStock.js';
import { config } from 'dotenv';
config();

async function runTests() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    try {
        console.log("--- REQUIRED TEST CASE 11 ---");
        
        const product = await Inventory.create({
            itemName: 'Test Oil Filter 36A',
            category: 'Filters',
            variants: [
                { _id: new mongoose.Types.ObjectId(), name: 'Toyota', level: 1, quantity: 0 },
                { _id: new mongoose.Types.ObjectId(), name: 'Corolla', level: 2, quantity: 0 },
                { _id: new mongoose.Types.ObjectId(), name: 'A', level: 3, quantity: 10 },
                { _id: new mongoose.Types.ObjectId(), name: 'B', level: 3, quantity: 20 },
                { _id: new mongoose.Types.ObjectId(), name: 'Honda', level: 1, quantity: 0 },
                { _id: new mongoose.Types.ObjectId(), name: 'Civic', level: 2, quantity: 0 },
                { _id: new mongoose.Types.ObjectId(), name: 'Civic 2020', level: 3, quantity: 15 }
            ]
        });
        
        // Link them
        const vToyota = product.variants[0];
        const vCorolla = product.variants[1];
        const vA = product.variants[2];
        const vB = product.variants[3];
        
        const vHonda = product.variants[4];
        const vCivic = product.variants[5];
        const vCivic2020 = product.variants[6];
        
        vCorolla.parentId = vToyota._id;
        vA.parentId = vCorolla._id;
        vB.parentId = vCorolla._id;
        
        vCivic.parentId = vHonda._id;
        vCivic2020.parentId = vCivic._id;
        
        await product.save();

        const doc = await Inventory.findById(product._id).lean();
        const computedDoc = computeInventoryStock(doc);
        
        const toyota = computedDoc.variants.find(v => v.name === 'Toyota');
        const corolla = computedDoc.variants.find(v => v.name === 'Corolla');
        const honda = computedDoc.variants.find(v => v.name === 'Honda');
        const civic = computedDoc.variants.find(v => v.name === 'Civic');
        
        console.log(`Corolla: ${corolla.quantity} (Expected: 30)`);
        console.log(`Toyota: ${toyota.quantity} (Expected: 30)`);
        console.log(`Honda: ${honda.quantity} (Expected: 15)`);
        console.log(`Product totalStock: ${computedDoc.totalStock} (Expected: 45)`);
        
        if (computedDoc.totalStock !== 45) {
            throw new Error(`Product totalStock is wrong! Got ${computedDoc.totalStock}`);
        }
        
        // Clean up
        await Inventory.deleteMany({ _id: product._id });
        console.log("Test passed!");
    } catch(e) {
        console.error(e);
        process.exit(1);
    } finally {
        mongoose.disconnect();
    }
}

runTests();
