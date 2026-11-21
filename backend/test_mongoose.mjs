import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Inventory from './src/models/Inventory.js';
import User from './src/models/User.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find a super admin
  const user = await User.findOne({ role: 'super_admin' });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // 1. Get an inventory item
  const inventoryItem = await Inventory.findOne({});
  const id = inventoryItem._id.toString();
  console.log('Fetching ID:', id);

  // 2. Fetch the new API
  const res = await fetch(`http://localhost:5005/api/inventory/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data:', JSON.stringify(data, null, 2));

  mongoose.disconnect();
}

run().catch(console.error);
