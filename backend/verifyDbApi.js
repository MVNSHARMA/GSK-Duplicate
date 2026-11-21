import mongoose from 'mongoose';
import VehicleBatch from './src/models/VehicleBatch.js';
import VehicleBatchMembership from './src/models/VehicleBatchMembership.js';
import { deriveTrackerStatusAndCounts, recalculateBatchStatus } from './src/controllers/vehicleBatchController.js';
import dotenv from 'dotenv';
dotenv.config();

async function verifyFlow() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gsk-automotive');
    console.log('Connected to DB');

    // Create a mock batch
    const batch = await VehicleBatch.create({
        batchNumber: `TEST-IMPORT-${Date.now()}`,
        type: 'IMPORT',
        status: 'EXPECTED',
        carSequenceCounter: 3
    });

    // Create memberships
    const mem1 = await VehicleBatchMembership.create({ batchId: batch._id, vin: 'VIN1', status: 'Received' });
    const mem2 = await VehicleBatchMembership.create({ batchId: batch._id, vin: 'VIN2', status: 'Received' });
    const mem3 = await VehicleBatchMembership.create({ batchId: batch._id, vin: 'VIN3', status: 'Received' });

    // Recalculate
    await recalculateBatchStatus(batch._id);
    let updatedBatch = await VehicleBatch.findById(batch._id);
    console.log('After received:', updatedBatch.status); // Expect: RECEIVED

    // Set 2 to Delivered, 1 to In Service
    mem1.status = 'Delivered';
    await mem1.save();
    mem2.status = 'Delivered';
    await mem2.save();
    mem3.status = 'In Service';
    await mem3.save();

    await recalculateBatchStatus(batch._id);
    updatedBatch = await VehicleBatch.findById(batch._id);
    console.log('After 2 Delivered, 1 In Service:', updatedBatch.status); // Expect: IN PROGRESS

    // Cancel 1, Deliver the rest
    mem3.status = 'Cancelled';
    await mem3.save();
    await recalculateBatchStatus(batch._id);
    updatedBatch = await VehicleBatch.findById(batch._id);
    console.log('After 2 Delivered, 1 Cancelled:', updatedBatch.status); // Expect: DELIVERED

    // Cleanup
    await VehicleBatchMembership.deleteMany({ batchId: batch._id });
    await VehicleBatch.findByIdAndDelete(batch._id);

    await mongoose.disconnect();
}

verifyFlow().catch(console.error);
