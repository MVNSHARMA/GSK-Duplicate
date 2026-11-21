import mongoose from "mongoose";
import AuditLog from "./src/models/AuditLog.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const count = await AuditLog.countDocuments();
  console.log("Total audit logs:", count);
  const sample = await AuditLog.findOne().sort({ createdAt: -1 }).populate('actor targetUser').lean();
  console.log("Sample:", sample);
  mongoose.disconnect();
}
run();
