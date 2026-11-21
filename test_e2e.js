import http from 'http';

const API_BASE = 'http://localhost:5001/api';
let token = '';
let customerId = '';
let vehicleId = '';
let inventoryId = '';
let jobCardId = '';
let invoiceId = '';

async function req(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${endpoint}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const request = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    request.on('error', reject);
    if (body) request.write(JSON.stringify(body));
    request.end();
  });
}

async function runTests() {
  console.log("--- Starting E2E API Tests ---");

  // 1. Login
  const loginRes = await req('POST', '/auth/login', { email: 'admin@gskautomobiles.com', password: process.env.DEMO_ADMIN_PASSWORD || 'your_secure_password' });
  if (loginRes.data.success) {
    token = loginRes.data.token;
    console.log("✅ Logged in successfully");
  } else {
    console.error("❌ Login failed", loginRes.data);
    return;
  }

  // 2. Settings
  const settingsRes = await req('PUT', '/settings', { businessName: 'E2E Test Business', gstRate: 15 });
  if (settingsRes.data.success) {
    console.log("✅ Updated settings successfully");
  } else {
    console.error("❌ Update settings failed", settingsRes.data);
  }

  // 3. Create Customer
  const custRes = await req('POST', '/customers', { name: 'E2E User', email: 'e2e@test.com', phone: '1234567890' });
  if (custRes.data.success) {
    customerId = custRes.data.data._id;
    console.log("✅ Created customer successfully");
  } else {
    console.error("❌ Create customer failed", custRes.data);
  }

  // 4. Create Vehicle
  const vehRes = await req('POST', '/vehicles', { 
    registrationNumber: 'E2ETEST', brand: 'Test Brand', model: 'Test Model', year: 2020, customerId 
  });
  if (vehRes.data.success) {
    vehicleId = vehRes.data.data._id;
    console.log("✅ Created vehicle successfully");
  } else {
    console.error("❌ Create vehicle failed", vehRes.data);
  }

  // 5. Create Inventory Item
  const invRes = await req('POST', '/inventory', {
    itemCode: 'TEST-PART-01', itemName: 'Test Brake Pad', category: 'Parts', quantity: 10, unitPrice: 50, sellingPrice: 100, minStockLevel: 5
  });
  if (invRes.data.success) {
    inventoryId = invRes.data.data._id;
    console.log("✅ Created inventory item (qty=10)");
  } else {
    console.error("❌ Create inventory failed", invRes.data);
  }

  // 6. Create Job Card
  const jcRes = await req('POST', '/job-cards', {
    vehicleId, customerId, status: 'Open', partsUsed: [
      { inventoryId, quantity: 2, price: 100 }
    ]
  });
  if (jcRes.data.success) {
    jobCardId = jcRes.data.data._id;
    console.log("✅ Created Job Card (Open status, 2 parts assigned)");
  } else {
    console.error("❌ Create Job Card failed", jcRes.data);
  }

  // 7. Check Inventory (should still be 10 since JC is Open)
  let checkInvRes = await req('GET', '/inventory');
  let part = checkInvRes.data.data.find(i => i._id === inventoryId);
  if (part.quantity === 10) {
    console.log("✅ Inventory remains 10 (Job Card is Open)");
  } else {
    console.error(`❌ Inventory is ${part.quantity}, expected 10`);
  }

  // 8. Update Job Card -> Completed
  const jcUpdateRes = await req('PUT', `/job-cards/${jobCardId}`, {
    status: 'Completed', partsUsed: [
      { inventoryId, quantity: 2, price: 100 }
    ]
  });
  if (jcUpdateRes.data.success) {
    console.log("✅ Job Card marked Completed");
  } else {
    console.error("❌ Job Card Update failed", jcUpdateRes.data);
  }

  // 9. Check Inventory Delta (should be 8)
  checkInvRes = await req('GET', '/inventory');
  part = checkInvRes.data.data.find(i => i._id === inventoryId);
  if (part.quantity === 8) {
    console.log("✅ Inventory successfully deducted to 8");
  } else {
    console.error(`❌ Inventory is ${part.quantity}, expected 8`);
  }

  // 10. Update Job Card again (increase parts to 3 and approve final amount) -> should sync delta (-1)
  const jcUpdateRes2 = await req('PUT', `/job-cards/${jobCardId}`, {
    status: 'Completed', approveFinalAmount: true, partsUsed: [
      { inventoryId, quantity: 3, price: 100 }
    ]
  });
  if (jcUpdateRes2.data.success) {
    console.log("✅ Job Card parts updated to 3");
  }

  // 11. Check Inventory Delta (should be 7)
  checkInvRes = await req('GET', '/inventory');
  part = checkInvRes.data.data.find(i => i._id === inventoryId);
  if (part.quantity === 7) {
    console.log("✅ Inventory Delta Sync successful (now 7)");
  } else {
    console.error(`❌ Inventory is ${part.quantity}, expected 7`);
  }

  // 12. Create linked Invoice (Should NOT deduct inventory since JC handled it)
  const invoiceRes = await req('POST', '/invoices', {
    jobCardId, customerId, vehicleId, type: 'Service Invoice',
    partsAndLabour: [{ inventoryId, qty: 3, price: 100 }]
  });
  if (invoiceRes.data.success) {
    invoiceId = invoiceRes.data.data._id;
    console.log("✅ Created Linked Invoice");
  } else {
    console.error("❌ Invoice creation failed", invoiceRes.data);
  }

  checkInvRes = await req('GET', '/inventory');
  part = checkInvRes.data.data.find(i => i._id === inventoryId);
  if (part.quantity === 7) {
    console.log("✅ Linked Invoice correctly did NOT deduct extra inventory");
  } else {
    console.error(`❌ Linked Invoice deducted inventory unexpectedly (qty: ${part.quantity})`);
  }

  // 13. Create Standalone Invoice (Should deduct inventory)
  const stdInvoiceRes = await req('POST', '/invoices', {
    customerId, vehicleId, type: 'General Invoice',
    partsAndLabour: [{ inventoryId, qty: 2, price: 100 }]
  });
  if (!stdInvoiceRes.data.success) {
    console.error("❌ Standalone Invoice creation failed", stdInvoiceRes.data);
    return;
  }
  const stdInvoiceId = stdInvoiceRes.data.data._id;
  
  checkInvRes = await req('GET', '/inventory');
  part = checkInvRes.data.data.find(i => i._id === inventoryId);
  if (part.quantity === 5) {
    console.log("✅ Standalone Invoice correctly deducted 2 inventory (now 5)");
  } else {
    console.error(`❌ Standalone Invoice inventory sync failed (qty: ${part.quantity})`);
  }

  // 14. Delete Job Card -> Should refund 3 parts
  const delJcRes = await req('DELETE', `/job-cards/${jobCardId}`);
  if (delJcRes.data.success) {
    console.log("✅ Deleted Job Card");
  }

  checkInvRes = await req('GET', '/inventory');
  part = checkInvRes.data.data.find(i => i._id === inventoryId);
  if (part.quantity === 8) {
    console.log("✅ Job Card Delete correctly refunded 3 parts (now 8)");
  } else {
    console.error(`❌ Job Card Delete refund failed (qty: ${part.quantity})`);
  }

  // 15. Delete Standalone Invoice -> Should refund 2 parts
  const delInvRes = await req('DELETE', `/invoices/${stdInvoiceId}`);
  if (delInvRes.data.success) {
    console.log("✅ Deleted Standalone Invoice");
  }

  checkInvRes = await req('GET', '/inventory');
  part = checkInvRes.data.data.find(i => i._id === inventoryId);
  if (part.quantity === 10) {
    console.log("✅ Standalone Invoice Delete correctly refunded 2 parts (now 10, back to original!)");
  } else {
    console.error(`❌ Standalone Invoice Delete refund failed (qty: ${part.quantity})`);
  }
}

runTests().catch(console.error);
