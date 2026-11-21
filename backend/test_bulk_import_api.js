import mongoose from 'mongoose';
import connectDB from './src/config/db.js';
import Customer from './src/models/Customer.js';
import VehicleBatch from './src/models/VehicleBatch.js';
import Vehicle from './src/models/Vehicle.js';
import VehicleBatchMembership from './src/models/VehicleBatchMembership.js';
import { bulkImportVehicles } from './src/controllers/vehicleBatchController.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    
    const company = await Customer.findOne({ customerType: 'rental_company' });
    
    // Create a Batch directly
    const batch = await VehicleBatch.create({
        batchNumber: 'BAT-9999',
        customerId: company._id,
        type: 'RENTAL',
        expectedVehicleCount: 100
    });
    
    // Generate 100 vehicles array
    const vehiclesToImport = [];
    for (let i=0; i<100; i++) {
        vehiclesToImport.push({
            regoNo: `REG${9000+i}`,
            vin: `VIN1234567890${9000+i}`,
            brand: 'Toyota',
            model: 'Corolla',
            year: 2024
        });
    }
    
    // Also inject some duplicates and conflicts
    // Duplicate in CSV
    vehiclesToImport.push({
        regoNo: `REG9000`, // Duplicate
        vin: `VIN12345678909000`,
        brand: 'Toyota',
        model: 'Corolla',
        year: 2024
    });
    
    // Conflict (Existing vehicle for another customer)
    const otherCustomer = await Customer.create({ name: 'Other', phone: '123' });
    const conflictVehicle = await Vehicle.create({
        customerId: otherCustomer._id,
        registrationNumber: 'REG-CONFLICT',
        brand: 'Honda',
        model: 'Civic',
        year: 2020
    });
    
    vehiclesToImport.push({
        regoNo: 'REG-CONFLICT',
        vin: '',
        brand: 'Honda',
        model: 'Civic',
        year: 2020
    });
    
    console.log("Testing Bulk Import API...");
    
    const req = {
        params: { id: batch._id.toString() },
        body: { vehicles: vehiclesToImport }
    };
    
    let resData;
    const res = {
        status: (code) => ({
            json: (data) => {
                resData = { code, data };
                console.log("Response:", code, data);
            }
        })
    };
    
    await bulkImportVehicles(req, res);
    
    console.log("Testing Idempotency (Running same upload again)...");
    
    let resData2;
    const res2 = {
        status: (code) => ({
            json: (data) => {
                resData2 = { code, data };
                console.log("Idempotent Response:", code, data);
            }
        })
    };
    
    await bulkImportVehicles(req, res2);

    process.exit(0);
};

run();
