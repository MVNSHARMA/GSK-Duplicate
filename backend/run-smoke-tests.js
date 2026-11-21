import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB for Smoke Tests.");
        
        const Customer = (await import('./src/models/Customer.js')).default;
        const Vehicle = (await import('./src/models/Vehicle.js')).default;
        const VehicleBatch = (await import('./src/models/VehicleBatch.js')).default;
        const VehicleBatchMembership = (await import('./src/models/VehicleBatchMembership.js')).default;
        const JobCard = (await import('./src/models/JobCard.js')).default;
        const Invoice = (await import('./src/models/Invoice.js')).default;
        const User = (await import('./src/models/User.js')).default;

        console.log("--- REGULAR WORKFLOW TEST ---");
        const regularCustomer = await Customer.findOne({ customerType: 'regular' });
        if (regularCustomer) {
            console.log("Found regular customer:", regularCustomer.name);
            const regularVehicle = await Vehicle.findOne({ customerId: regularCustomer._id });
            if (regularVehicle) {
                console.log("Found permanent vehicle:", regularVehicle.registrationNumber);
                const regularJobCard = await JobCard.findOne({ vehicleId: regularVehicle._id });
                if (regularJobCard) {
                    console.log("Found job card:", regularJobCard._id);
                    const regularInvoice = await Invoice.findOne({ jobCardId: regularJobCard._id });
                    if (regularInvoice) {
                        console.log("Found invoice for job card:", regularInvoice.invoiceNo);
                        console.log("Invoice status:", regularInvoice.status);
                    } else {
                        console.log("No invoice found for this job card.");
                    }
                } else {
                    console.log("No job card found for this vehicle.");
                }
            } else {
                console.log("No permanent vehicle found for this customer.");
            }
        } else {
            console.log("No regular customer found.");
        }

        console.log("\n--- RENTAL WORKFLOW TEST ---");
        const rentalBatch = await VehicleBatch.findOne({ type: 'RENTAL' });
        if (rentalBatch) {
            console.log("Found rental batch:", rentalBatch.batchNumber);
            const trackerCar = await VehicleBatchMembership.findOne({ batchId: rentalBatch._id });
            if (trackerCar) {
                console.log("Found tracker car in batch:", trackerCar.vin, "- Status:", trackerCar.status);
                
                // Verify no permanent vehicle exists for this VIN
                const matchingPermanentVehicle = await Vehicle.findOne({ vin: trackerCar.vin });
                if (matchingPermanentVehicle) {
                    console.log("ERROR: Found permanent vehicle with same VIN as tracker car!");
                } else {
                    console.log("SUCCESS: No permanent vehicle found for this tracker car VIN.");
                }

                const rentalJobCard = await JobCard.findOne({ trackerCarId: trackerCar._id });
                if (rentalJobCard) {
                    console.log("Found Job Card for tracker car:", rentalJobCard._id, "- Status:", rentalJobCard.status);
                    
                    if (rentalJobCard.vehicleId) {
                        console.log("ERROR: Rental Job Card has vehicleId populated artificially!");
                    } else {
                        console.log("SUCCESS: Rental Job Card strictly uses trackerCarId.");
                    }
                    
                    const rentalInvoice = await Invoice.findOne({ jobCardId: rentalJobCard._id });
                    if (rentalInvoice) {
                        console.log("Found Invoice for Rental Job Card:", rentalInvoice.invoiceNo);
                        if (rentalInvoice.vehicleId) {
                            console.log("ERROR: Rental Invoice has vehicleId populated artificially!");
                        } else {
                            console.log("SUCCESS: Rental Invoice strictly uses trackerCarId.");
                        }
                    } else {
                        console.log("No invoice found for this rental job card.");
                    }
                } else {
                    console.log("No job card found for this rental tracker car.");
                }
            } else {
                console.log("No tracker cars found in batch.");
            }
        } else {
            console.log("No rental batches found.");
        }

        console.log("\n--- IMPORT WORKFLOW TEST ---");
        const importBatch = await VehicleBatch.findOne({ type: 'IMPORT' });
        if (importBatch) {
            console.log("Found import batch:", importBatch.batchNumber);
            const importCar = await VehicleBatchMembership.findOne({ batchId: importBatch._id });
            if (importCar) {
                console.log("Found import tracker car:", importCar.vin, "- Status:", importCar.status);
                
                const importJobCard = await JobCard.findOne({ trackerCarId: importCar._id });
                if (importJobCard) {
                    console.log("Found Job Card for import car:", importJobCard._id);
                    if (importJobCard.vehicleId) {
                        console.log("ERROR: Import Job Card has vehicleId populated!");
                    } else {
                        console.log("SUCCESS: Import Job Card strictly uses trackerCarId.");
                    }
                } else {
                    console.log("No job card found for this import car.");
                }
            } else {
                console.log("No tracker cars found in import batch.");
            }
        } else {
            console.log("No import batches found.");
        }
        
        console.log("\n--- FINAL STATUS CHECK ---");
        console.log("Tests complete.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
