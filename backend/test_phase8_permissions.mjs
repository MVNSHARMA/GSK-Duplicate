import assert from 'node:assert/strict';
import {
  PAGE_KEYS,
  ACTION_KEYS,
  getEffectivePageAccess,
  getEffectiveActionPermissions,
  hasActionPermission,
  hasPermission,
  isValidPageKey,
  isGrantablePage,
  PERMISSIONS
} from './src/middleware/permissions.js';
import { AUDIT_EVENTS, auditEventLabel } from './src/utils/auditEvents.js';
import { sanitizeMetadata } from './src/controllers/auditController.js';

const mechanic = { role: 'mechanic', additionalPageAccess: [] };
assert.deepEqual(getEffectivePageAccess(mechanic), ['jobCards']);
assert.equal(isValidPageKey('importTrackers'), true);
assert.equal(isValidPageKey('abc123'), false);
assert.equal(isGrantablePage('employees'), false);
assert.equal(getEffectivePageAccess({ role: 'user', additionalPageAccess: ['inventory'] }).length, 0);
assert.deepEqual(getEffectivePageAccess({ role: 'admin', additionalPageAccess: [] }), PAGE_KEYS);
assert.deepEqual(
  getEffectivePageAccess({ role: 'mechanic', additionalPageAccess: ['importTrackers', 'importTrackers', 'unknown'] }),
  ['jobCards', 'importTrackers']
);
assert.equal(hasPermission('admin', PERMISSIONS.MANAGE_PAGE_ACCESS), true);
assert.equal(hasPermission('mechanic', PERMISSIONS.MANAGE_PAGE_ACCESS), false);

assert.equal(hasActionPermission(mechanic, 'jobCards.view'), true);
assert.equal(hasActionPermission(mechanic, 'inventory.view'), false);
assert.equal(hasActionPermission({ role: 'mechanic', additionalPageAccess: ['inventory'] }, 'inventory.adjustStock'), false);
assert.equal(
  hasActionPermission({ role: 'mechanic', additionalPageAccess: ['inventory'], additionalActionPermissions: ['inventory.adjustStock'] }, 'inventory.adjustStock'),
  true
);
assert.equal(
  hasActionPermission({ role: 'mechanic', additionalActionPermissions: ['inventory.adjustStock'] }, 'inventory.adjustStock'),
  false
);
assert.deepEqual(getEffectiveActionPermissions({ role: 'admin', additionalActionPermissions: [] }), ACTION_KEYS);
assert.equal(auditEventLabel(AUDIT_EVENTS.PAGE_ACCESS_GRANTED), 'Permission Granted');
assert.deepEqual(sanitizeMetadata({ page: 'inventory', password: 'hidden', nested: { token: 'hidden', enabled: true } }), {
  page: 'inventory',
  nested: { enabled: true }
});

console.log('Phase 8/9/10 permission and audit helper tests passed');
