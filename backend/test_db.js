import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import VehicleBatch from './src/models/VehicleBatch.js';
import Customer from './src/models/Customer.js';

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const batches = await VehicleBatch.find({ type: 'IMPORT' }).populate('customerId');
    console.log("All IMPORT batches:");
    batches.forEach(b => {
        console.log(`ID: ${b._id}, Active: ${b.isActive}, Customer: ${b.customerId?.name || 'No Customer'}, Ref: ${b.referenceNumber}`);
    });
    
    process.exit(0);
}
test();
