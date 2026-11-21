import connectDB from './src/config/db.js';
import JobCard from './src/models/JobCard.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    const jobCards = await JobCard.find({ isActive: true });
    let failed = 0;
    
    for (const jc of jobCards) {
        jc.isActive = false;
        const err = jc.validateSync();
        if (err) {
            console.log(`JC ${jc._id} validation failed:`, err.message);
            failed++;
        }
    }
    
    console.log(`Checked ${jobCards.length} Job Cards. Failed: ${failed}`);
    process.exit(0);
};

run();
