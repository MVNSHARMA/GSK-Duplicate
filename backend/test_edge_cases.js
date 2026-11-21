import mongoose from "mongoose";
import Customer from "./src/models/Customer.js";
import User from "./src/models/User.js";
import VehicleBatch from "./src/models/VehicleBatch.js";
import jwt from "jsonwebtoken";

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB for Edge Case Testing");

  let regC = await Customer.findOne({ customerType: 'regular' });
  let impC = await Customer.findOne({ customerType: 'import_company' });
  let renC = await Customer.findOne({ customerType: 'rental_company' });

  // 1. Create a dummy legacy batch assigned to Regular customer
  let legacyBatch = await VehicleBatch.create({
    customerId: regC._id,
    batchNumber: 'LEGACY-REG-001',
    status: 'EXPECTED',
    type: 'FLEET_SERVICE'
  });

  // 2. Create a batch assigned to Import customer
  let impBatch = await VehicleBatch.create({
    customerId: impC._id,
    batchNumber: 'IMP-001',
    status: 'EXPECTED',
    type: 'IMPORT'
  });

  const regU = await User.findOne({ email: 'reg@test.com' });
  const renU = await User.findOne({ email: 'ren@test.com' });

  const tokenReg = jwt.sign({ id: regU._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const tokenRen = jwt.sign({ id: renU._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const testEndpoint = async (token, endpoint) => {
    const res = await fetch(`http://localhost:5001${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { status: res.status, data: await res.json() };
  };

  console.log("\n--- REGULAR CUSTOMER (LEGACY BATCH EDGE CASE) ---");
  const regRes = await testEndpoint(tokenReg, `/api/customer-portal/batches/${legacyBatch._id}`);
  console.log(`[${regRes.status}] GET /batches/${legacyBatch._id} =>`, regRes.data.error || regRes.data);

  console.log("\n--- TENANT ISOLATION (RENTAL CUST -> IMPORT BATCH) ---");
  const tenantRes = await testEndpoint(tokenRen, `/api/customer-portal/batches/${impBatch._id}`);
  console.log(`[${tenantRes.status}] GET /batches/${impBatch._id} =>`, tenantRes.data.error || tenantRes.data);

  // Clean up
  await VehicleBatch.findByIdAndDelete(legacyBatch._id);
  await VehicleBatch.findByIdAndDelete(impBatch._id);

  await mongoose.disconnect();
}

verify().catch(console.error);
