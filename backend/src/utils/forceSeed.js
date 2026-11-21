import mongoose from 'mongoose';
import dotenv from 'dotenv';
import runSeeder from './seeder.js';

dotenv.config({ path: '../../.env' }); // load from root if it exists, or just rely on process.env

const forceSeed = async () => {
    const uri = process.argv[2] || process.env.MONGODB_URI;
    
    if (!uri) {
        console.error("Please provide your MongoDB Atlas URI as an argument.");
        console.error("Usage: node forceSeed.js 'mongodb+srv://user:password@cluster...'");
        process.exit(1);
    }

    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(uri);
    console.log("Connected successfully!");

    console.log("Forcing database seeder to run...");
    process.env.SEED_ADMIN = 'true';
    await runSeeder();

    console.log("Seeding complete! You can now log in using the configured admin credentials.");
    process.exit(0);
};

forceSeed();
