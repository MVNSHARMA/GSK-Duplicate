import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import JobCard from './src/models/JobCard.js';
import VehicleBatchMembership from './src/models/VehicleBatchMembership.js';
import VehicleBatch from './src/models/VehicleBatch.js';

dotenv.config();

const run = async () => {
    try {
        await connectDB();
        
        const jc = await JobCard.findOne({ isActive: true });
        console.log("Found JC:", jc._id);
        
        jc.isActive = false;
        await jc.save();
        console.log("Saved successfully!");
        
        jc.isActive = true;
        await jc.save();
    } catch (e) {
        console.error("Validation Error:", e.message);
        if (e.errors) console.log(e.errors);
    } finally {
        process.exit(0);
    }
};

run();
