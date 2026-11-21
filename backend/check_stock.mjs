import mongoose from 'mongoose';
import Inventory from './src/models/Inventory.js';
import { computeInventoryStock } from './src/utils/inventoryStock.js';
import { config } from 'dotenv';
config();

async function checkInventory() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    try {
        const items = await Inventory.find().limit(3).lean();
        items.forEach(item => {
            const computed = computeInventoryStock(item);
            console.log(`Product: ${computed.itemName} | Total Stock: ${computed.totalStock}`);
        });
    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}

checkInventory();
