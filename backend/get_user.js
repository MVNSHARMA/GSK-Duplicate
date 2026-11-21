import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gsk_automotive');
    const Employee = (await import('./src/models/Employee.js')).default;
    const admin = await Employee.findOne({ role: 'superadmin' });
    console.log("Admin ID:", admin._id);
    process.exit(0);
}
test();
