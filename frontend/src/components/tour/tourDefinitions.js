export const TOUR_DEFINITIONS = {
  'admin-overview': {
    title: 'Admin Panel Overview',
    steps: [
      {
        target: '[data-tour="sidebar-dashboard"]',
        title: 'Dashboard',
        description: 'Welcome to GSK Automotive! The dashboard gives you a quick overview of operations, active jobs, and important business metrics.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-customers"]',
        title: 'Customers',
        description: 'Manage your customer information in one place. From here, you can view customer details, contact information, and their associated vehicles and service history.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-regular-customers"]',
        title: 'Regular Customers',
        description: 'View your standard service customers. You can manage their registered vehicles and track their service history directly from their profile.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-vehicles"]',
        title: 'Vehicles',
        description: 'View and manage all vehicles in your business. You can search for a vehicle, open its details, and keep its information up to date.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-import-trackers"]',
        title: 'Import Trackers',
        description: 'Follow the progress of imported vehicles through their required stages. You can manage import companies, containers, and vehicle statuses here.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-rentals"]',
        title: 'Rentals',
        description: 'Manage rental companies, their registered vehicles, and rental service jobs. Use this to update vehicle statuses in bulk and track active rentals.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-job-cards"]',
        title: 'Job Cards',
        description: 'Create a Job Card for a customer\'s vehicle to record the work that needs to be completed, assign technicians, and keep the service history organized.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-invoices"]',
        title: 'Invoices',
        description: 'Track and manage bills for completed work. You can mark invoices as paid, download PDFs, and stay on top of your financials.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-communications"]',
        title: 'Notifications',
        description: 'View unread alerts and important communications here. You will be notified when new bookings or requests arrive.',
        placement: 'right',
      },
      {
        target: '[data-tour="sidebar-settings"]',
        title: 'Settings',
        description: 'Configure your business details, operating hours, Xero accounting integration, and employee defaults.',
        placement: 'right',
      }
    ]
  },
  'dashboard': {
    title: 'Dashboard Overview',
    steps: [
      {
        target: '[data-tour="dashboard-stats"]',
        title: 'Key Statistics',
        description: 'This area gives you a quick snapshot of the business today: total active vehicles, jobs in progress, unpaid invoices, and new customers.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="dashboard-quick-actions"]',
        title: 'Quick Actions',
        description: 'Use these shortcuts to jump straight into common tasks like creating a new customer, job card, or invoice.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="dashboard-recent-activity"]',
        title: 'Recent Activity',
        description: 'A timeline of recent events, so you can easily pick up where you or your team left off.',
        placement: 'top',
      }
    ]
  },
  'job-cards': {
    title: 'Job Cards Walkthrough',
    steps: [
      {
        target: '[data-tour="job-cards-search"]',
        title: 'Search & Filters',
        description: 'Quickly find job cards by typing the Rego or Job Card number, or by filtering by the current work status.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="job-cards-list"]',
        title: 'Job Card List',
        description: 'This table shows all active and historical job cards. Select any row to view its details or update its progress.',
        placement: 'top',
      },
      {
        target: '[data-tour="job-cards-actions"]',
        title: 'Quick Actions',
        description: 'Use these buttons to edit the job card, log time, add parts, or finalize and complete the work.',
        placement: 'left',
      }
    ]
  },
  'invoices': {
    title: 'Invoices Walkthrough',
    steps: [
      {
        target: '[data-tour="invoices-search"]',
        title: 'Search & Filters',
        description: 'Find invoices easily by invoice number or Rego, or use the Status and Date filters to narrow down the list.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="invoices-list"]',
        title: 'Invoice List',
        description: 'View all invoices here. Paid invoices are highlighted in green, while unpaid ones are marked as pending.',
        placement: 'top',
      },
      {
        target: '[data-tour="invoices-actions"]',
        title: 'Invoice Actions',
        description: 'From here, you can mark an invoice as Paid, download the PDF, or edit the invoice details.',
        placement: 'left',
      }
    ]
  },
  'customers': {
    title: 'Customers Directory',
    steps: [
      {
        target: '[data-tour="customers-search"]',
        title: 'Search & Filters',
        description: 'Search for any customer by name, email, or phone. You can also filter by the type of customer.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="customers-table"]',
        title: 'Customer List',
        description: 'This is your complete customer directory. Select a customer to view their profile, history, and associated vehicles.',
        placement: 'top',
      }
    ]
  }
};
