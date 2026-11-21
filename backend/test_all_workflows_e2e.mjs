import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import User from './src/models/User.js';
import Customer from './src/models/Customer.js';
import Vehicle from './src/models/Vehicle.js';
import JobCard from './src/models/JobCard.js';
import Inventory from './src/models/Inventory.js';
import Invoice from './src/models/Invoice.js';
import Booking from './src/models/Booking.js';
import Quote from './src/models/Quote.js';
import Contact from './src/models/Contact.js';
import Supplier from './src/models/Supplier.js';
import fs from 'node:fs/promises';

const API_URL = 'http://localhost:5005/api';
let authToken = '';
let testAdminUser = null;

// Helper to make API calls
async function api(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...options.headers
  };
  const res = await fetch(url, { ...options, headers });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('application/pdf')) {
    data = await res.arrayBuffer();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

test.before(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gsk_test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  // Ensure test super_admin user exists with a known password
  await User.deleteOne({ email: 'e2e_master_admin@gsk.com' });
  testAdminUser = await User.create({
    name: 'E2E Master Admin',
    email: 'e2e_master_admin@gsk.com',
    password: 'password123',
    role: 'super_admin',
    status: 'active'
  });
});

test.after(async () => {
  // Cleanup test artifacts from database
  await User.deleteMany({ email: /e2e_/ });
  await Customer.deleteMany({ email: /e2e_/ });
  await Vehicle.deleteMany({ registrationNumber: /E2E-/ });
  await Booking.deleteMany({ 'customerInfo.email': /e2e_/ });
  await Quote.deleteMany({ 'customerInfo.email': /e2e_/ });
  await Contact.deleteMany({ email: /e2e_/ });
  await Supplier.deleteMany({ name: /E2E Supplier/ });
  await Inventory.deleteMany({ itemName: /E2E Item/ });
  await mongoose.disconnect();
});

// =========================================================================
// WORKFLOW 1: Authentication & Authorization Flow
// =========================================================================
test('Workflow 1: Authentication & Authorization', async (t) => {
  await t.test('1.1 Login with invalid credentials returns 401', async () => {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'e2e_master_admin@gsk.com', password: 'wrong_password' })
    });
    assert.equal(res.status, 401);
    assert.equal(res.data.success, false);
  });

  await t.test('1.2 Protected route without token returns 401', async () => {
    const res = await api('/customers', { method: 'GET' });
    assert.equal(res.status, 401);
  });

  await t.test('1.3 Successful login returns JWT token and user profile', async () => {
    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'e2e_master_admin@gsk.com', password: 'password123' })
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.token, 'Should return a JWT token');
    assert.equal(res.data.user.email, 'e2e_master_admin@gsk.com');
    authToken = res.data.token;
  });

  await t.test('1.4 Authenticated /auth/me returns current user profile', async () => {
    const res = await api('/auth/me', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, 'e2e_master_admin@gsk.com');
    assert.equal(res.data.user.role, 'super_admin');
  });
});

// =========================================================================
// WORKFLOW 2: Public Booking, Slots, Quote, and Contact Intake Flow
// =========================================================================
test('Workflow 2: Public Intake & Booking Confirmation Email', async (t) => {
  await t.test('2.1 Query available slots returns valid schedule', async () => {
    const res = await api('/slots?date=2030-11-20', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.data), 'Slots data should be an array');
  });

  let createdBookingRef = '';
  await t.test('2.2 Submit valid booking request: generates reference and sends confirmation email', async () => {
    const res = await api('/intake/book', {
      method: 'POST',
      body: JSON.stringify({
        customerInfo: {
          firstName: 'E2E',
          lastName: 'Customer',
          phone: '0411223344',
          email: 'e2e_booking_customer@example.com',
          contactMethod: 'email'
        },
        vehicleInfo: {
          make: 'Toyota',
          model: 'Hilux',
          year: 2023,
          regNo: 'E2E-HLX',
          transmission: 'Automatic'
        },
        services: ['Logbook Service', 'Brake Inspection'],
        appointment: {
          date: 'Wednesday, 20 November 2030',
          time: '10:00 AM'
        },
        additionalInfo: 'Please check rear brake pads.'
      })
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.success);
    assert.ok(res.data.bookingReference, 'Response must return bookingReference');
    assert.match(res.data.bookingReference, /^GSK-BK-\d{8}-[A-F0-9]{6}$/);
    createdBookingRef = res.data.bookingReference;

    // Verify database record
    const savedBooking = await Booking.findOne({ bookingReference: createdBookingRef });
    assert.ok(savedBooking, 'Booking record must exist in DB');
    assert.equal(savedBooking.status, 'Pending');
    assert.equal(savedBooking.confirmationEmail.status, 'accepted');
    assert.ok(savedBooking.confirmationEmail.messageId, 'Brevo messageId must be saved');
  });

  await t.test('2.3 Past/expired appointment time is rejected with 400', async () => {
    const res = await api('/intake/book', {
      method: 'POST',
      body: JSON.stringify({
        customerInfo: {
          firstName: 'Expired',
          lastName: 'Test',
          phone: '0411223344',
          email: 'e2e_expired@example.com'
        },
        vehicleInfo: {
          make: 'Holden',
          model: 'Commodore',
          year: 2012,
          regNo: 'E2E-EXP'
        },
        services: ['General Inspection'],
        appointment: {
          date: 'Monday, 1 January 2024',
          time: '9:00 AM'
        }
      })
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
  });

  await t.test('2.4 Public quote request submission succeeds', async () => {
    const res = await api('/intake/quote', {
      method: 'POST',
      body: JSON.stringify({
        customerInfo: {
          fullName: 'Quote Requester',
          phone: '0499887766',
          email: 'e2e_quote@example.com'
        },
        vehicleInfo: {
          make: 'Ford',
          model: 'Ranger',
          year: '2021',
          regNo: 'E2E-QTE'
        },
        services: ['Clutch Replacement'],
        description: 'Need quote for dual-mass flywheel and heavy duty clutch.'
      })
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.success);
  });

  await t.test('2.5 Public contact message submission succeeds', async () => {
    const res = await api('/intake/contact', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Contact',
        lastName: 'Inquirer',
        phone: '0488776655',
        email: 'e2e_contact@example.com',
        subject: 'Opening Hours',
        message: 'Are you open on public holidays?'
      })
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.success);
  });
});

// =========================================================================
// WORKFLOW 3: Customer & Vehicle Management Lifecycle
// =========================================================================
test('Workflow 3: Customer & Vehicle Relationship Lifecycle', async (t) => {
  let customerAId = '';
  let customerBId = '';
  let vehicle1Id = '';
  const rego1 = `E2E-${Date.now()}`;

  await t.test('3.1 Create Customer A and Customer B', async () => {
    const resA = await api('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Customer Alpha',
        phone: '0411111111',
        email: 'e2e_customer_alpha@example.com',
        customerType: 'regular',
        address: '10 Alpha Way, Sydney'
      })
    });
    assert.equal(resA.status, 201);
    customerAId = resA.data.data._id;
    assert.ok(customerAId);

    const resB = await api('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Customer Beta',
        phone: '0422222222',
        email: 'e2e_customer_beta@example.com',
        customerType: 'regular',
        address: '20 Beta Ave, Sydney'
      })
    });
    assert.equal(resB.status, 201);
    customerBId = resB.data.data._id;
    assert.ok(customerBId);
  });

  await t.test('3.2 Create Vehicle 1 and prevent duplicate registration', async () => {
    const resV = await api('/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        registrationNumber: rego1,
        brand: 'Subaru',
        model: 'WRX',
        year: 2021
      })
    });
    assert.equal(resV.status, 201);
    vehicle1Id = resV.data.data._id;
    assert.ok(vehicle1Id);

    // Duplicate rego should fail
    const dupRes = await api('/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        registrationNumber: rego1,
        brand: 'Subaru',
        model: 'WRX'
      })
    });
    assert.equal(dupRes.status, 400);
  });

  await t.test('3.3 Link Vehicle 1 to Customer A', async () => {
    const linkRes = await api(`/customers/${customerAId}/vehicles/link`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId: vehicle1Id })
    });
    assert.equal(linkRes.status, 200);
    assert.ok(linkRes.data.success);

    // Verify vehicle's customerId
    const v = await Vehicle.findById(vehicle1Id);
    assert.equal(v.customerId.toString(), customerAId);
  });

  await t.test('3.4 Reassign Vehicle 1 to Customer B and then Unlink', async () => {
    const reassignRes = await api(`/customers/${customerBId}/vehicles/reassign`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId: vehicle1Id })
    });
    assert.equal(reassignRes.status, 200);

    const vAfterReassign = await Vehicle.findById(vehicle1Id);
    assert.equal(vAfterReassign.customerId.toString(), customerBId);

    const unlinkRes = await api(`/customers/${customerBId}/vehicles/unlink`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId: vehicle1Id })
    });
    assert.equal(unlinkRes.status, 200);

    const vAfterUnlink = await Vehicle.findById(vehicle1Id);
    assert.equal(vAfterUnlink.customerId, null);

    // Re-link to Customer A for subsequent Job Card test
    await api(`/customers/${customerAId}/vehicles/link`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId: vehicle1Id })
    });
  });
});

// =========================================================================
// WORKFLOW 4: Job Cards & Workshop Operations
// =========================================================================
test('Workflow 4: Job Card Lifecycle (Open -> In Progress -> Completed)', async (t) => {
  let customer = await Customer.findOne({ email: 'e2e_customer_alpha@example.com' });
  let vehicle = await Vehicle.findOne({ customerId: customer._id });
  let jobCardId = '';

  await t.test('4.1 Create new Job Card for Customer and Vehicle', async () => {
    const res = await api('/job-cards', {
      method: 'POST',
      body: JSON.stringify({
        customerId: customer._id,
        vehicleId: vehicle._id,
        status: 'Open',
        labourHours: 2,
        hourlyRate: 110,
        notes: 'Initial inspection and brake flush'
      })
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.success);
    jobCardId = res.data.data._id;
    assert.ok(jobCardId);
  });

  await t.test('4.2 Fetch Job Card by ID and list Job Cards', async () => {
    const getRes = await api(`/job-cards/${jobCardId}`, { method: 'GET' });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.data.status, 'Open');

    const listRes = await api('/job-cards', { method: 'GET' });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.data.length > 0);
  });

  await t.test('4.3 Advance Job Card status to In Progress and then Completed', async () => {
    const updateProgress = await api(`/job-cards/${jobCardId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert.equal(updateProgress.status, 200);
    assert.equal(updateProgress.data.data.status, 'In Progress');

    const updateCompleted = await api(`/job-cards/${jobCardId}`, {
      method: 'PUT',
      body: JSON.stringify({ 
        status: 'Completed',
        labourHours: 2.5,
        hourlyRate: 110,
        servicesProvided: [
          { name: 'Major Service Labour', quantity: 1, cost: 275 },
          { name: 'Brake Fluid Flush', quantity: 1, cost: 65 }
        ]
      })
    });
    assert.equal(updateCompleted.status, 200);
    assert.equal(updateCompleted.data.data.status, 'Completed');
  });
});

// =========================================================================
// WORKFLOW 5: Inventory & Parts Stock Flow
// =========================================================================
test('Workflow 5: Inventory & Parts Management', async (t) => {
  let itemId = '';

  await t.test('5.1 Create new inventory item', async () => {
    const res = await api('/inventory', {
      method: 'POST',
      body: JSON.stringify({
        itemName: 'E2E Item Synthetic Engine Oil 5W-30',
        category: 'Lubricants',
        supplier: 'E2E Oil Co'
      })
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.success);
    itemId = res.data.data._id;
    assert.ok(itemId);
  });

  await t.test('5.2 Fetch inventory item and inventory list', async () => {
    const resItem = await api(`/inventory/${itemId}`, { method: 'GET' });
    assert.equal(resItem.status, 200);
    assert.equal(resItem.data.data.itemName, 'E2E Item Synthetic Engine Oil 5W-30');

    const resList = await api('/inventory', { method: 'GET' });
    assert.equal(resList.status, 200);
    assert.ok(Array.isArray(resList.data.data));
  });

  await t.test('5.3 Update inventory item details', async () => {
    const res = await api(`/inventory/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({
        itemName: 'E2E Item Synthetic Engine Oil 5W-30 (Updated)'
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.data.itemName, 'E2E Item Synthetic Engine Oil 5W-30 (Updated)');
  });
});

// =========================================================================
// WORKFLOW 6: Invoicing & PDF Generation Flow
// =========================================================================
test('Workflow 6: Invoicing & PDF Generation', async (t) => {
  const customer = await Customer.findOne({ email: 'e2e_customer_alpha@example.com' });
  const vehicle = await Vehicle.findOne({ customerId: customer._id });
  const jobCard = await JobCard.findOne({ customerId: customer._id, status: 'Completed' });
  let invoiceId = '';

  await t.test('6.1 Generate invoice from completed Job Card', async () => {
    const res = await api('/invoices', {
      method: 'POST',
      body: JSON.stringify({
        type: 'Service Invoice',
        jobCardId: jobCard._id,
        customerId: customer._id,
        vehicleId: vehicle._id
      })
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.success);
    invoiceId = res.data.data._id;
    assert.ok(invoiceId);
    assert.ok(res.data.data.invoiceNo, 'Invoice number must be generated');
    assert.ok(res.data.data.totalAmount > 0, 'Total amount must be calculated');
  });

  await t.test('6.2 Fetch invoice details and update payment status to Paid', async () => {
    const getRes = await api(`/invoices/${invoiceId}`, { method: 'GET' });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.data.status, 'Unpaid');

    const updateRes = await api(`/invoices/${invoiceId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'Paid',
        paymentMethod: 'Credit Card',
        amountPaid: getRes.data.data.totalAmount
      })
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.data.status, 'Paid');
  });

  await t.test('6.3 Download Invoice PDF and verify PDF stream binary format', async () => {
    const pdfRes = await api(`/invoices/${invoiceId}/pdf`, { method: 'GET' });
    assert.equal(pdfRes.status, 200);
    assert.ok(pdfRes.headers.get('content-type').includes('application/pdf'));

    const buffer = Buffer.from(pdfRes.data);
    const headerString = buffer.slice(0, 5).toString('ascii');
    assert.equal(headerString, '%PDF-', 'Downloaded file must begin with %PDF- header');
  });
});

// =========================================================================
// WORKFLOW 7: Suppliers Management Flow
// =========================================================================
test('Workflow 7: Suppliers Management', async (t) => {
  let supplierId = '';

  await t.test('7.1 Create new Supplier', async () => {
    const res = await api('/suppliers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'E2E Supplier Auto Parts',
        contactPerson: 'David Supplier',
        email: 'e2e_supplier@example.com',
        phone: '0299887766',
        address: '50 Parts Blvd, Sydney'
      })
    });
    assert.equal(res.status, 201);
    supplierId = res.data._id;
    assert.ok(supplierId);
  });

  await t.test('7.2 Fetch supplier list and supplier details', async () => {
    const listRes = await api('/suppliers', { method: 'GET' });
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data));

    const getRes = await api(`/suppliers/${supplierId}`, { method: 'GET' });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.name, 'E2E Supplier Auto Parts');
  });

  await t.test('7.3 Update supplier details', async () => {
    const res = await api(`/suppliers/${supplierId}`, {
      method: 'PUT',
      body: JSON.stringify({ phone: '0299889988' })
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.phone, '0299889988');
  });
});

// =========================================================================
// WORKFLOW 8: Settings & Live Employee Defaults Synchronization
// =========================================================================
test('Workflow 8: Settings & Live Employee Permissions Sync', async (t) => {
  await t.test('8.1 Fetch business settings', async () => {
    const res = await api('/settings', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.ok(res.data.data.businessName);
  });

  await t.test('8.2 Update business settings and verify persistence', async () => {
    const res = await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        businessName: 'GSK Automotive',
        businessPhone: '+61 2 8856 5650',
        businessEmail: 'info@gskautomotive.com.au'
      })
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.data.businessName, 'GSK Automotive');
  });
});

// =========================================================================
// WORKFLOW 9: Communications & Notifications Flow
// =========================================================================
test('Workflow 9: Communications & Notifications Flow', async (t) => {
  await t.test('9.1 Communications summary responds with metrics', async () => {
    const res = await api('/communications/summary', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.ok(res.data.data);
  });

  await t.test('9.2 Fetch quotes and messages lists', async () => {
    const quotesRes = await api('/communications/quotes', { method: 'GET' });
    assert.equal(quotesRes.status, 200);

    const messagesRes = await api('/communications/messages', { method: 'GET' });
    assert.equal(messagesRes.status, 200);
  });

  await t.test('9.3 Fetch notifications list', async () => {
    const notifsRes = await api('/communications/notifications', { method: 'GET' });
    assert.equal(notifsRes.status, 200);
    assert.ok(Array.isArray(notifsRes.data.data));
  });
});

// =========================================================================
// WORKFLOW 10: Unauthenticated Public Intake (No Auth Token Required)
// =========================================================================
test('Workflow 10: Unauthenticated Guest Intake (Booking, Quote, Contact)', async (t) => {
  await t.test('10.1 Frontend pages (BookService, RequestQuote, Contact) do not require login or useProtectedAction', async () => {
    const bookSrc = await fs.readFile('frontend/src/pages/BookService.jsx', 'utf8');
    const quoteSrc = await fs.readFile('frontend/src/pages/RequestQuote.jsx', 'utf8');
    const contactSrc = await fs.readFile('frontend/src/pages/Contact.jsx', 'utf8');

    assert.ok(!bookSrc.includes('useProtectedAction'), 'BookService must not import useProtectedAction');
    assert.ok(!bookSrc.includes('requireAuth('), 'BookService must not wrap submit in requireAuth');
    assert.ok(!quoteSrc.includes('useProtectedAction'), 'RequestQuote must not import useProtectedAction');
    assert.ok(!quoteSrc.includes('requireAuth('), 'RequestQuote must not wrap submit in requireAuth');
    assert.ok(!contactSrc.includes('useProtectedAction'), 'Contact must not import useProtectedAction');
    assert.ok(!contactSrc.includes('requireAuth('), 'Contact must not wrap submit in requireAuth');
  });

  await t.test('10.2 Guest user (no Authorization header) can submit multipart/form-data booking', async () => {
    const body = new FormData();
    body.append('customerInfo', JSON.stringify({
      firstName: 'Guest',
      lastName: 'Booker',
      phone: '0412345000',
      email: 'e2e_guest_booker@example.com',
      contactMethod: 'email'
    }));
    body.append('vehicles', JSON.stringify([{
      vehicleInfo: {
        make: 'Mazda',
        model: '3',
        year: 2022,
        regNo: 'E2E-GST1',
        kilometers: 25000,
        transmission: 'automatic',
        fuelType: 'Petrol',
        engineSize: '2000cc'
      },
      services: ['oil', 'brakes']
    }]));
    body.append('appointment', JSON.stringify({
      date: 'Thursday, 21 November 2030',
      time: '11:00 AM'
    }));
    body.append('additionalInfo', 'Unauthenticated guest booking via FormData');

    // Explicitly call fetch with NO Authorization header
    const res = await fetch(`${API_URL}/intake/book`, {
      method: 'POST',
      body
    });
    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.ok(data.bookingReference);
  });

  await t.test('10.3 Guest user (no Authorization header) can submit quote request (JSON & FormData)', async () => {
    const jsonRes = await fetch(`${API_URL}/intake/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          fullName: 'Guest Quote User',
          phone: '0412345001',
          email: 'e2e_guest_quote@example.com',
          contactMethod: 'email'
        },
        vehicleInfo: {
          make: 'Nissan',
          model: 'X-Trail',
          year: 2020,
          regNo: 'E2E-GST2',
          kilometers: 60000,
          transmission: 'automatic'
        },
        services: ['mechanical', 'ac'],
        description: 'Unauthenticated guest quote request'
      })
    });
    const jsonData = await jsonRes.json();
    assert.equal(jsonRes.status, 201);
    assert.equal(jsonData.success, true);

    const form = new FormData();
    form.append('customerInfo', JSON.stringify({
      fullName: 'Guest FormData Quote',
      phone: '0412345002',
      email: 'e2e_guest_quote_fd@example.com',
      contactMethod: 'call'
    }));
    form.append('vehicleInfo', JSON.stringify({
      make: 'Kia',
      model: 'Sportage',
      year: 2023,
      regNo: 'E2E-GST3',
      kilometers: 15000,
      transmission: 'automatic'
    }));
    form.append('services', JSON.stringify(['inspection']));
    form.append('description', 'Unauthenticated guest quote via FormData');

    const fdRes = await fetch(`${API_URL}/intake/quote`, {
      method: 'POST',
      body: form
    });
    const fdData = await fdRes.json();
    assert.equal(fdRes.status, 201);
    assert.equal(fdData.success, true);
  });

  await t.test('10.4 Guest user (no Authorization header) can submit contact message', async () => {
    const res = await fetch(`${API_URL}/intake/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Guest',
        lastName: 'Sender',
        email: 'e2e_guest_contact@example.com',
        phone: '0412345003',
        subject: 'Guest Inquiry',
        message: 'Testing unauthenticated contact message submission.'
      })
    });
    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
  });
});

// =========================================================================
// WORKFLOW 11: Operational Modules (Dashboard, PO, Daily Sales, Dealer Cars, Rentals, Batches, Trash, Audit)
// =========================================================================
test('Workflow 11: Extended Operational Modules Verification', async (t) => {
  await t.test('11.1 Dashboard stats endpoint returns metrics', async () => {
    const res = await api('/dashboard', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('11.2 Purchase Orders list endpoint responds', async () => {
    const res = await api('/purchase-orders', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.purchaseOrders));
  });

  await t.test('11.3 Daily Sales endpoint responds', async () => {
    const res = await api('/daily-sales', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('11.4 Dealer Cars endpoint responds', async () => {
    const res = await api('/dealer-cars', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('11.5 Rental Entries endpoint responds', async () => {
    const res = await api('/rental-entries', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('11.6 Vehicle Batches (Import Trackers) endpoint responds', async () => {
    const res = await api('/vehicle-batches', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('11.7 Trash items endpoint responds', async () => {
    const res = await api('/trash', { method: 'GET' });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
  });

  await t.test('11.8 Admin employees & audit logs endpoints respond', async () => {
    const empRes = await api('/admins', { method: 'GET' });
    assert.equal(empRes.status, 200);
    assert.equal(empRes.data.success, true);

    const auditRes = await api('/admins/audit-logs', { method: 'GET' });
    assert.equal(auditRes.status, 200);
    assert.equal(auditRes.data.success, true);
  });
});
