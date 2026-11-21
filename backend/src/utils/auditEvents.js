// =============================================
// AUDIT EVENTS — Complete Registry
// =============================================
// Two formats exist in the codebase:
// 1. Dotted format (from adminController, inventoryController, etc.) — e.g. 'employee.page_access.granted'
// 2. SCREAMING_SNAKE format (from newer controllers) — e.g. 'CREATE_SALE'
// Both are valid and must be labeled here.

export const AUDIT_EVENTS = {
  // Employee / Auth events (dotted format)
  PAGE_ACCESS_GRANTED: 'employee.page_access.granted',
  PAGE_ACCESS_REVOKED: 'employee.page_access.revoked',
  ACTION_PERMISSION_GRANTED: 'employee.action_permission.granted',
  ACTION_PERMISSION_REVOKED: 'employee.action_permission.revoked',
  INVITATION_CREATED: 'employee.invitation.created',
  INVITATION_REVOKED: 'employee.invitation.revoked',
  ROLE_CHANGED: 'employee.role.changed',
  ACCOUNT_DISABLED: 'employee.account.disabled',
  ACCOUNT_ENABLED: 'employee.account.enabled',
  EMPLOYEE_REMOVED: 'employee.removed',
  PASSWORD_CHANGED: 'employee.password.changed',

  // Inventory (dotted format)
  INVENTORY_STOCK_ADJUSTED: 'inventory.stock_adjusted',
  INVENTORY_CREATED: 'inventory.created',
  INVENTORY_UPDATED: 'inventory.updated',
  INVENTORY_DELETED: 'inventory.deleted',

  // Purchase Orders (dotted format)
  PURCHASE_ORDER_CREATED: 'purchase_order.created',
  PURCHASE_ORDER_UPDATED: 'purchase_order.updated',
  PURCHASE_ORDER_PLACED: 'purchase_order.placed',
  PURCHASE_ORDER_RECEIVED: 'purchase_order.received',
  PURCHASE_ORDER_CANCELLED: 'purchase_order.cancelled',
  PURCHASE_ORDER_EMAILED: 'purchase_order.emailed',

  // Suppliers (dotted format)
  SUPPLIER_CREATED: 'supplier.created',
  SUPPLIER_UPDATED: 'supplier.updated',
  SUPPLIER_DEACTIVATED: 'supplier.deactivated',

  // Invoices (dotted format — legacy)
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAYMENT_RECORDED: 'invoice.payment_recorded',
  INVOICE_EMAILED: 'invoice.emailed',

  // Job Cards (dotted format — legacy)
  JOB_CARD_CREATED: 'job_card.created',
  JOB_CARD_STATUS_CHANGED: 'job_card.status_changed',
  JOB_CARD_COMPLETED: 'job_card.completed',
  JOB_CARD_CANCELLED: 'job_card.cancelled'
};

export const AUDIT_EVENT_LABELS = {
  // ===== Dotted Format Labels =====
  [AUDIT_EVENTS.PAGE_ACCESS_GRANTED]: 'Permission Granted',
  [AUDIT_EVENTS.PAGE_ACCESS_REVOKED]: 'Permission Revoked',
  [AUDIT_EVENTS.ACTION_PERMISSION_GRANTED]: 'Action Permission Granted',
  [AUDIT_EVENTS.ACTION_PERMISSION_REVOKED]: 'Action Permission Revoked',
  [AUDIT_EVENTS.INVITATION_CREATED]: 'Employee Invitation Created',
  [AUDIT_EVENTS.INVITATION_REVOKED]: 'Employee Invitation Revoked',
  [AUDIT_EVENTS.ROLE_CHANGED]: 'Role Changed',
  [AUDIT_EVENTS.ACCOUNT_DISABLED]: 'Account Disabled',
  [AUDIT_EVENTS.ACCOUNT_ENABLED]: 'Account Enabled',
  [AUDIT_EVENTS.EMPLOYEE_REMOVED]: 'Employee Removed',
  [AUDIT_EVENTS.PASSWORD_CHANGED]: 'Password Changed',
  [AUDIT_EVENTS.INVENTORY_STOCK_ADJUSTED]: 'Stock Adjusted',
  [AUDIT_EVENTS.INVENTORY_CREATED]: 'Inventory Created',
  [AUDIT_EVENTS.INVENTORY_UPDATED]: 'Inventory Updated',
  [AUDIT_EVENTS.INVENTORY_DELETED]: 'Inventory Deleted',
  [AUDIT_EVENTS.PURCHASE_ORDER_CREATED]: 'Purchase Order Created',
  [AUDIT_EVENTS.PURCHASE_ORDER_UPDATED]: 'Purchase Order Updated',
  [AUDIT_EVENTS.PURCHASE_ORDER_PLACED]: 'Purchase Order Placed',
  [AUDIT_EVENTS.PURCHASE_ORDER_RECEIVED]: 'Purchase Order Received',
  [AUDIT_EVENTS.PURCHASE_ORDER_CANCELLED]: 'Purchase Order Cancelled',
  [AUDIT_EVENTS.PURCHASE_ORDER_EMAILED]: 'Purchase Order Emailed',
  [AUDIT_EVENTS.SUPPLIER_CREATED]: 'Supplier Created',
  [AUDIT_EVENTS.SUPPLIER_UPDATED]: 'Supplier Updated',
  [AUDIT_EVENTS.SUPPLIER_DEACTIVATED]: 'Supplier Deactivated',
  [AUDIT_EVENTS.INVOICE_CREATED]: 'Invoice Created',
  [AUDIT_EVENTS.INVOICE_PAYMENT_RECORDED]: 'Payment Recorded',
  [AUDIT_EVENTS.INVOICE_EMAILED]: 'Invoice Emailed',
  [AUDIT_EVENTS.JOB_CARD_CREATED]: 'Job Card Created',
  [AUDIT_EVENTS.JOB_CARD_STATUS_CHANGED]: 'Job Card Status Changed',
  [AUDIT_EVENTS.JOB_CARD_COMPLETED]: 'Job Card Completed',
  [AUDIT_EVENTS.JOB_CARD_CANCELLED]: 'Job Card Cancelled',

  // ===== SCREAMING_SNAKE Format Labels (from newer controllers) =====
  // Auth
  'USER_REGISTERED': 'User Registered',
  'LOGIN_SUCCESS': 'Login Success',
  'LOGIN_FAILED': 'Login Failed',
  'INVITATION_ACCEPTED': 'Invitation Accepted',
  'PASSWORD_RESET': 'Password Reset',

  // Customers
  'CREATE_CUSTOMER': 'Customer Created',
  'UPDATE_CUSTOMER': 'Customer Updated',
  'DELETE_CUSTOMER': 'Customer Deleted',
  'LINK_VEHICLE': 'Vehicle Linked to Customer',
  'UNLINK_VEHICLE': 'Vehicle Unlinked from Customer',
  'REASSIGN_VEHICLE': 'Vehicle Reassigned',
  'PROVISION_PORTAL_USER': 'Portal User Provisioned',

  // Vehicles
  'CREATE_VEHICLE': 'Vehicle Created',
  'UPDATE_VEHICLE': 'Vehicle Updated',
  'DELETE_VEHICLE': 'Vehicle Deleted',

  // Job Cards (SCREAMING_SNAKE)
  'CREATE_JOB_CARD': 'Job Card Created',
  'UPDATE_JOB_CARD': 'Job Card Updated',
  'DELETE_JOB_CARD': 'Job Card Deleted',

  // Invoices (SCREAMING_SNAKE)
  'CREATE_INVOICE': 'Invoice Created',
  'UPDATE_INVOICE': 'Invoice Updated',
  'DELETE_INVOICE': 'Invoice Deleted',
  'RECORD_PAYMENT': 'Payment Recorded',
  'SEND_INVOICE_EMAIL': 'Invoice Emailed',
  'SEND_CONSOLIDATED_INVOICE_EMAIL': 'Consolidated Invoices Emailed',

  // Sales
  'CREATE_SALE': 'Sale Created',
  'UPDATE_SALE': 'Sale Updated',
  'DELETE_SALE': 'Sale Deleted',

  // Imports
  'CREATE_IMPORT': 'Import Created',
  'UPDATE_IMPORT': 'Import Updated',
  'DELETE_IMPORT': 'Import Deleted',
  'UPDATE_IMPORT_STATUS': 'Import Status Updated',

  // Rentals
  'CREATE_RENTAL': 'Rental Created',
  'UPDATE_RENTAL': 'Rental Updated',
  'DELETE_RENTAL': 'Rental Deleted',

  // Dealer Cars
  'CREATE_DEALER_CAR': 'Dealer Car Added',
  'UPDATE_DEALER_CAR': 'Dealer Car Updated',
  'DELETE_DEALER_CAR': 'Dealer Car Deleted',

  // Vehicle Batches / Trackers
  'DELETE_VEHICLE_BATCH': 'Tracker Removed',

  // Inventory Variants
  'ADD_VARIANT': 'Variant Added',
  'UPDATE_VARIANT': 'Variant Updated',
  'DEACTIVATE_VARIANT': 'Variant Deactivated',

  // Trash
  'RESTORE_ITEM': 'Item Restored',
  'PERMANENT_DELETE': 'Permanently Deleted',
  'PERMANENT_DELETE_BULK': 'Bulk Permanently Deleted',

  // Settings
  'UPDATE_SETTINGS': 'Settings Updated'
};

export const auditEventLabel = (action) => {
  if (!action) return 'Unknown Action';
  return AUDIT_EVENT_LABELS[action] || action.replaceAll('_', ' ').replaceAll('.', ' › ');
};