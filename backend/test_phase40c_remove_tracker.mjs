import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Customer from './src/models/Customer.js';
import VehicleBatch from './src/models/VehicleBatch.js';
import VehicleBatchMembership from './src/models/VehicleBatchMembership.js';
import { deleteBatch } from './src/controllers/vehicleBatchController.js';

dotenv.config();

async function runTests() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    let superAdmin, customer, batch, membership;

    try {
        // Create Mock Super Admin
        superAdmin = new User({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin.trackerdelete.test@gsk.local',
            password: 'password123',
            role: 'super_admin'
        });
        await superAdmin.save();

        // Create Customer
        customer = new Customer({
            name: 'Delete Tracker Test Customer',
            email: 'delete.tracker.test@gsk.local',
            phone: '123456789',
            address: '123 Test St',
            customerType: 'Import'
        });
        await customer.save();

        // Create Tracker
        batch = new VehicleBatch({
            customerId: customer._id,
            type: 'IMPORT',
            batchNumber: 'IMP-DELETE-TEST-1',
            actualVehicleCount: 1,
            isActive: true
        });
        await batch.save();

        // Create Tracker Car
        membership = new VehicleBatchMembership({
            batchId: batch._id,
            registrationNumber: 'DEL-123',
            make: 'Toyota',
            model: 'Corolla',
            year: 2021,
            vin: 'DELVIN123',
            isActive: true
        });
        await membership.save();

        console.log("Setup complete. Testing delete controller...");

        const req = {
            params: { id: batch._id.toString() },
            logAudit: async (data) => console.log('Audit logged:', data.action)
        };
        const res = {
            status: function(s) { this.statusCode = s; return this; },
            json: function(d) { this.data = d; return this; }
        };

        await deleteBatch(req, res);

        if (res.statusCode !== 200) {
            throw new Error('Expected status 200, got ' + res.statusCode);
        }

        const deletedBatch = await VehicleBatch.findById(batch._id);
        if (deletedBatch.isActive !== false) {
            throw new Error('Batch was not soft deleted');
        }

        const deletedMembership = await VehicleBatchMembership.findById(membership._id);
        if (deletedMembership.isActive !== false) {
            throw new Error('Membership was not soft deleted');
        }

        console.log('✅ Tracker delete test passed successfully');
    } catch (e) {
        console.error('❌ Test failed:', e);
    } finally {
        if (superAdmin) await User.findByIdAndDelete(superAdmin._id);
        if (customer) await Customer.findByIdAndDelete(customer._id);
        if (batch) await VehicleBatch.findByIdAndDelete(batch._id);
        if (membership) await VehicleBatchMembership.findByIdAndDelete(membership._id);
        await mongoose.disconnect();
    }
}

runTests();
