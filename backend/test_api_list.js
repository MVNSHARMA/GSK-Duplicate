import User from './src/models/User.js';
import connectDB from './src/config/db.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    const admin = await User.findOne({ role: 'super_admin' });
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    const response = await fetch(`http://localhost:5005/api/job-cards?page=1&limit=15`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const body = await response.json();
    console.log("Status:", response.status);
    console.log("Success:", body.success);
    console.log("Data length:", body.data.length);
    console.log("Pagination:", body.pagination);
    process.exit(0);
};

run();
