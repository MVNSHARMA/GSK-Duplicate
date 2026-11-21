export const PAGE_REGISTRY = [
  { key: 'dashboard', label: 'Dashboard', route: '/admin/dashboard' },
  { key: 'communications', label: 'Communications', route: '/admin/communications' },
  { key: 'inventory', label: 'Inventory', route: '/admin/inventory' },
  { key: 'suppliers', label: 'Suppliers', route: '/admin/suppliers', grantable: false },
  { key: 'purchaseOrders', label: 'Purchase Orders', route: '/admin/purchase-orders', grantable: false },
  { key: 'customers', label: 'Customers', route: '/admin/customers' },
  { key: 'regularCustomers', label: 'Regular Customers', route: '/admin/regular-customers' },
  { key: 'vehicles', label: 'Vehicles', route: '/admin/vehicles' },
  { key: 'vehicleBatches', label: 'Service Batches', route: '/admin/vehicle-batches' },
  { key: 'importTrackers', label: 'Import Trackers', route: '/admin/import-trackers' },
  { key: 'dailySales', label: 'Daily Sales', route: '/admin/daily-sales' },
  { key: 'rentals', label: 'Rentals', route: '/admin/rentals' },
  { key: 'jobCards', label: 'Job Cards', route: '/admin/job-cards' },
  { key: 'invoices', label: 'Invoices', route: '/admin/invoices' },
  { key: 'dealerCars', label: 'Dealer Cars', route: '/admin/dealer-cars' },
  { key: 'employees', label: 'Employees', route: '/admin/employees', grantable: false },
  { key: 'bookingSlots', label: 'Booking Slots', route: '/admin/booking-slots' },
  { key: 'trash', label: 'Trash', route: '/admin/trash' },
  { key: 'settings', label: 'Settings', route: '/admin/settings' },
  { key: 'auditLogs', label: 'Audit Logs', route: '/admin/audit-logs', grantable: false },
  { key: 'trackerCars', label: 'Tracker Cars', route: '/admin/tracker-cars' }
];

export const normalizePageKey = (key) => {
  if (!key || typeof key !== 'string') return key;
  const legacyMap = {
    job_cards: 'jobCards',
    import_trackers: 'importTrackers',
    daily_sales: 'dailySales',
    dealer_cars: 'dealerCars',
    regular_customers: 'regularCustomers',
    booking_slots: 'bookingSlots',
    audit_logs: 'auditLogs',
    service: 'dashboard'
  };
  return legacyMap[key] || key;
};

const BASE_ROLE_PAGE_ACCESS = { mechanic: ['jobCards'], admin: [] };

export const ACTION_REGISTRY = [
  ['dashboard.view', 'View Dashboard', 'dashboard'],
  ['communications.view', 'View Communications', 'communications'],
  ['communications.edit', 'Edit Communications', 'communications'],
  ['communications.reply', 'Reply to Communications', 'communications'],
  ['communications.delete', 'Delete Communications', 'communications'],
  ['inventory.view', 'View Inventory', 'inventory'],
  ['inventory.create', 'Create Inventory', 'inventory'],
  ['inventory.edit', 'Edit Inventory', 'inventory'],
  ['inventory.delete', 'Delete Inventory', 'inventory'],
  ['inventory.adjustStock', 'Adjust Stock', 'inventory'],
  ['customers.view', 'View Customers', 'customers'],
  ['customers.create', 'Create Customers', 'customers'],
  ['customers.edit', 'Edit Customers', 'customers'],
  ['customers.delete', 'Delete Customers', 'customers'],
  ['customers.provisionPortal', 'Provision Customer Portal', 'customers'],
  ['regularCustomers.view', 'View Regular Customers', 'regularCustomers'],
  ['vehicles.view', 'View Vehicles', 'vehicles'],
  ['vehicles.create', 'Create Vehicles', 'vehicles'],
  ['vehicles.edit', 'Edit Vehicles', 'vehicles'],
  ['vehicles.delete', 'Delete Vehicles', 'vehicles'],
  ['vehicles.reassign', 'Reassign Vehicles', 'vehicles'],
  ['vehicleBatches.view', 'View Service Batches', 'vehicleBatches'],
  ['vehicleBatches.create', 'Create Service Batches', 'vehicleBatches'],
  ['vehicleBatches.edit', 'Edit Service Batches', 'vehicleBatches'],
  ['vehicleBatches.delete', 'Delete Service Batches', 'vehicleBatches'],
  ['vehicleBatches.bulkImport', 'Bulk Import Service Batches', 'vehicleBatches'],
  ['importTrackers.view', 'View Import Trackers', 'importTrackers'],
  ['importTrackers.create', 'Create Import Trackers', 'importTrackers'],
  ['importTrackers.edit', 'Edit Import Trackers', 'importTrackers'],
  ['importTrackers.delete', 'Delete Import Trackers', 'importTrackers'],
  ['importTrackers.changeStatus', 'Change Import Status', 'importTrackers'],
  ['dailySales.view', 'View Daily Sales', 'dailySales'],
  ['dailySales.create', 'Create Daily Sales', 'dailySales'],
  ['dailySales.edit', 'Edit Daily Sales', 'dailySales'],
  ['dailySales.delete', 'Delete Daily Sales', 'dailySales'],
  ['rentals.view', 'View Rentals', 'rentals'],
  ['rentals.create', 'Create Rentals', 'rentals'],
  ['rentals.edit', 'Edit Rentals', 'rentals'],
  ['rentals.delete', 'Delete Rentals', 'rentals'],
  ['jobCards.view', 'View Job Cards', 'jobCards'],
  ['jobCards.create', 'Create Job Cards', 'jobCards'],
  ['jobCards.edit', 'Edit Job Cards', 'jobCards'],
  ['jobCards.delete', 'Delete Job Cards', 'jobCards'],
  ['jobCards.customerUpdates', 'Manage Customer Updates', 'jobCards'],
  ['invoices.view', 'View Invoices', 'invoices'],
  ['invoices.create', 'Create Invoices', 'invoices'],
  ['invoices.edit', 'Edit Invoices', 'invoices'],
  ['invoices.delete', 'Delete Invoices', 'invoices'],
  ['invoices.email', 'Email Invoices', 'invoices'],

  ['dealerCars.view', 'View Dealer Cars', 'dealerCars'],
  ['dealerCars.create', 'Create Dealer Cars', 'dealerCars'],
  ['dealerCars.edit', 'Edit Dealer Cars', 'dealerCars'],
  ['dealerCars.delete', 'Delete Dealer Cars', 'dealerCars'],
  ['purchaseOrders.view', 'View Purchase Orders', 'purchaseOrders', false],
  ['purchaseOrders.create', 'Create Purchase Orders', 'purchaseOrders', false],
  ['purchaseOrders.edit', 'Edit Purchase Orders', 'purchaseOrders', false],
  ['purchaseOrders.place', 'Place Purchase Orders', 'purchaseOrders', false],
  ['purchaseOrders.receive', 'Receive Purchase Orders', 'purchaseOrders', false],
  ['purchaseOrders.cancel', 'Cancel Purchase Orders', 'purchaseOrders', false],
  ['purchaseOrders.delete', 'Delete Purchase Orders', 'purchaseOrders', false],
  ['purchaseOrders.email', 'Email Purchase Orders', 'purchaseOrders', false],
  ['suppliers.view', 'View Suppliers', 'suppliers', false],
  ['suppliers.create', 'Create Suppliers', 'suppliers', false],
  ['suppliers.edit', 'Edit Suppliers', 'suppliers', false],
  ['bookingSlots.view', 'View Booking Slots', 'bookingSlots'],
  ['bookingSlots.edit', 'Edit Booking Slots', 'bookingSlots'],
  ['trash.view', 'View Trash', 'trash'],
  ['trash.restore', 'Restore Trash Items', 'trash'],
  ['trash.delete', 'Delete Trash Items', 'trash'],
  ['settings.view', 'View Settings', 'settings'],
  ['settings.edit', 'Edit Settings', 'settings'],
  ['auditLogs.view', 'View Audit Logs', 'auditLogs', false]
].map(([key, label, page, grantable = true]) => ({ key, label, page, grantable }));

const BASE_ROLE_ACTIONS = {
  mechanic: [
    'jobCards.view', 'jobCards.create', 'jobCards.edit', 'jobCards.delete', 'jobCards.customerUpdates',
    'inventory.view', 'customers.view', 'customers.create', 'customers.edit',
    'vehicles.view', 'vehicles.create', 'vehicles.edit'
  ]
};

export const getEffectivePageAccess = (user) => {
  if (!user || user.role === 'user') return [];
  if (user.role === 'super_admin') {
    return PAGE_REGISTRY.map(({ key }) => key);
  }

  const grants = Array.isArray(user.additionalPageAccess)
    ? user.additionalPageAccess.map(normalizePageKey).filter((key) => PAGE_REGISTRY.some(p => p.key === key))
    : [];
  let accessiblePages = new Set([...(BASE_ROLE_PAGE_ACCESS[user.role] || []), ...grants]);

  if (user.pagePermissions) {
    const permEntries = typeof user.pagePermissions.entries === 'function'
      ? Array.from(user.pagePermissions.entries())
      : Object.entries(user.pagePermissions);

    permEntries.forEach(([rawPage, isEnabled]) => {
      const page = normalizePageKey(rawPage);
      if (PAGE_REGISTRY.some(p => p.key === page)) {
        if (isEnabled) {
          accessiblePages.add(page);
        } else {
          accessiblePages.delete(page);
        }
      }
    });
  }

  const permCount = user.pagePermissions
    ? (typeof user.pagePermissions.size === 'number'
        ? user.pagePermissions.size
        : Object.keys(user.pagePermissions).length)
    : 0;

  // Fallback for older admins that lack explicit pagePermissions map
  if (user.role === 'admin' && permCount === 0) {
    return PAGE_REGISTRY.map(({ key }) => key);
  }

  return [...accessiblePages];
};

export const hasPageAccess = (user, pageKey) => getEffectivePageAccess(user).includes(normalizePageKey(pageKey));
export const isGrantablePage = (pageKey) => {
  const normalized = normalizePageKey(pageKey);
  return PAGE_REGISTRY.some(({ key, grantable = true }) => key === normalized && grantable);
};
export const isGrantableAction = (actionKey) => ACTION_REGISTRY.some(({ key, grantable = true }) => key === actionKey && grantable);

export const getEffectiveActionPermissions = (user) => {
  if (!user || user.role === 'user') return [];
  if (user.role === 'admin' || user.role === 'super_admin') return ACTION_REGISTRY.map(({ key }) => key);

  const grants = Array.isArray(user.additionalActionPermissions) ? user.additionalActionPermissions : [];
  return [...new Set([...(BASE_ROLE_ACTIONS[user.role] || []), ...grants])];
};

export const hasActionPermission = (user, actionKey) => {
  const action = ACTION_REGISTRY.find(({ key }) => key === actionKey);
  return Boolean(action) && hasPageAccess(user, action.page) && getEffectiveActionPermissions(user).includes(actionKey);
};