import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import JobCard from './src/models/JobCard.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    const admin = await User.findOne({ role: 'super_admin' });
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    const jc = await JobCard.findOne({ isActive: true });
    console.log("Attempting to delete JobCard:", jc._id.toString());

    const response = await fetch(`http://localhost:5005/api/job-cards/${jc._id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    console.log("Status:", response.status);
    const body = await response.text();
    console.log("Body:", body);
    process.exit(0);
};

run();
