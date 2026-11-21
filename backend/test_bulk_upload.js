import mongoose from 'mongoose';
import Customer from './src/models/Customer.js';
import User from './src/models/User.js';
import connectDB from './src/config/db.js';

import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    console.log("Connected to DB");
    
    // Create a mock customer (Company)
    const company = await Customer.create({
        name: 'Enterprise Rentals ' + Date.now(),
        phone: '123456789',
        customerType: 'rental_company',
        email: 'info@enterpriserentals.test'
    });
    console.log("Created Customer:", company._id);
    
    // Create a user for this company
    const user = await User.create({
        name: 'Enterprise Manager',
        email: 'manager' + Date.now() + '@enterpriserentals.test',
        password: 'password123',
        role: 'user',
        customerId: company._id
    });
    console.log("Created User:", user.email);

    process.exit(0);
};

run();
