import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Customer from './src/models/Customer.js';
import VehicleTemplate from './src/models/VehicleTemplate.js';
import VehicleBatch from './src/models/VehicleBatch.js';
import VehicleBatchMembership from './src/models/VehicleBatchMembership.js';
import { createBatch, bulkAddTrackerCars } from './src/controllers/vehicleBatchController.js';

dotenv.config();

async function runTests() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    let superAdmin, customer, vehicleType;

    try {
        // Create Mock Super Admin
        superAdmin = new User({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin.bulk.test@gsk.local',
            password: 'password123',
            role: 'super_admin'
        });
        await superAdmin.save();

        // Create Customer
        customer = new Customer({
            name: 'Bulk Add Test Customer',
            email: 'bulk.test@gsk.local',
            phone: '123456789',
            address: '123 Test St',
            customerType: 'Rental'
        });
        await customer.save();
        
        // Create Vehicle Type
        vehicleType = new VehicleTemplate({
            customerId: customer._id,
            name: 'Toyota Corolla 2024',
            make: 'Toyota',
            model: 'Corolla',
            year: '2024',
            vehicleType: 'Sedan',
            fuelType: 'Petrol',
            defaultServiceType: 'Standard Service',
            isActive: true
        });
        await vehicleType.save();

        console.log("Setup complete. Testing createBatch controller (should create 0 cars)...");

        // Setup mock req, res for Create Tracker
        let resData = null;
        let resStatus = 0;
        
        const reqCreate = {
            user: superAdmin,
            body: {
                type: 'RENTAL',
                customerId: customer._id.toString(),
                notes: 'Test creation with 0 cars initially',
            },
            logAudit: async (data) => console.log('Audit logged:', data.action)
        };
        const resCreate = {
            status: function(s) { resStatus = s; return this; },
            json: function(d) { resData = d; return this; }
        };

        await createBatch(reqCreate, resCreate);

        if (resStatus !== 201) throw new Error('Expected status 201, got ' + resStatus);

        const newBatchId = resData.data._id;
        console.log("Created batch ID:", newBatchId);

        let memberships = await VehicleBatchMembership.find({ batchId: newBatchId });
        if (memberships.length !== 0) throw new Error('Expected 0 memberships after creation, got ' + memberships.length);

        console.log("✅ Tracker creation test passed. 0 cars created.");

        // Setup mock req, res for Bulk Add
        console.log("Testing bulkAddTrackerCars controller (should create 10 cars)...");
        let bulkResData = null;
        let bulkResStatus = 0;
        
        const reqBulk = {
            user: superAdmin,
            params: { id: newBatchId },
            body: {
                vehicleTypeId: vehicleType._id.toString(),
                quantity: 10
            }
        };
        const resBulk = {
            status: function(s) { bulkResStatus = s; return this; },
            json: function(d) { bulkResData = d; return this; }
        };

        await bulkAddTrackerCars(reqBulk, resBulk);

        if (bulkResStatus !== 201) {
            console.error(bulkResData);
            throw new Error('Expected status 201 on bulk add, got ' + bulkResStatus);
        }
        if (bulkResData.carsCreated !== 10) throw new Error('Expected 10 carsCreated, got ' + bulkResData.carsCreated);

        memberships = await VehicleBatchMembership.find({ batchId: newBatchId });
        if (memberships.length !== 10) throw new Error('Expected 10 memberships in DB after bulk add, got ' + memberships.length);

        console.log('✅ Bulk Add test passed successfully with 10 memberships created:');
        memberships.slice(0,3).forEach(m => console.log("Example reference:", m.referenceNumber));

        // Test appending cars
        console.log("Testing appending 5 more cars...");
        const reqBulk2 = { ...reqBulk, body: { vehicleTypeId: vehicleType._id.toString(), quantity: 5 } };
        const resBulk2 = {
            status: function(s) { bulkResStatus = s; return this; },
            json: function(d) { bulkResData = d; return this; }
        };
        await bulkAddTrackerCars(reqBulk2, resBulk2);
        
        memberships = await VehicleBatchMembership.find({ batchId: newBatchId });
        if (memberships.length !== 15) throw new Error('Expected 15 memberships in DB after second bulk add, got ' + memberships.length);
        
        console.log('✅ Second Bulk Add test passed successfully (total 15 cars).');
        memberships.slice(9, 13).forEach(m => console.log("Example reference:", m.referenceNumber));

    } catch (e) {
        console.error('❌ Test failed:', e);
    } finally {
        if (superAdmin) await User.findByIdAndDelete(superAdmin._id);
        if (customer) await Customer.findByIdAndDelete(customer._id);
        if (vehicleType) await VehicleTemplate.findByIdAndDelete(vehicleType._id);
        
        const testBatches = await VehicleBatch.find({ customerId: customer?._id });
        for (const tb of testBatches) {
            await VehicleBatchMembership.deleteMany({ batchId: tb._id });
            await VehicleBatch.findByIdAndDelete(tb._id);
        }
        await mongoose.disconnect();
    }
}

runTests();
