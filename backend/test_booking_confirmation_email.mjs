import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import Booking from './src/models/Booking.js';
import Setting from './src/models/Setting.js';
import EmailService from './src/services/EmailService.js';
import {
  escapeHtml,
  sanitizeHeader,
  buildBookingSubject,
  buildBookingConfirmationHtml,
  buildBookingConfirmationText
} from './src/utils/bookingConfirmationTemplate.js';

// Setup MongoDB connection for test
test.before(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gsk_test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

test.after(async () => {
  // Clean up any test bookings
  await Booking.deleteMany({ 'customerInfo.email': 'test_confirmation_suite@example.com' });
  await mongoose.disconnect();
});

test('1. Template correctly differentiates Pending vs Confirmed and includes Sydney time & reference', () => {
  const mockSettings = {
    businessName: 'GSK Automotive',
    businessPhone: '+61 2 8856 5650',
    businessEmail: 'info@gskautomotive.com.au',
    businessAddress: '22 Artisan Rd, Seven Hills NSW 2147, Australia'
  };

  const pendingBooking = {
    bookingReference: 'GSK-BK-20261028-A1B2',
    status: 'Pending',
    customerInfo: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    },
    vehicleInfo: {
      year: '2021',
      make: 'Toyota',
      model: 'Camry',
      regNo: 'GSK-999'
    },
    appointment: {
      date: '2026-10-28',
      time: '10:30 AM'
    },
    services: ['Pink Slip Inspection', 'Basic oil service'],
    additionalInfo: 'Brakes making slight squeaking noise.'
  };

  const modelPending = EmailService.buildBookingEmailModel(pendingBooking, mockSettings);
  const subjectPending = buildBookingSubject(modelPending);
  const htmlPending = buildBookingConfirmationHtml(modelPending);
  const textPending = buildBookingConfirmationText(modelPending);

  // Subject line check
  assert.equal(subjectPending, 'Booking Request Received (Ref: GSK-BK-20261028-A1B2) \u2013 GSK Automotive');

  // Pending requirements: Must NOT say booking is confirmed
  assert.ok(htmlPending.includes('We\u2019ve Received Your Booking Request'), 'HTML must have pending title');
  assert.ok(htmlPending.includes('Awaiting Approval'), 'HTML badge must say Awaiting Approval');
  assert.ok(htmlPending.includes('not yet confirmed'), 'HTML text must state appointment is not yet confirmed');
  assert.ok(!htmlPending.includes('Your Booking Is Confirmed'), 'HTML must not state Your Booking Is Confirmed for pending status');

  // Authoritative booking details
  assert.ok(htmlPending.includes('GSK-BK-20261028-A1B2'), 'HTML must contain booking reference');
  assert.ok(htmlPending.includes('Wednesday, 28 October 2026'), 'HTML must format date in Sydney timezone');
  assert.ok(htmlPending.includes('10:30 AM'), 'HTML must include appointment time');
  assert.ok(htmlPending.includes('Australia/Sydney'), 'HTML must specify Australia/Sydney');
  assert.ok(htmlPending.includes('2021 Toyota Camry'), 'HTML must include vehicle details');
  assert.ok(htmlPending.includes('GSK-999'), 'HTML must include vehicle rego');
  assert.ok(htmlPending.includes('Pink Slip Inspection'), 'HTML must include service');
  assert.ok(htmlPending.includes('Brakes making slight squeaking noise.'), 'HTML must include notes');
  assert.ok(htmlPending.includes('+61 2 8856 5650'), 'HTML must include workshop phone');
  assert.ok(htmlPending.includes('info@gskautomotive.com.au'), 'HTML must include workshop email');

  // Text version check
  assert.ok(textPending.includes('WE\u2019VE RECEIVED YOUR BOOKING REQUEST'), 'Text must have title');
  assert.ok(textPending.includes('NOT YET CONFIRMED'), 'Text must clarify not yet confirmed');
  assert.ok(textPending.includes('GSK-BK-20261028-A1B2'), 'Text must contain reference');
  assert.ok(textPending.includes('GSK-999'), 'Text must contain rego');

  // Confirmed check
  const confirmedBooking = { ...pendingBooking, status: 'Confirmed' };
  const modelConfirmed = EmailService.buildBookingEmailModel(confirmedBooking, mockSettings);
  const subjectConfirmed = buildBookingSubject(modelConfirmed);
  const htmlConfirmed = buildBookingConfirmationHtml(modelConfirmed);
  const textConfirmed = buildBookingConfirmationText(modelConfirmed);

  assert.equal(subjectConfirmed, 'Your Booking Is Confirmed (Ref: GSK-BK-20261028-A1B2) \u2013 GSK Automotive');
  assert.ok(htmlConfirmed.includes('Your Booking Is Confirmed'), 'HTML title must state confirmed');
  assert.ok(htmlConfirmed.includes('Confirmed'), 'HTML badge must say Confirmed');
  assert.ok(textConfirmed.includes('YOUR BOOKING IS CONFIRMED'), 'Text title must state confirmed');
});

test('2. HTML escaping prevents XSS injection from customer input', () => {
  const mockSettings = { businessName: 'GSK Automotive <script>evil()</script>' };
  const maliciousBooking = {
    bookingReference: 'REF<123>',
    status: 'Pending',
    customerInfo: {
      firstName: '<b>Hacker</b>',
      lastName: '<img src=x onerror=alert(1)>',
      email: 'hacker@example.com'
    },
    vehicleInfo: {
      year: '2020',
      make: '"><script>alert(2)</script>',
      model: 'Test & Trial',
      regNo: 'REG<>&"\''
    },
    appointment: {
      date: '2026-10-28',
      time: '10:00 AM'
    },
    services: ['Oil <change> & filter'],
    additionalInfo: '<script>alert("hack")</script>\nLine 2 & "quoted"'
  };

  const model = EmailService.buildBookingEmailModel(maliciousBooking, mockSettings);
  const html = buildBookingConfirmationHtml(model);

  assert.ok(!html.includes('<script>'), 'HTML must not contain unescaped script tag');
  assert.ok(!html.includes('<img'), 'HTML must not contain unescaped img tag');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'Img tag must be escaped');
  assert.ok(html.includes('&lt;b&gt;Hacker&lt;/b&gt;'), 'Customer name must be escaped');
  assert.ok(html.includes('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;'), 'Notes must be escaped');
  assert.ok(html.includes('REG&lt;&gt;&amp;&quot;&#39;'), 'Rego special chars must be escaped');
  assert.ok(html.includes('Oil &lt;change&gt; &amp; filter'), 'Service names must be escaped');
});

test('3. Missing or invalid customer email addresses are handled safely without crashing', async () => {
  // Null booking
  const resNull = await EmailService.sendBookingConfirmation(null);
  assert.equal(resNull.success, false);

  // Missing email
  const resMissing = await EmailService.sendBookingConfirmation({
    customerInfo: { firstName: 'NoEmail', phone: '0400000000' }
  });
  assert.equal(resMissing.skipped, true);
  assert.equal(resMissing.reason, 'invalid_or_missing_email');

  // Invalid email format
  const resInvalid = await EmailService.sendBookingConfirmation({
    customerInfo: { firstName: 'BadEmail', email: 'not-an-email-address', phone: '0400000000' }
  });
  assert.equal(resInvalid.skipped, true);
  assert.equal(resInvalid.reason, 'invalid_or_missing_email');
});

test('4. Duplicate prevention: Atomic status lock prevents multiple confirmation emails for the same booking', async () => {
  const testEmail = 'test_confirmation_suite@example.com';

  // Create a booking document in MongoDB
  const booking = await Booking.create({
    bookingReference: 'GSK-BK-DUPTEST-0001',
    customerInfo: {
      firstName: 'Duplicate',
      lastName: 'Tester',
      phone: '0412345678',
      email: testEmail
    },
    vehicleInfo: {
      make: 'Subaru',
      model: 'Outback',
      year: '2022',
      regNo: 'DUP-001'
    },
    services: ['Basic oil service'],
    appointment: {
      date: '2030-11-20',
      time: '11:00 AM'
    },
    status: 'Pending',
    confirmationEmail: {
      status: 'not_sent'
    }
  });

  assert.equal(booking.confirmationEmail.status, 'not_sent');

  // First call: Should send (sandbox mode enabled to prevent wasting credits)
  const firstSend = await EmailService.sendBookingConfirmation(booking, { sandbox: true });
  assert.ok(firstSend.success, 'First send should succeed');
  assert.equal(firstSend.status, 'accepted');

  // Verify database record has been updated
  const updatedBooking = await Booking.findById(booking._id);
  assert.equal(updatedBooking.confirmationEmail.status, 'accepted');
  assert.ok(updatedBooking.confirmationEmail.acceptedAt instanceof Date);
  assert.ok(updatedBooking.confirmationEmail.messageId, 'messageId must be stored');

  // Second call (simulating duplicate submission or concurrent retry):
  const secondSend = await EmailService.sendBookingConfirmation(booking, { sandbox: true });
  assert.equal(secondSend.skipped, true, 'Second call must be skipped');
  assert.equal(secondSend.reason, 'duplicate_prevented', 'Reason must be duplicate_prevented');

  // Third call with fresh DB doc
  const thirdSend = await EmailService.sendBookingConfirmation(updatedBooking, { sandbox: true });
  assert.equal(thirdSend.skipped, true, 'Third call with refreshed doc must also be skipped');
  assert.equal(thirdSend.reason, 'duplicate_prevented');
});

test('5. Email provider failures do not invalidate or roll back saved bookings', async () => {
  const testEmail = 'test_confirmation_suite@example.com';

  const booking = await Booking.create({
    bookingReference: 'GSK-BK-FAILRES-0002',
    customerInfo: {
      firstName: 'FailureResilience',
      lastName: 'Tester',
      phone: '0412345678',
      email: testEmail
    },
    vehicleInfo: {
      make: 'Mazda',
      model: 'CX-5',
      year: '2023',
      regNo: 'RES-002'
    },
    services: ['Pre Purchase Inspection'],
    appointment: {
      date: '2030-11-20',
      time: '2:00 PM'
    },
    status: 'Pending',
    confirmationEmail: {
      status: 'not_sent'
    }
  });

  // Temporarily force an invalid API key to trigger provider error
  const originalKey = process.env.BREVO_API_KEY;
  process.env.BREVO_API_KEY = 'invalid_key_for_testing';

  try {
    const sendResult = await EmailService.sendBookingConfirmation(booking);
    assert.equal(sendResult.success, false, 'Send should report failure when provider rejects key');
    assert.ok(sendResult.error, 'Error message should be captured');

    // Verify booking in database remains completely valid and NOT deleted
    const stillExists = await Booking.findById(booking._id);
    assert.ok(stillExists, 'Booking must remain saved in database even if email fails');
    assert.equal(stillExists.customerInfo.firstName, 'FailureResilience');
    assert.equal(stillExists.confirmationEmail.status, 'failed', 'Status should be marked failed in DB');
    assert.ok(stillExists.confirmationEmail.lastError, 'lastError should be recorded');
  } finally {
    process.env.BREVO_API_KEY = originalKey;
  }
});

test('6. End-to-End: Valid booking submission persists to DB and triggers confirmation email', async () => {
  const testEmail = 'test_confirmation_suite@example.com';
  const testDate = 'Thursday, 20 November 2030';
  const testTime = '3:00 PM';

  const res = await fetch('http://localhost:5005/api/intake/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerInfo: {
        firstName: 'E2E',
        lastName: 'Customer',
        phone: '0499887766',
        email: testEmail,
        contactMethod: 'email'
      },
      vehicleInfo: {
        make: 'Honda',
        model: 'Civic',
        year: 2021,
        regNo: 'E2E-999',
        kilometers: 45000,
        transmission: 'automatic'
      },
      services: ['Basic oil service', 'Brakes & Clutches'],
      appointment: {
        date: testDate,
        time: testTime
      },
      additionalInfo: 'Testing end to end booking confirmation email flow.'
    })
  });

  const body = await res.json();
  assert.equal(res.status, 201, 'Booking should be created with 201');
  assert.ok(body.success, 'Response success should be true');
  assert.ok(Array.isArray(body.data) && body.data.length > 0, 'Should return created bookings array');
  assert.ok(body.bookingReference, 'Response should return top-level bookingReference');
  assert.match(body.bookingReference, /^GSK-BK-\d{8}-[A-F0-9]{6}$/, 'Reference should follow GSK-BK-YYYYMMDD-XXXX format');

  const createdId = body.data[0]._id;
  const savedDoc = await Booking.findById(createdId);
  assert.ok(savedDoc, 'Booking must be persisted in database');
  assert.equal(savedDoc.status, 'Pending', 'Initial status must be Pending');
  assert.equal(savedDoc.bookingReference, body.bookingReference, 'Stored reference matches response reference');
  assert.equal(savedDoc.confirmationEmail.status, 'accepted', 'confirmationEmail.status must be accepted after intake');
  assert.ok(savedDoc.confirmationEmail.messageId, 'Brevo messageId must be recorded');
  assert.ok(savedDoc.confirmationEmail.acceptedAt instanceof Date, 'acceptedAt must be recorded');
});

test('7. Invalid/Expired booking submission is rejected and does not send emails or save bookings', async () => {
  const countBefore = await Booking.countDocuments({ 'customerInfo.firstName': 'PastTest' });

  const res = await fetch('http://localhost:5005/api/intake/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerInfo: {
        firstName: 'PastTest',
        lastName: 'Customer',
        phone: '0499887766',
        email: 'test_confirmation_suite@example.com'
      },
      vehicleInfo: {
        make: 'Ford',
        model: 'Focus',
        year: 2015,
        regNo: 'PST-111'
      },
      services: ['Pink Slip Inspection'],
      appointment: {
        date: 'Monday, 20 October 2025',
        time: '9:00 AM'
      }
    })
  });

  const body = await res.json();
  assert.equal(res.status, 400, 'Past booking submission must be rejected with 400');
  assert.equal(body.success, false);

  const countAfter = await Booking.countDocuments({ 'customerInfo.firstName': 'PastTest' });
  assert.equal(countAfter, countBefore, 'No booking document should be created for rejected request');
});
