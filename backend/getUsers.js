import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log(users.map(u => ({email: u.email, role: u.role})));
  process.exit(0);
});
