import mongoose from "mongoose";
import User from "./src/models/User.js";
import Customer from "./src/models/Customer.js";
import jwt from "jsonwebtoken";

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const customers = await Customer.find({});
  let regC = customers.find(c => c.customerType === 'regular');
  let impC = customers.find(c => c.customerType === 'import_company');
  let renC = customers.find(c => c.customerType === 'rental_company');

  if(!regC || !impC || !renC) {
    console.log("Missing customers");
    process.exit(1);
  }

  // Create temporary users for these customers
  await User.deleteMany({ email: { $in: ['reg@test.com', 'imp@test.com', 'ren@test.com'] } });

  const regU = await User.create({ name: 'Reg', email: 'reg@test.com', password: 'password123', role: 'user', customerId: regC._id });
  const impU = await User.create({ name: 'Imp', email: 'imp@test.com', password: 'password123', role: 'user', customerId: impC._id });
  const renU = await User.create({ name: 'Ren', email: 'ren@test.com', password: 'password123', role: 'user', customerId: renC._id });

  const tokenReg = jwt.sign({ id: regU._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const tokenImp = jwt.sign({ id: impU._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const tokenRen = jwt.sign({ id: renU._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Test endpoints
  const testEndpoint = async (token, endpoint) => {
    const res = await fetch(`http://localhost:5001${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { status: res.status, data: await res.json() };
  };

  const endpoints = [
    "/api/customer-portal/batches",
    "/api/customer-portal/batches/123",
    "/api/customer-portal/batches/123/vehicles",
    "/api/customer-portal/batches/123/financial-summary",
    "/api/customer-portal/batches/123/invoices",
    "/api/customer-portal/batches/123/cars/123",
    "/api/customer-portal/batches/123/cars/123/documents"
  ];

  console.log("--- REGULAR CUSTOMER ---");
  for (const ep of endpoints) {
    const r = await testEndpoint(tokenReg, ep);
    console.log(`[${r.status}] ${ep} =>`, r.data.error || r.data);
  }

  console.log("\n--- IMPORT CUSTOMER ---");
  for (const ep of endpoints) {
    const r = await testEndpoint(tokenImp, ep);
    console.log(`[${r.status}] ${ep} =>`, r.data.error ? r.data.error : "Success or Not Found (Expected)");
  }

  console.log("\n--- RENTAL CUSTOMER ---");
  for (const ep of endpoints) {
    const r = await testEndpoint(tokenRen, ep);
    console.log(`[${r.status}] ${ep} =>`, r.data.error ? r.data.error : "Success or Not Found (Expected)");
  }

  await mongoose.disconnect();
}

verify().catch(console.error);
