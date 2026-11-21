import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import crypto from 'crypto';

import User from './src/models/User.js';
import Invitation from './src/models/Invitation.js';
import Setting from './src/models/Setting.js';
import {
  getEffectivePageAccess,
  getEffectiveActionPermissions,
  hasActionPermission,
  normalizePageKey,
  PAGE_KEYS,
  isGrantablePage
} from './src/middleware/permissions.js';
import { syncEmployeesWithRoleDefaults } from './src/controllers/settingController.js';
import { changeRole } from './src/controllers/adminController.js';

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('Employee Permission Workflow & Live Defaults Synchronization Integration Suite', async (t) => {
  let superAdmin;
  let regularAdmin;
  let mechanic1;
  let mechanic2;

  await t.test('1. Setup initial roles and baseline users', async () => {
    superAdmin = await User.create({
      name: 'Super Boss',
      email: 'boss@gsk.test',
      password: 'password123',
      role: 'super_admin'
    });

    regularAdmin = await User.create({
      name: 'Alice Admin',
      email: 'alice@gsk.test',
      password: 'password123',
      role: 'admin',
      pagePermissions: {
        dashboard: true,
        customers: true,
        vehicles: true,
        jobCards: true,
        invoices: true
      }
    });

    mechanic1 = await User.create({
      name: 'Bob Mechanic',
      email: 'bob@gsk.test',
      password: 'password123',
      role: 'mechanic',
      pagePermissions: {
        dashboard: false,
        jobCards: false,
        inventory: false
      }
    });

    mechanic2 = await User.create({
      name: 'Dan Mechanic',
      email: 'dan@gsk.test',
      password: 'password123',
      role: 'mechanic',
      pagePermissions: {
        dashboard: false,
        jobCards: false,
        inventory: false
      }
    });

    assert.strictEqual(superAdmin.role, 'super_admin');
    assert.strictEqual(regularAdmin.role, 'admin');
    assert.strictEqual(mechanic1.role, 'mechanic');
    assert.strictEqual(mechanic2.role, 'mechanic');

    // Super Admin has all pages
    const superPages = getEffectivePageAccess(superAdmin);
    assert.strictEqual(superPages.length, PAGE_KEYS.length);

    // Both mechanics start with jobCards explicitly false
    const bobPages = getEffectivePageAccess(mechanic1);
    assert.ok(!bobPages.includes('jobCards'), 'Bob should not have jobCards access initially');
    assert.ok(!hasActionPermission(mechanic1, 'jobCards.view'), 'Bob should not have jobCards.view action permission');

    const danPages = getEffectivePageAccess(mechanic2);
    assert.ok(!danPages.includes('jobCards'), 'Dan should not have jobCards access initially');
  });

  await t.test('2. Live Sync: Changing Mechanic defaults to enable Job Cards updates every existing Mechanic', async () => {
    const newMechanicDefaults = {
      pagePermissions: {
        dashboard: true,
        jobCards: true,
        inventory: true
      },
      additionalPageAccess: ['jobCards', 'inventory']
    };

    // Save defaults and trigger synchronization
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    if (!settings.defaultEmployeePermissions) settings.defaultEmployeePermissions = {};
    settings.defaultEmployeePermissions.mechanic = newMechanicDefaults;
    settings.markModified('defaultEmployeePermissions');
    await settings.save();

    const syncResult = await syncEmployeesWithRoleDefaults('mechanic', newMechanicDefaults);
    assert.strictEqual(syncResult.modifiedUsersCount, 2, 'Both existing mechanics must be synchronized');

    // Check Bob and Dan in DB
    const bobRefetched = await User.findById(mechanic1._id);
    const danRefetched = await User.findById(mechanic2._id);

    const bobPages = getEffectivePageAccess(bobRefetched);
    const danPages = getEffectivePageAccess(danRefetched);

    assert.ok(bobPages.includes('jobCards'), 'Bob must immediately have jobCards access');
    assert.ok(danPages.includes('jobCards'), 'Dan must immediately have jobCards access');
    assert.ok(hasActionPermission(bobRefetched, 'jobCards.view'), 'Bob must have jobCards.view action permission');
    assert.ok(hasActionPermission(danRefetched, 'jobCards.view'), 'Dan must have jobCards.view action permission');

    // Unrelated employee roles (Admin, Super Admin) must remain unaffected
    const aliceRefetched = await User.findById(regularAdmin._id);
    assert.strictEqual(aliceRefetched.role, 'admin');
    const alicePages = getEffectivePageAccess(aliceRefetched);
    assert.ok(alicePages.includes('invoices'), 'Alice Admin permissions must remain unaffected');
  });

  await t.test('3. Live Sync: Changing Mechanic defaults to disable Job Cards revokes access for every affected Mechanic', async () => {
    const revokedMechanicDefaults = {
      pagePermissions: {
        dashboard: true,
        jobCards: false,
        inventory: true
      },
      additionalPageAccess: ['inventory']
    };

    // Save and sync
    let settings = await Setting.findOne();
    settings.defaultEmployeePermissions.mechanic = revokedMechanicDefaults;
    settings.markModified('defaultEmployeePermissions');
    await settings.save();

    await syncEmployeesWithRoleDefaults('mechanic', revokedMechanicDefaults);

    // Verify revoked for Bob and Dan in DB
    const bobRefetched = await User.findById(mechanic1._id);
    const danRefetched = await User.findById(mechanic2._id);

    const bobPages = getEffectivePageAccess(bobRefetched);
    const danPages = getEffectivePageAccess(danRefetched);

    assert.ok(!bobPages.includes('jobCards'), 'Bob must have jobCards access revoked immediately');
    assert.ok(!danPages.includes('jobCards'), 'Dan must have jobCards access revoked immediately');
    assert.ok(!hasActionPermission(bobRefetched, 'jobCards.view'), 'Bob action permission must be revoked');
    assert.ok(!hasActionPermission(danRefetched, 'jobCards.view'), 'Dan action permission must be revoked');

    // Other permissions and user data remain intact
    assert.ok(bobPages.includes('inventory'), 'Bob inventory permission must remain intact');
    assert.strictEqual(bobRefetched.name, 'Bob Mechanic');
    assert.strictEqual(danRefetched.name, 'Dan Mechanic');
  });

  await t.test('4. Live Sync: Changing Admin defaults updates all existing Admins while mechanics remain unaffected', async () => {
    const newAdminDefaults = {
      pagePermissions: {
        dashboard: true,
        customers: true,
        vehicles: true,
        importTrackers: true,
        invoices: false,
        jobCards: true
      },
      additionalPageAccess: ['importTrackers', 'jobCards']
    };

    let settings = await Setting.findOne();
    settings.defaultEmployeePermissions.admin = newAdminDefaults;
    settings.markModified('defaultEmployeePermissions');
    await settings.save();

    const syncResult = await syncEmployeesWithRoleDefaults('admin', newAdminDefaults);
    assert.strictEqual(syncResult.modifiedUsersCount, 1, 'Existing admin must be synchronized');

    const aliceRefetched = await User.findById(regularAdmin._id);
    const alicePages = getEffectivePageAccess(aliceRefetched);

    assert.ok(alicePages.includes('importTrackers'), 'Alice Admin must immediately receive importTrackers');
    assert.ok(!alicePages.includes('invoices'), 'Alice Admin must have invoices revoked');

    // Mechanics must be completely unaffected
    const bobRefetched = await User.findById(mechanic1._id);
    const bobPages = getEffectivePageAccess(bobRefetched);
    assert.ok(!bobPages.includes('importTrackers'), 'Mechanics must not receive Admin defaults');
  });

  await t.test('5. Newly invited mechanic & pending invitations inherit latest defaults', async () => {
    const settings = await Setting.findOne();
    const roleDefaults = settings.defaultEmployeePermissions.mechanic;

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await Invitation.create({
      email: 'charlie.mechanic@gsk.test',
      role: 'mechanic',
      token: hashedToken,
      status: 'pending',
      invitedBy: superAdmin._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      pagePermissions: { inventory: true, jobCards: false },
      additionalPageAccess: ['inventory']
    });

    // Now update mechanic defaults again (enable jobCards)
    const updatedDefaults = {
      pagePermissions: { inventory: true, jobCards: true },
      additionalPageAccess: ['inventory', 'jobCards']
    };
    settings.defaultEmployeePermissions.mechanic = updatedDefaults;
    settings.markModified('defaultEmployeePermissions');
    await settings.save();

    await syncEmployeesWithRoleDefaults('mechanic', updatedDefaults);

    // Verify pending invitation was updated by sync
    const invRefetched = await Invitation.findById(invitation._id);
    assert.strictEqual(invRefetched.pagePermissions.get('jobCards'), true, 'Pending invitation must receive updated defaults');

    // Simulate acceptInvitation
    const newMechanic = await User.create({
      name: 'Charlie Mechanic',
      email: invitation.email,
      password: 'password123',
      role: invitation.role,
      pagePermissions: invRefetched.pagePermissions,
      additionalPageAccess: invRefetched.additionalPageAccess || []
    });

    const charliePages = getEffectivePageAccess(newMechanic);
    assert.ok(charliePages.includes('jobCards'), 'New mechanic must inherit jobCards from updated defaults');
  });

  await t.test('6. Role Change: Changing employee role applies destination role defaults', async () => {
    // Fake req and res for changeRole
    let resJsonData = null;
    let resStatusCode = null;
    const mockRes = {
      status(code) {
        resStatusCode = code;
        return this;
      },
      json(payload) {
        resJsonData = payload;
        return this;
      }
    };

    // Promote Bob (mechanic) to admin
    const req = {
      user: { _id: superAdmin._id, role: 'super_admin', name: 'Super Boss', email: 'boss@gsk.test' },
      params: { id: mechanic1._id.toString() },
      body: { role: 'admin' },
      ip: '127.0.0.1'
    };

    await changeRole(req, mockRes);
    assert.strictEqual(resStatusCode, 200);
    assert.strictEqual(resJsonData.success, true);
    assert.strictEqual(resJsonData.data.role, 'admin');

    // Verify Bob in DB now has admin permissions according to admin defaults
    const bobPromoted = await User.findById(mechanic1._id);
    assert.strictEqual(bobPromoted.role, 'admin');
    const bobPages = getEffectivePageAccess(bobPromoted);
    assert.ok(bobPages.includes('importTrackers'), 'Bob must have inherited Admin defaults for importTrackers');
    assert.ok(!bobPages.includes('invoices'), 'Bob must have inherited Admin defaults for invoices (disabled)');
  });

  await t.test('7. Role Change: Changing employee role from Admin to Mechanic applies Mechanic defaults', async () => {
    let resJsonData = null;
    let resStatusCode = null;
    const mockRes = {
      status(code) {
        resStatusCode = code;
        return this;
      },
      json(payload) {
        resJsonData = payload;
        return this;
      }
    };

    // Change Alice (admin) to mechanic
    const req = {
      user: { _id: superAdmin._id, role: 'super_admin', name: 'Super Boss', email: 'boss@gsk.test' },
      params: { id: regularAdmin._id.toString() },
      body: { role: 'mechanic' },
      ip: '127.0.0.1'
    };

    await changeRole(req, mockRes);
    assert.strictEqual(resStatusCode, 200);
    assert.strictEqual(resJsonData.success, true);
    assert.strictEqual(resJsonData.data.role, 'mechanic');

    const aliceDemoted = await User.findById(regularAdmin._id);
    assert.strictEqual(aliceDemoted.role, 'mechanic');
    const alicePages = getEffectivePageAccess(aliceDemoted);
    assert.ok(alicePages.includes('jobCards'), 'Alice must now have Mechanic defaults for jobCards');
    assert.ok(!alicePages.includes('importTrackers'), 'Alice must no longer have Admin-only importTrackers');
  });

  await t.test('8. Security Boundaries: Super Admin privileges are immutable and protected', async () => {
    // 1. syncEmployeesWithRoleDefaults with 'super_admin' role key does nothing
    const superAdminResult = await syncEmployeesWithRoleDefaults('super_admin', { pagePermissions: { dashboard: false } });
    assert.strictEqual(superAdminResult.modifiedUsersCount, 0);

    const bossRefetched = await User.findById(superAdmin._id);
    const bossPages = getEffectivePageAccess(bossRefetched);
    assert.strictEqual(bossPages.length, PAGE_KEYS.length, 'Super Admin pages must never be modified by defaults');

    // 2. Non-super admin cannot promote anyone to Super Admin
    let resJsonData = null;
    let resStatusCode = null;
    const mockRes = {
      status(code) {
        resStatusCode = code;
        return this;
      },
      json(payload) {
        resJsonData = payload;
        return this;
      }
    };

    const unauthorizedReq = {
      user: { _id: mechanic2._id, role: 'mechanic', name: 'Dan Mechanic', email: 'dan@gsk.test' },
      params: { id: mechanic2._id.toString() },
      body: { role: 'super_admin' },
      ip: '127.0.0.1'
    };

    await changeRole(unauthorizedReq, mockRes);
    assert.strictEqual(resStatusCode, 400, 'Self role change must be rejected');

    // 3. Unauthorized user promoting another employee to super_admin
    const promoteReq = {
      user: { _id: mechanic2._id, role: 'mechanic', name: 'Dan Mechanic', email: 'dan@gsk.test' },
      params: { id: mechanic1._id.toString() },
      body: { role: 'super_admin' },
      ip: '127.0.0.1'
    };
    await changeRole(promoteReq, mockRes);
    assert.strictEqual(resStatusCode, 403, 'Non-super admin cannot promote to super admin');

    // 4. Non-grantable pages cannot be granted via role defaults
    await syncEmployeesWithRoleDefaults('mechanic', {
      pagePermissions: {
        auditLogs: true,
        employees: true
      }
    });
    const danCheck = await User.findById(mechanic2._id);
    const danPages = getEffectivePageAccess(danCheck);
    assert.ok(!danPages.includes('auditLogs'), 'auditLogs must never be granted to mechanics via defaults');
    assert.ok(!danPages.includes('employees'), 'employees must never be granted to mechanics via defaults');
  });

  await t.test('9. Individual Overrides & Precedence: Individual edits work and role default saves re-synchronize cleanly', async () => {
    // Give Dan an individual override for rentals
    const dan = await User.findById(mechanic2._id);
    dan.pagePermissions.set('rentals', true);
    dan.additionalPageAccess.push('rentals');
    dan.markModified('pagePermissions');
    dan.markModified('additionalPageAccess');
    await dan.save();

    let danRefetched = await User.findById(mechanic2._id);
    assert.ok(getEffectivePageAccess(danRefetched).includes('rentals'), 'Dan has individual override for rentals');

    // Now Admin updates role defaults for mechanic where rentals: false
    await syncEmployeesWithRoleDefaults('mechanic', {
      pagePermissions: {
        jobCards: true,
        rentals: false
      }
    });

    danRefetched = await User.findById(mechanic2._id);
    assert.ok(!getEffectivePageAccess(danRefetched).includes('rentals'), 'Role defaults synchronization re-baselines and revokes rentals without silent bypass');
    assert.ok(getEffectivePageAccess(danRefetched).includes('jobCards'), 'Dan retains jobCards from updated defaults');
  });

  await t.test('10. Backward Compatibility: Legacy snake_case records normalized safely', async () => {
    const legacyMechanic = await User.create({
      name: 'Dave Legacy',
      email: 'dave.legacy@gsk.test',
      password: 'password123',
      role: 'mechanic',
      pagePermissions: {
        job_cards: true,
        import_trackers: true,
        daily_sales: false
      }
    });

    const pages = getEffectivePageAccess(legacyMechanic);
    assert.ok(pages.includes('jobCards'), 'Legacy job_cards: true must be mapped to jobCards');
    assert.ok(pages.includes('importTrackers'), 'Legacy import_trackers: true must be mapped to importTrackers');
    assert.ok(!pages.includes('dailySales'), 'Legacy daily_sales: false must be mapped to dailySales and excluded');
  });
});
