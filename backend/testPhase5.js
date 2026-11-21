import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import Customer from './src/models/Customer.js';
import Vehicle from './src/models/Vehicle.js';
import { resolveCustomerIdentity, resolveVehicleIdentity } from './src/utils/identityResolver.js';

async function runTests() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gsk_automotive');
        console.log("Connected to DB.");

        // Clear previous test data
        await Customer.deleteMany({ email: { $regex: /test/i } });
        await Vehicle.deleteMany({ registrationNumber: { $regex: /TEST/i } });

        console.log("\n--- TEST 12: Authenticated Workflow Test ---");
        const authUser = await Customer.create({ name: 'Auth Test User', email: 'auth@test.com', phone: '0000000', customerType: 'regular' });
        const resId1 = await resolveCustomerIdentity({ email: 'wrong@test.com' }, authUser._id.toString());
        console.log("Expected Auth User ID:", authUser._id.toString());
        console.log("Resolved Customer ID:", resId1.toString());
        console.log("Pass:", resId1.toString() === authUser._id.toString());

        console.log("\n--- TEST 13: Public Workflow Test ---");
        const publicUser = await Customer.create({ name: 'Public Test', email: 'public@test.com', phone: '1111111' });
        const resId2 = await resolveCustomerIdentity({ email: 'public@test.com' });
        console.log("Expected Public User ID:", publicUser._id.toString());
        console.log("Resolved Customer ID:", resId2.toString());
        console.log("Pass:", resId2.toString() === publicUser._id.toString());
        
        // Ensure it didn't create a duplicate
        const count = await Customer.countDocuments({ email: 'public@test.com' });
        console.log("Duplicate Count (Should be 1):", count, count === 1 ? 'Pass' : 'Fail');

        console.log("\n--- TEST 14: Ambiguous Match Test ---");
        await Customer.create({ name: 'Ambiguous 1', email: 'ambig@test.com', phone: '2222222' });
        await Customer.create({ name: 'Ambiguous 2', email: 'ambig@test.com', phone: '3333333' });
        const resId3 = await resolveCustomerIdentity({ email: 'ambig@test.com' });
        console.log("Resolved Customer ID (Should be null):", resId3, resId3 === null ? 'Pass' : 'Fail');

        console.log("\n--- TEST 15: Vehicle Identity Test ---");
        const veh = await Vehicle.create({ customerId: publicUser._id, brand: 'Toyota', model: 'Corolla', registrationNumber: 'TEST1234', vin: 'VINTEST1' });
        const resVeh1 = await resolveVehicleIdentity({ regNo: 'TEST1234' }, publicUser._id.toString());
        console.log("Resolved Vehicle (Same Customer):", resVeh1.toString() === veh._id.toString() ? 'Pass' : 'Fail');

        // Different Customer trying to claim same Rego
        const diffUser = await Customer.create({ name: 'Diff User', email: 'diff@test.com', phone: '9999999' });
        const resVeh2 = await resolveVehicleIdentity({ regNo: 'TEST1234' }, diffUser._id.toString());
        console.log("Resolved Vehicle (Different Customer - Should be null):", resVeh2 === null ? 'Pass' : 'Fail');

        console.log("\n--- TEST 11: Customer Type Transition Test ---");
        let transUser = await Customer.create({ name: 'Trans User', email: 'trans@test.com', phone: '4444444', customerType: 'regular' });
        console.log("Initial Type:", transUser.customerType);
        transUser.customerType = 'import_company';
        await transUser.save();
        const updated = await Customer.findById(transUser._id);
        console.log("Updated Type:", updated.customerType, updated.customerType === 'import_company' ? 'Pass' : 'Fail');
        console.log("ID Changed:", transUser._id.toString() !== updated._id.toString() ? 'Fail' : 'Pass (ID stable)');

        console.log("\n--- ALL TESTS COMPLETE ---");

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

runTests();
