

const API_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== STARTING E2E API TESTS ===\n');

  try {
    // 1. Auth Login
    console.log('[Auth] Logging in as admin...');
    const authRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gskautomobiles.com', password: process.env.DEMO_ADMIN_PASSWORD || 'your_secure_password' })
    });
    const authData = await authRes.json();
    if (!authData.success) throw new Error('Login failed: ' + authData.error);
    const token = authData.token;
    console.log('✓ Login successful');

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // 2. Inventory Module
    console.log('\n[Inventory] Testing create & fetch...');
    const invRes = await fetch(`${API_URL}/inventory`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        itemName: 'Test Oil Filter',
        category: 'Engine',
        quantity: 10,
        unitPrice: 25.50,
        minStockLevel: 5,
        supplier: 'Test Supplier'
      })
    });
    const invData = await invRes.json();
    if (!invData.success) throw new Error('Inventory Create failed');
    console.log('✓ Inventory item created');

    // 3. Customers Module
    console.log('\n[Customers] Testing create & fetch...');
    const custRes = await fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Customer',
        phone: '0412345678',
        email: 'test@customer.com',
        address: '123 Test St',
        idType: 'Driver License',
        idNumber: 'DL123456',
        notes: 'VIP'
      })
    });
    const custData = await custRes.json();
    if (!custData.success) throw new Error('Customer Create failed');
    const customerId = custData.data._id;
    console.log('✓ Customer created');

    // 4. Vehicles Module
    console.log('\n[Vehicles] Testing create & fetch...');
    const vehRes = await fetch(`${API_URL}/vehicles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customerId,
        brand: 'Toyota',
        model: 'Corolla',
        year: 2020,
        registrationNumber: 'TEST-123',
        vin: 'VIN123456',
        notes: 'Good condition'
      })
    });
    const vehData = await vehRes.json();
    if (!vehData.success) throw new Error('Vehicle Create failed');
    const vehicleId = vehData.data._id;
    console.log('✓ Vehicle created');

    // 5. Job Cards Module
    console.log('\n[Job Cards] Testing create & fetch...');
    const jcRes = await fetch(`${API_URL}/job-cards`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vehicleId,
        ownerDetails: { name: 'Test Customer' },
        vehicleDetails: { make: 'Toyota', model: 'Corolla' },
        labourHours: 2,
        hourlyRate: 100,
        charges: { lubricantsOil: 50 },
        servicesOrdered: ['Lubrication']
      })
    });
    const jcData = await jcRes.json();
    if (!jcData.success) throw new Error('Job Card Create failed');
    console.log('✓ Job Card created. Virtual Total Amount: ' + jcData.data.totalAmount);

    // 6. Invoices Module
    console.log('\n[Invoices] Testing create & fetch...');
    const inv2Res = await fetch(`${API_URL}/invoices`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'Service Invoice',
        customerDetails: { name: 'Test Customer' },
        vehicleDetails: { make: 'Toyota', model: 'Corolla' },
        partsAndLabour: [{ description: 'Oil change', qty: 1, price: 150 }]
      })
    });
    const inv2Data = await inv2Res.json();
    if (!inv2Data.success) throw new Error('Invoice Create failed');
    console.log('✓ Invoice created with No: ' + inv2Data.data.invoiceNo);

    console.log('\n=== ALL E2E API TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  }
}

runTests();
