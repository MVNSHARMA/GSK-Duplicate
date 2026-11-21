import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const VehicleBatchMembership = (await import('./src/models/VehicleBatchMembership.js')).default;
        
        console.log("Dropping old index...");
        try {
            await VehicleBatchMembership.collection.dropIndex("batchId_1_vehicleId_1_isActive_1");
            console.log("Old index dropped.");
        } catch (e) {
            console.log("Error dropping (might not exist):", e.message);
        }

        console.log("Syncing indexes (creating new one from schema)...");
        await VehicleBatchMembership.syncIndexes();
        console.log("Sync complete.");
        
        const indexes = await VehicleBatchMembership.collection.indexes();
        console.log(JSON.stringify(indexes, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}
run();
