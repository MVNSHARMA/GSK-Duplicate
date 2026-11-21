export const PERMISSIONS = {
  VIEW_ADMIN_DASHBOARD: "VIEW_ADMIN_DASHBOARD",
  MANAGE_BOOKINGS: "MANAGE_BOOKINGS",
  MANAGE_USERS: "MANAGE_USERS",
  INVITE_ADMINS: "INVITE_ADMINS",
  CHANGE_ADMIN_ROLES: "CHANGE_ADMIN_ROLES",
  REMOVE_ADMINS: "REMOVE_ADMINS",
  MANAGE_INVITATIONS: "MANAGE_INVITATIONS",
  DISABLE_ACCOUNTS: "DISABLE_ACCOUNTS",
  MANAGE_INVENTORY: "MANAGE_INVENTORY",
  MANAGE_CUSTOMERS: "MANAGE_CUSTOMERS",
  MANAGE_VEHICLES: "MANAGE_VEHICLES",
  MANAGE_IMPORTS: "MANAGE_IMPORTS",
  MANAGE_SALES: "MANAGE_SALES",
  MANAGE_DEALER_CARS: "MANAGE_DEALER_CARS",
  MANAGE_RENTALS: "MANAGE_RENTALS",
  MANAGE_JOB_CARDS: "MANAGE_JOB_CARDS",
  MANAGE_INVOICES: "MANAGE_INVOICES",
  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
  MANAGE_COMMUNICATIONS: "MANAGE_COMMUNICATIONS",
  MANAGE_PAGE_ACCESS: "MANAGE_PAGE_ACCESS"
};

export const ROLE_PERMISSIONS = {
  user: [],
  admin: [
    PERMISSIONS.VIEW_ADMIN_DASHBOARD,
    PERMISSIONS.MANAGE_BOOKINGS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_VEHICLES,
    PERMISSIONS.MANAGE_IMPORTS,
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.MANAGE_DEALER_CARS,
    PERMISSIONS.MANAGE_RENTALS,
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_COMMUNICATIONS,
    PERMISSIONS.MANAGE_PAGE_ACCESS
  ],
  super_admin: [
    PERMISSIONS.VIEW_ADMIN_DASHBOARD,
    PERMISSIONS.MANAGE_BOOKINGS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.INVITE_ADMINS,
    PERMISSIONS.CHANGE_ADMIN_ROLES,
    PERMISSIONS.REMOVE_ADMINS,
    PERMISSIONS.MANAGE_INVITATIONS,
    PERMISSIONS.DISABLE_ACCOUNTS,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_VEHICLES,
    PERMISSIONS.MANAGE_IMPORTS,
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.MANAGE_DEALER_CARS,
    PERMISSIONS.MANAGE_RENTALS,
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.MANAGE_PERMISSIONS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_COMMUNICATIONS,
    PERMISSIONS.MANAGE_PAGE_ACCESS
  ],
  mechanic: [
    PERMISSIONS.VIEW_ADMIN_DASHBOARD,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.MANAGE_CUSTOMERS,
    PERMISSIONS.MANAGE_VEHICLES,
    PERMISSIONS.MANAGE_JOB_CARDS
  ]
};

/**
 * Checks if a role has a specific permission
 */
export const hasPermission = (userOrRole, permission) => {
  if (permission.includes('.') && typeof userOrRole === 'object') {
    return hasActionPermission(userOrRole, permission);
  }

  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  if (!ROLE_PERMISSIONS[role]) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
};

export const ACTION_REGISTRY = [
  { key: 'dashboard.view', label: 'View Dashboard', page: 'dashboard' },
  { key: 'communications.view', label: 'View Communications', page: 'communications' },
  { key: 'communications.edit', label: 'Edit Communications', page: 'communications' },
  { key: 'communications.reply', label: 'Reply to Communications', page: 'communications' },
  { key: 'communications.delete', label: 'Delete Communications', page: 'communications' },
  { key: 'inventory.view', label: 'View Inventory', page: 'inventory' },
  { key: 'inventory.create', label: 'Create Inventory', page: 'inventory' },
  { key: 'inventory.edit', label: 'Edit Inventory', page: 'inventory' },
  { key: 'inventory.delete', label: 'Delete Inventory', page: 'inventory' },
  { key: 'inventory.adjustStock', label: 'Adjust Stock', page: 'inventory' },
  { key: 'customers.view', label: 'View Customers', page: 'customers' },
  { key: 'customers.create', label: 'Create Customers', page: 'customers' },
  { key: 'customers.edit', label: 'Edit Customers', page: 'customers' },
  { key: 'customers.delete', label: 'Delete Customers', page: 'customers' },
  { key: 'customers.provisionPortal', label: 'Provision Customer Portal', page: 'customers' },
  { key: 'vehicles.view', label: 'View Vehicles', page: 'vehicles' },
  { key: 'vehicles.create', label: 'Create Vehicles', page: 'vehicles' },
  { key: 'vehicles.edit', label: 'Edit Vehicles', page: 'vehicles' },
  { key: 'vehicles.delete', label: 'Delete Vehicles', page: 'vehicles' },
  { key: 'vehicles.reassign', label: 'Reassign Vehicles', page: 'vehicles' },
  { key: 'vehicleBatches.view', label: 'View Service Batches', page: 'vehicleBatches' },
  { key: 'vehicleBatches.create', label: 'Create Service Batches', page: 'vehicleBatches' },
  { key: 'vehicleBatches.edit', label: 'Edit Service Batches', page: 'vehicleBatches' },
  { key: 'vehicleBatches.delete', label: 'Delete Service Batches', page: 'vehicleBatches' },
  { key: 'vehicleBatches.bulkImport', label: 'Bulk Import Service Batches', page: 'vehicleBatches' },
  { key: 'importTrackers.view', label: 'View Import Trackers', page: 'importTrackers' },
  { key: 'importTrackers.create', label: 'Create Import Trackers', page: 'importTrackers' },
  { key: 'importTrackers.edit', label: 'Edit Import Trackers', page: 'importTrackers' },
  { key: 'importTrackers.delete', label: 'Delete Import Trackers', page: 'importTrackers' },
  { key: 'importTrackers.changeStatus', label: 'Change Import Status', page: 'importTrackers' },
  { key: 'dailySales.view', label: 'View Daily Sales', page: 'dailySales' },
  { key: 'rentals.view', label: 'View Rentals', page: 'rentals' },
  { key: 'rentals.create', label: 'Create Rentals', page: 'rentals' },
  { key: 'rentals.edit', label: 'Edit Rentals', page: 'rentals' },
  { key: 'rentals.delete', label: 'Delete Rentals', page: 'rentals' },
  { key: 'jobCards.view', label: 'View Job Cards', page: 'jobCards' },
  { key: 'jobCards.create', label: 'Create Job Cards', page: 'jobCards' },
  { key: 'jobCards.edit', label: 'Edit Job Cards', page: 'jobCards' },
  { key: 'jobCards.delete', label: 'Delete Job Cards', page: 'jobCards' },
  { key: 'jobCards.customerUpdates', label: 'Manage Customer Updates', page: 'jobCards' },
  { key: 'invoices.view', label: 'View Invoices', page: 'invoices' },
  { key: 'invoices.create', label: 'Create Invoices', page: 'invoices' },
  { key: 'invoices.edit', label: 'Edit Invoices', page: 'invoices' },
  { key: 'invoices.delete', label: 'Delete Invoices', page: 'invoices' },
  { key: 'invoices.email', label: 'Email Invoices', page: 'invoices' },

  { key: 'dealerCars.view', label: 'View Dealer Cars', page: 'dealerCars' },
  { key: 'dealerCars.create', label: 'Create Dealer Cars', page: 'dealerCars' },
  { key: 'dealerCars.edit', label: 'Edit Dealer Cars', page: 'dealerCars' },
  { key: 'dealerCars.delete', label: 'Delete Dealer Cars', page: 'dealerCars' },
  { key: 'purchaseOrders.view', label: 'View Purchase Orders', page: 'purchaseOrders', grantable: false },
  { key: 'purchaseOrders.create', label: 'Create Purchase Orders', page: 'purchaseOrders', grantable: false },
  { key: 'purchaseOrders.edit', label: 'Edit Purchase Orders', page: 'purchaseOrders', grantable: false },
  { key: 'purchaseOrders.place', label: 'Place Purchase Orders', page: 'purchaseOrders', grantable: false },
  { key: 'purchaseOrders.receive', label: 'Receive Purchase Orders', page: 'purchaseOrders', grantable: false },
  { key: 'purchaseOrders.cancel', label: 'Cancel Purchase Orders', page: 'purchaseOrders', grantable: false },
  { key: 'purchaseOrders.delete', label: 'Delete Purchase Orders', page: 'purchaseOrders', grantable: false },
  { key: 'purchaseOrders.email', label: 'Email Purchase Orders', page: 'purchaseOrders', grantable: false },
  { key: 'suppliers.view', label: 'View Suppliers', page: 'suppliers', grantable: false },
  { key: 'suppliers.create', label: 'Create Suppliers', page: 'suppliers', grantable: false },
  { key: 'suppliers.edit', label: 'Edit Suppliers', page: 'suppliers', grantable: false },
  { key: 'bookingSlots.view', label: 'View Booking Slots', page: 'bookingSlots' },
  { key: 'bookingSlots.edit', label: 'Edit Booking Slots', page: 'bookingSlots' },
  { key: 'trash.view', label: 'View Trash', page: 'trash' },
  { key: 'trash.restore', label: 'Restore Trash Items', page: 'trash' },
  { key: 'trash.delete', label: 'Delete Trash Items', page: 'trash' },
  { key: 'settings.view', label: 'View Settings', page: 'settings' },
  { key: 'settings.edit', label: 'Edit Settings', page: 'settings' },
  { key: 'auditLogs.view', label: 'View Audit Logs', page: 'auditLogs', grantable: false },
  { key: 'employees.view', label: 'View Employees', page: 'employees', grantable: false },
  { key: 'employees.managePermissions', label: 'Manage Permissions', page: 'employees', grantable: false },
  { key: 'employees.manageRoles', label: 'Manage Roles', page: 'employees', grantable: false },
  { key: 'employees.manageStatus', label: 'Manage Account Status', page: 'employees', grantable: false },
  { key: 'employees.remove', label: 'Remove Employees', page: 'employees', grantable: false }
];

export const ACTION_KEYS = ACTION_REGISTRY.map(({ key }) => key);
const ACTIONS_BY_KEY = new Map(ACTION_REGISTRY.map((action) => [action.key, action]));
export const isValidActionKey = (actionKey) => ACTION_KEYS.includes(actionKey);
export const isGrantableAction = (actionKey) => {
  const action = ACTIONS_BY_KEY.get(actionKey);
  return Boolean(action) && action.grantable !== false;
};
export const getActionDefinition = (actionKey) => ACTIONS_BY_KEY.get(actionKey);

const BASE_ROLE_ACTIONS = {
  mechanic: [
    'jobCards.view', 'jobCards.create', 'jobCards.edit', 'jobCards.delete', 'jobCards.customerUpdates',
    'inventory.view', 'customers.view', 'customers.create', 'customers.edit',
    'vehicles.view', 'vehicles.create', 'vehicles.edit'
  ]
};

export const getEffectiveActionPermissions = (user) => {
  if (!user || user.role === 'user') return [];
  if (user.role === 'admin' || user.role === 'super_admin') return [...ACTION_KEYS];

  const baseActions = BASE_ROLE_ACTIONS[user.role] || [];
  const explicitActions = Array.isArray(user.additionalActionPermissions)
    ? user.additionalActionPermissions.filter(isValidActionKey)
    : [];

  return [...new Set([...baseActions, ...explicitActions])];
};

export const hasActionPermission = (user, actionKey) => {
  const action = getActionDefinition(actionKey);
  if (!action || !getEffectivePageAccess(user).includes(action.page)) return false;
  return getEffectiveActionPermissions(user).includes(actionKey);
};

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

/**
 * Page-level access mapping: maps page names to their corresponding route keys
 */
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

export const PAGE_KEYS = PAGE_REGISTRY.map(({ key }) => key);
export const BASE_ROLE_PAGE_ACCESS = { mechanic: ['jobCards'], admin: [] };
export const isValidPageKey = (pageKey) => PAGE_KEYS.includes(normalizePageKey(pageKey));
export const isGrantablePage = (pageKey) => {
  const normalized = normalizePageKey(pageKey);
  const page = PAGE_REGISTRY.find(({ key }) => key === normalized);
  return Boolean(page) && page.grantable !== false;
};

export const getEffectivePageAccess = (user) => {
  if (!user || user.role === 'user') return [];
  if (user.role === 'super_admin') return [...PAGE_KEYS];

  const baseAccess = BASE_ROLE_PAGE_ACCESS[user.role] || [];
  const explicitAccess = Array.isArray(user.additionalPageAccess)
    ? user.additionalPageAccess.map(normalizePageKey).filter((key) => PAGE_KEYS.includes(key))
    : [];

  let accessiblePages = new Set([...baseAccess, ...explicitAccess]);

  if (user.pagePermissions) {
    const permEntries = typeof user.pagePermissions.entries === 'function' 
        ? Array.from(user.pagePermissions.entries()) 
        : Object.entries(user.pagePermissions);
        
    permEntries.forEach(([rawPage, isEnabled]) => {
      const page = normalizePageKey(rawPage);
      if (PAGE_KEYS.includes(page)) {
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

  if (user.role === 'admin' && permCount === 0) {
      return [...PAGE_KEYS];
  }

  return [...accessiblePages];
};

/**
 * Middleware: requirePageAccess(pageName)
 * Checks if the authenticated user has access to the given admin page.
 */
export const requirePageAccess = (pageName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    if (getEffectivePageAccess(req.user).includes(pageName)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'You do not have access to this page.'
    });
  };
};
