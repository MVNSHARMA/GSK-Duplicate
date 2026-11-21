import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const VehicleDocument = (await import('./backend/src/models/VehicleDocument.js')).default;
  const doc = await VehicleDocument.findOne({ publicId: 'gsk-automotive/vehicle-documents/xsuxkuy9ix7vdqdxbzru' });
  console.log('Doc Name:', doc?.documentName);
  console.log('Created At:', doc?.createdAt);
  mongoose.disconnect();
};
run();
