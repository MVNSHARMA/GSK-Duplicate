import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { bulkAddTrackerCars } from './src/controllers/vehicleBatchController.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected");

        const req = {
            params: { id: "6aa657242a731218be8e21c9" }, // The ID the user is hitting
            body: {
                vehicleTypeId: "6aa657242a731218be8e21c9", // Fake it if we don't know
                quantity: 2
            }
        };
        const res = {
            status: function(s) {
                console.log("Status:", s);
                return this;
            },
            json: function(j) {
                console.log("JSON:", j);
                return this;
            }
        };

        // We need to fetch the batch to get the correct vehicleTypeId or we will fail validation
        const VehicleBatch = (await import('./src/models/VehicleBatch.js')).default;
        const batch = await VehicleBatch.findById("6aa657242a731218be8e21c9");
        if (!batch) {
            console.log("Batch not found!");
            process.exit(1);
        }

        const VehicleTemplate = (await import('./src/models/VehicleTemplate.js')).default;
        const templates = await VehicleTemplate.find({ customerId: batch.customerId });
        if (templates.length === 0) {
            console.log("No templates found for this customer.");
            process.exit(1);
        }
        
        req.body.vehicleTypeId = templates[0]._id;

        await bulkAddTrackerCars(req, res);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}
run();
