import connectDB from './src/config/db.js';
import JobCard from './src/models/JobCard.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    const total = await JobCard.countDocuments();
    const active = await JobCard.countDocuments({ isActive: true });
    const inactive = await JobCard.countDocuments({ isActive: false });
    console.log(`Total: ${total}, Active: ${active}, Inactive: ${inactive}`);
    
    const statuses = await JobCard.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    console.log("Active Statuses:", statuses);
    process.exit(0);
};

run();
