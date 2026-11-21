import mongoose from 'mongoose';
import VehicleBatch from './src/models/VehicleBatch.js';
import VehicleBatchMembership from './src/models/VehicleBatchMembership.js';
import Vehicle from './src/models/Vehicle.js';
import JobCard from './src/models/JobCard.js';
import Customer from './src/models/Customer.js';
import { createBatch } from './src/controllers/vehicleBatchController.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gsk_automotive_dev';

async function runTest() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Create a test customer
  const customer = await Customer.create({
    name: 'Test Customer ' + Date.now(),
    type: 'company'
  });

  const vehiclesBefore = await Vehicle.countDocuments();
  const jobCardsBefore = await JobCard.countDocuments();

  // Create mock req and res
  const cars = Array.from({ length: 5 }).map((_, i) => ({
    registrationNumber: `TEST${i}`,
    make: 'Toyota',
    model: 'Test',
    serviceType: 'Service'
  }));

  const req = {
    body: {
      type: 'IMPORT',
      customerId: customer._id,
      cars
    }
  };

  let responseData;
  const res = {
    status: (code) => ({
      json: (data) => {
        responseData = data;
        console.log('Status:', code);
        console.log('Response:', data);
      }
    })
  };

  try {
    await createBatch(req, res);

    const vehiclesAfter = await Vehicle.countDocuments();
    const jobCardsAfter = await JobCard.countDocuments();
    const carsCreated = await VehicleBatchMembership.countDocuments({ batchId: responseData.data._id });
    
    console.log('Vehicles before:', vehiclesBefore, 'after:', vehiclesAfter);
    console.log('Job Cards before:', jobCardsBefore, 'after:', jobCardsAfter);
    console.log('Tracker cars created:', carsCreated);

    if (vehiclesAfter > vehiclesBefore) {
       console.error("FAIL: Vehicles were created!");
       process.exit(1);
    }
    if (jobCardsAfter > jobCardsBefore) {
       console.error("FAIL: Job Cards were created!");
       process.exit(1);
    }
    if (carsCreated !== 5) {
       console.error("FAIL: Tracker cars were not created correctly!");
       process.exit(1);
    }

    console.log("PASS: Phase 39 architecture verified successfully.");

    // Cleanup
    await VehicleBatchMembership.deleteMany({ batchId: responseData.data._id });
    await VehicleBatch.findByIdAndDelete(responseData.data._id);
    await Customer.findByIdAndDelete(customer._id);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
