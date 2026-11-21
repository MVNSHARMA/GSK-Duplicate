import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getUnifiedHistory } from './src/services/historyService.js';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find a job card with multiple invoices or a booking and invoice
  const JobCard = (await import('./src/models/JobCard.js')).default;
  const jc = await JobCard.findOne({});
  if (!jc) {
    console.log("No job cards found");
    process.exit(0);
  }
  
  const history = await getUnifiedHistory({ query: { vehicleId: jc.vehicleId } });
  
  console.log(JSON.stringify(history.events, null, 2));
  process.exit(0);
}

run().catch(console.error);
