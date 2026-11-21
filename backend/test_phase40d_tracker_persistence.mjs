import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Customer from './src/models/Customer.js';
import VehicleBatch from './src/models/VehicleBatch.js';
import VehicleBatchMembership from './src/models/VehicleBatchMembership.js';
import { createBatch } from './src/controllers/vehicleBatchController.js';

dotenv.config();

async function runTests() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    let superAdmin, customer;

    try {
        // Create Mock Super Admin
        superAdmin = new User({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin.trackercreate.test@gsk.local',
            password: 'password123',
            role: 'super_admin'
        });
        await superAdmin.save();

        // Create Customer
        customer = new Customer({
            name: 'Create Tracker Test Customer',
            email: 'create.tracker.test@gsk.local',
            phone: '123456789',
            address: '123 Test St',
            customerType: 'Rental'
        });
        await customer.save();

        console.log("Setup complete. Testing createBatch controller...");

        // Setup mock req, res
        let resData = null;
        let resStatus = 0;
        
        const req = {
            user: superAdmin,
            body: {
                type: 'RENTAL',
                customerId: customer._id.toString(),
                notes: 'Test creation with 10 cars',
                cars: Array.from({length: 10}).map((_, i) => ({
                    registrationNumber: '',
                    make: 'Toyota',
                    model: 'Corolla',
                    year: '2023',
                    vin: '',
                    serviceType: '',
                    status: 'Pending',
                    notes: ''
                }))
            },
            logAudit: async (data) => console.log('Audit logged:', data.action)
        };
        const res = {
            status: function(s) { resStatus = s; return this; },
            json: function(d) { resData = d; return this; }
        };

        await createBatch(req, res);

        if (resStatus !== 201) {
            console.error(resData);
            throw new Error('Expected status 201, got ' + resStatus);
        }
        
        if (resData.carsCreated !== 10) {
            throw new Error('Expected 10 carsCreated, got ' + resData.carsCreated);
        }

        const newBatchId = resData.data._id;
        console.log("Created batch ID:", newBatchId);

        const savedBatch = await VehicleBatch.findById(newBatchId);
        if (!savedBatch) {
            throw new Error('Batch not saved to DB');
        }

        const memberships = await VehicleBatchMembership.find({ batchId: newBatchId });
        if (memberships.length !== 10) {
            throw new Error('Expected 10 memberships in DB, got ' + memberships.length);
        }

        console.log('✅ Tracker creation test passed successfully with 10 memberships correctly sequenced:');
        memberships.slice(0,2).forEach(m => console.log("Example reference:", m.referenceNumber));

    } catch (e) {
        console.error('❌ Test failed:', e);
    } finally {
        if (superAdmin) await User.findByIdAndDelete(superAdmin._id);
        if (customer) await Customer.findByIdAndDelete(customer._id);
        // Clean up created batches/memberships in test
        const testBatches = await VehicleBatch.find({ customerId: customer?._id });
        for (const tb of testBatches) {
            await VehicleBatchMembership.deleteMany({ batchId: tb._id });
            await VehicleBatch.findByIdAndDelete(tb._id);
        }
        await mongoose.disconnect();
    }
}

runTests();
