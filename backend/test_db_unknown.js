import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to DB");
    
    // Import models
    import('./src/models/Vehicle.js');
    const VehicleBatchMembership = (await import('./src/models/VehicleBatchMembership.js')).default;
    const Vehicle = (await import('./src/models/Vehicle.js')).default;

    const make = "";
    const model = "";

    let vehicleIds = [];
    if (make !== "" || model !== "") {
        const vQuery = {};
        vQuery.brand = make === "" ? { $in: [null, ""] } : make;
        vQuery.model = model === "" ? { $in: [null, ""] } : model;
        
        const vs = await Vehicle.find(vQuery).select('_id');
        vehicleIds = vs.map(v => v._id);
    }

    const typeOr = [];
    if (make === "" && model === "") {
        typeOr.push({
            make: { $in: [null, ""] },
            model: { $in: [null, ""] },
            vehicleId: { $in: [null, undefined] }
        });
    } else {
        const makeMatch = make === "" ? { $in: [null, ""] } : make;
        const modelMatch = model === "" ? { $in: [null, ""] } : model;
        typeOr.push({ make: makeMatch, model: modelMatch });
        
        if (vehicleIds.length > 0) {
            typeOr.push({
                make: { $in: [null, ""] },
                model: { $in: [null, ""] },
                vehicleId: { $in: vehicleIds }
            });
        }
    }

    const filter = { $and: [{ $or: typeOr }] };
    console.log("Filter:", JSON.stringify(filter, null, 2));

    const results = await VehicleBatchMembership.find(filter);
    console.log(`Found ${results.length} results for Unknown Type`);

    mongoose.disconnect();
  });
