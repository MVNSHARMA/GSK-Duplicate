const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'backend', 'src', 'routes');

const pageMapping = {
  'vehicleRoutes.js': 'vehicles',
  'saleRoutes.js': 'daily_sales',
  'customerRoutes.js': 'customers',
  'inventoryRoutes.js': 'inventory',
  'importTrackerRoutes.js': 'import_trackers',
  'rentalRoutes.js': 'rentals',
  'jobCardRoutes.js': 'job_cards',
  'invoiceRoutes.js': 'invoices',
  'dealerCarRoutes.js': 'dealer_cars',
};

for (const [file, page] of Object.entries(pageMapping)) {
  const filePath = path.join(routesDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add requirePageAccess to import
    if (content.includes("import protect, { requirePermission } from '../middleware/auth.js';")) {
      content = content.replace(
        "import protect, { requirePermission } from '../middleware/auth.js';",
        "import protect, { requirePermission, requirePageAccess } from '../middleware/auth.js';"
      );
    }
    
    // Add router.use(requirePageAccess(page)) after router.use(protect);
    if (!content.includes(`requirePageAccess('${page}')`)) {
      content = content.replace(
        /router\.use\(protect\);/,
        `router.use(protect);\nrouter.use(requirePageAccess('${page}'));`
      );
    }
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
}
