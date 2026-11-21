import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import JobCard from './src/models/JobCard.js';
import { deleteJobCard } from './src/controllers/jobCardController.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    const admin = await User.findOne({ role: 'super_admin' });
    
    // Find a completed job card with parts
    const jc = await JobCard.findOne({ isActive: true, status: 'Completed', 'partsUsed.0': { $exists: true } });
    
    if (!jc) {
        console.log("No completed job cards with parts found.");
        process.exit(0);
    }
    
    console.log("Attempting to delete JobCard:", jc._id.toString());

    const req = {
        params: { id: jc._id.toString() },
        user: { _id: admin._id },
        ip: '127.0.0.1'
    };
    
    const res = {
        status: function(code) {
            this.code = code;
            return this;
        },
        json: function(data) {
            console.log(`Response ${this.code}:`, data);
        }
    };

    try {
        await deleteJobCard(req, res);
    } catch(e) {
        console.error("Test error:", e);
    }
    
    process.exit(0);
};

run();
