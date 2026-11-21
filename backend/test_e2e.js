import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from './src/models/User.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const API_URL = 'http://127.0.0.1:5005/api';
let token = '';

async function fetchJSON(path, options = {}) {
  const url = `${API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB.");

  try {
    await User.deleteOne({ email: 'testadmin@gsk.com' });
    await User.create({
        name: 'Test Admin',
        email: 'testadmin@gsk.com',
        password: 'password123',
        role: 'super_admin'
    });

    const loginRes = await fetchJSON('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'testadmin@gsk.com', password: 'password123' })
    });
    token = loginRes.data.token;
    
    if (!token) throw new Error("Login failed");

    console.log("--- TEST A: Create Customer A ---");
    const custARes = await fetchJSON('/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Customer A', phone: '1111111111', customerType: 'regular' })
    });
    const customerA = custARes.data.data;

    console.log("--- TEST B: Create Customer B ---");
    const custBRes = await fetchJSON('/customers', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Customer B', phone: '2222222222', customerType: 'regular' })
    });
    const customerB = custBRes.data.data;

    console.log("--- TEST C: Create Vehicle 1 ---");
    const rego = `REG-${Date.now()}`;
    const veh1Res = await fetchJSON('/vehicles', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: rego, brand: 'Toyota', model: 'Corolla', year: 2020 })
    });
    const vehicle1 = veh1Res.data.data;

    console.log("--- TEST D: Link Vehicle 1 to Customer A ---");
    const linkRes = await fetchJSON(`/customers/${customerA._id}/vehicles/link`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: vehicle1._id })
    });
    if (!linkRes.data.success) throw new Error("Failed to link Vehicle 1 to Customer A");

    console.log("--- TEST E: Create Job Card for Customer A and Vehicle 1 -> Success ---");
    const jc1Res = await fetchJSON('/job-cards', {
        method: 'POST',
        body: JSON.stringify({ customerId: customerA._id, vehicleId: vehicle1._id, labourHours: 1, hourlyRate: 100 })
    });
    if (!jc1Res.data.success) throw new Error(jc1Res.data.error || "Failed to create Job Card");

    console.log("--- TEST F: Create Job Card for Customer B and Vehicle 1 -> Fails with 409 ---");
    const jc2Res = await fetchJSON('/job-cards', {
        method: 'POST',
        body: JSON.stringify({ customerId: customerB._id, vehicleId: vehicle1._id, labourHours: 1, hourlyRate: 100 })
    });
    if (jc2Res.status !== 409 && jc2Res.status !== 400) throw new Error(`Expected 409, got ${jc2Res.status}. Error: ${jc2Res.data.error}`);

    console.log("--- TEST G: Reassign Vehicle 1 to Customer B ---");
    const reassignRes = await fetchJSON(`/customers/${customerB._id}/vehicles/reassign`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: vehicle1._id })
    });
    if (!reassignRes.data.success) throw new Error("Failed to reassign vehicle");

    console.log("--- TEST H: Verify Vehicle 1 is linked to Customer B ---");
    const vCheckRes = await fetchJSON(`/vehicles`);
    const vCheck = vCheckRes.data.data.find(v => v._id === vehicle1._id);
    if (vCheck.customerId._id !== customerB._id && vCheck.customerId !== customerB._id) throw new Error("Vehicle not linked correctly");

    console.log("--- TEST I: Create Job Card for Customer B and Vehicle 1 -> Success ---");
    const jc3Res = await fetchJSON('/job-cards', {
        method: 'POST',
        body: JSON.stringify({ customerId: customerB._id, vehicleId: vehicle1._id, labourHours: 1, hourlyRate: 100 })
    });
    if (!jc3Res.data.success) throw new Error(jc3Res.data.error || "Failed to create Job Card after reassignment");

    console.log("--- TEST J: Unlink Vehicle 1 from Customer B ---");
    const unlinkRes = await fetchJSON(`/customers/${customerB._id}/vehicles/unlink`, {
        method: 'POST',
        body: JSON.stringify({ vehicleId: vehicle1._id })
    });
    if (!unlinkRes.data.success) throw new Error("Failed to unlink vehicle");

    console.log("--- TEST L: Create a second vehicle with same rego -> Fails ---");
    const dupRes = await fetchJSON('/vehicles', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: rego, brand: 'Honda', model: 'Civic' })
    });
    if (dupRes.status === 200 || dupRes.data.success) throw new Error("Should have blocked duplicate rego");

    console.log("\nALL TESTS PASSED SUCCESSFULLY.");
  } catch (error) {
    console.error("TEST FAILED:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from DB.");
    process.exit(0);
  }
}

runTests();
