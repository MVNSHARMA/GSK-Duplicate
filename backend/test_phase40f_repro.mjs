import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Customer from './src/models/Customer.js';
import VehicleTemplate from './src/models/VehicleTemplate.js';
import VehicleBatch from './src/models/VehicleBatch.js';
import VehicleBatchMembership from './src/models/VehicleBatchMembership.js';
import { addVehicleToBatch, bulkAddTrackerCars } from './src/controllers/vehicleBatchController.js';

dotenv.config();

async function runTests() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    let superAdmin, customer, vehicleType, batch;

    try {
        superAdmin = new User({
            firstName: 'Super',
            lastName: 'Admin',
            email: 'superadmin.40f.test@gsk.local',
            password: 'password123',
            role: 'super_admin'
        });
        await superAdmin.save();

        customer = new Customer({
            name: '40f Test Customer',
            email: '40f.test@gsk.local',
            phone: '123456789',
            address: '123 Test St',
            customerType: 'Rental'
        });
        await customer.save();
        
        vehicleType = new VehicleTemplate({
            customerId: customer._id,
            name: 'Toyota Corolla 2024',
            make: 'Toyota',
            model: 'Corolla',
            year: 2024,
            isActive: true
        });
        await vehicleType.save();

        batch = new VehicleBatch({
            type: 'RENTAL',
            customerId: customer._id,
            batchNumber: 'REN-9999',
            notes: 'Test batch for 40F',
            isActive: true
        });
        await batch.save();
        console.log("Setup complete. Batch ID:", batch._id);

        // Test 1: Single Add Car exactly as frontend sends it
        console.log("\n--- Testing Single Add Car ---");
        const reqSingle = {
            user: superAdmin,
            params: { id: batch._id.toString() },
            body: {
                registrationNumber: '', 
                make: 'Toyota', 
                model: 'Corolla', 
                year: '', 
                vin: '', 
                status: 'Pending', 
                notes: ''
            }
        };
        
        let resDataSingle = null;
        let resStatusSingle = 0;
        const resSingle = {
            status: function(s) { resStatusSingle = s; return this; },
            json: function(d) { resDataSingle = d; return this; }
        };

        try {
            await addVehicleToBatch(reqSingle, resSingle);
            console.log("Single Add Response Status:", resStatusSingle);
            console.log("Single Add Response Data:", resDataSingle);
        } catch (e) {
            console.log("Exception in addVehicleToBatch:", e);
        }

        // Test 2: Bulk Add exactly as frontend sends it
        console.log("\n--- Testing Bulk Add ---");
        const reqBulk = {
            user: superAdmin,
            params: { id: batch._id.toString() },
            body: {
                vehicleTypeId: vehicleType._id.toString(),
                quantity: "10"
            }
        };
        
        let resDataBulk = null;
        let resStatusBulk = 0;
        const resBulk = {
            status: function(s) { resStatusBulk = s; return this; },
            json: function(d) { resDataBulk = d; return this; }
        };

        try {
            await bulkAddTrackerCars(reqBulk, resBulk);
            console.log("Bulk Add Response Status:", resStatusBulk);
            console.log("Bulk Add Response Data:", resDataBulk);
        } catch (e) {
            console.log("Exception in bulkAddTrackerCars:", e);
        }

    } catch (e) {
        console.error('Test script error:', e);
    } finally {
        if (superAdmin) await User.findByIdAndDelete(superAdmin._id);
        if (customer) await Customer.findByIdAndDelete(customer._id);
        if (vehicleType) await VehicleTemplate.findByIdAndDelete(vehicleType._id);
        if (batch) await VehicleBatch.findByIdAndDelete(batch._id);
        if (batch) await VehicleBatchMembership.deleteMany({ batchId: batch._id });
        
        await mongoose.disconnect();
    }
}

runTests();
