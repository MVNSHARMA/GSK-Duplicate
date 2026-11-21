import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Vehicle = (await import('./src/models/Vehicle.js')).default;
        const VehicleBatch = (await import('./src/models/VehicleBatch.js')).default;
        const VehicleBatchMembership = (await import('./src/models/VehicleBatchMembership.js')).default;
        
        const rentalBatch = await VehicleBatch.findOne({ type: 'RENTAL' });
        if (rentalBatch) {
            const trackerCar = await VehicleBatchMembership.findOne({ batchId: rentalBatch._id });
            if (trackerCar && trackerCar.vin) {
                const matchingPermanentVehicle = await Vehicle.findOne({ vin: trackerCar.vin });
                if (matchingPermanentVehicle) {
                    console.log("ERROR: Found permanent vehicle with same VIN as tracker car:", matchingPermanentVehicle.vin);
                } else {
                    console.log("SUCCESS: No permanent vehicle found for this tracker car VIN.");
                }
            } else if (trackerCar) {
                 console.log("Tracker car has no VIN to check against permanent vehicles.");
            }
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
