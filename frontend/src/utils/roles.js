export const ROLE_PERMISSIONS = {
  // Define which modules each role is allowed to access
  super_admin: [
    'dashboard', 'inventory', 'suppliers', 'purchase-orders', 'customers', 'vehicles', 'vehicle-batches', 'import-trackers',
    'daily-sales', 'rentals', 'job-cards', 'invoices', 'dealer-cars',
    'employees', 'trash', 'settings', 'communications', 'booking-slots'
  ],
  admin: [
    'dashboard', 'inventory', 'suppliers', 'purchase-orders', 'customers', 'vehicles', 'vehicle-batches', 'import-trackers',
    'daily-sales', 'rentals', 'job-cards', 'invoices', 'dealer-cars',
    'trash', 'settings', 'communications', 'booking-slots'
  ],
  mechanic: [
    'job-cards'
  ],
  user: [
    'vehicle-batches'
  ]
};

export const hasAccess = (userRole, moduleName) => {
  if (!userRole || !ROLE_PERMISSIONS[userRole]) return false;
  return ROLE_PERMISSIONS[userRole].includes(moduleName);
};
