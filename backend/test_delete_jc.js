import mongoose from 'mongoose';
import dotenv from 'dotenv';
import JobCard from './src/models/JobCard.js';
import { deleteJobCard } from './src/controllers/jobCardController.js';

dotenv.config();
mongoose.connect(process.env.MONGO_URI);

const run = async () => {
    try {
        const jc = await JobCard.findOne({ isActive: true });
        if (!jc) {
            console.log("No active job card found.");
            process.exit(0);
        }
        console.log("Testing delete for JC ID:", jc._id.toString());
        
        const req = {
            params: { id: jc._id.toString() },
            user: { _id: new mongoose.Types.ObjectId() },
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
        
        await deleteJobCard(req, res);
    } catch (e) {
        console.error("Test Exception:", e);
    } finally {
        process.exit(0);
    }
};

run();
