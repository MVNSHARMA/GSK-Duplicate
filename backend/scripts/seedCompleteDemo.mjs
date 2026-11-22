import mongoose from 'mongoose';
import { seedCompleteDemoLogic } from '../src/utils/completeDemoSeeder.js';

const MONGODB_URI = process.argv[2] || process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("ERROR: Please pass the MongoDB URI as an argument, e.g.:");
    console.error("node backend/scripts/seedCompleteDemo.mjs 'mongodb+srv://...'");
    process.exit(1);
}

async function run() {
    try {
        console.log("Connecting to MongoDB Atlas...");
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000
        });
        console.log(`Connected to database: ${mongoose.connection.name}`);
        
        await seedCompleteDemoLogic();
        
        console.log("Finished! Database is populated with comprehensive client demo data.");
        process.exit(0);
    } catch (err) {
        console.error("Seeding failed:", err);
        process.exit(1);
    }
}

run();
