import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = (await import('./backend/src/models/User.js')).default;
  const users = await User.find({ role: 'admin' });
  console.log(users.map(u => u.email));
  mongoose.disconnect();
};
run();
