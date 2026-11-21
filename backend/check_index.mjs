import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const VehicleBatchMembership = (await import('./src/models/VehicleBatchMembership.js')).default;
        const indexes = await VehicleBatchMembership.collection.indexes();
        console.log(JSON.stringify(indexes, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}
run();
