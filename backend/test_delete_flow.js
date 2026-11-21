import connectDB from './src/config/db.js';
import JobCard from './src/models/JobCard.js';
import User from './src/models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    const admin = await User.findOne({ role: 'super_admin' });
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    const Customer = (await import('./src/models/Customer.js')).default;
    const customer = await Customer.findOne();
    
    const Vehicle = (await import('./src/models/Vehicle.js')).default;
    const vehicle = await Vehicle.findOne();
    
    const dummyJC = await JobCard.create({
        customerId: customer._id,
        vehicleId: vehicle._id,
        notes: 'TEST_DELETE_FLOW',
        isActive: true,
        status: 'Open'
    });
    
    console.log(`Created Dummy JC: ${dummyJC._id}`);
    
    const response = await fetch(`http://localhost:5005/api/job-cards/${dummyJC._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const body = await response.json();
    console.log(`DELETE API Status: ${response.status}`);
    console.log(`DELETE API Body:`, body);
    
    const verifyJC = await JobCard.findById(dummyJC._id);
    console.log(`Verified DB isActive: ${verifyJC.isActive}`);
    
    const getRes = await fetch(`http://localhost:5005/api/job-cards?page=1&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const getBody = await getRes.json();
    const found = getBody.data.find(j => j._id.toString() === dummyJC._id.toString());
    console.log(`Found in GET API: ${!!found}`);
    
    await JobCard.deleteOne({ _id: dummyJC._id });
    console.log('Dummy JC hard deleted to clean up test.');
    
    process.exit(0);
};

run();
