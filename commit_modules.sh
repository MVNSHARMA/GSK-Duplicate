#!/bin/bash
set -e

echo "Committing Core Setup..."
git add backend/src/app.js backend/src/middleware/permissions.js frontend/src/App.jsx frontend/src/pages/admin/Dashboard.jsx backend/test-e2e.js
git commit -m "feat: Add core routing and permissions for new modules"

echo "Committing Inventory Module..."
git add backend/src/models/Inventory.js backend/src/controllers/inventoryController.js backend/src/routes/inventoryRoutes.js frontend/src/pages/admin/Inventory.jsx
git commit -m "feat: Implement Inventory module"

echo "Committing Customers Module..."
git add backend/src/models/Customer.js backend/src/controllers/customerController.js backend/src/routes/customerRoutes.js frontend/src/pages/admin/Customers.jsx
git commit -m "feat: Implement Customers module"

echo "Committing Vehicles Module..."
git add backend/src/models/Vehicle.js backend/src/controllers/vehicleController.js backend/src/routes/vehicleRoutes.js frontend/src/pages/admin/Vehicles.jsx
git commit -m "feat: Implement Vehicles module"

echo "Committing Import Trackers Module..."
git add backend/src/models/ImportTracker.js backend/src/controllers/importTrackerController.js backend/src/routes/importTrackerRoutes.js frontend/src/pages/admin/ImportTrackers.jsx
git commit -m "feat: Implement Import Trackers module"

echo "Committing Daily Sales Module..."
git add backend/src/models/Sale.js backend/src/controllers/saleController.js backend/src/routes/saleRoutes.js frontend/src/pages/admin/DailySales.jsx
git commit -m "feat: Implement Daily Sales module"

echo "Committing Dealer Cars Module..."
git add backend/src/models/DealerCar.js backend/src/controllers/dealerCarController.js backend/src/routes/dealerCarRoutes.js frontend/src/pages/admin/DealerCars.jsx
git commit -m "feat: Implement Dealer Cars module"

echo "Committing Rentals Module..."
git add backend/src/models/Rental.js backend/src/models/Company.js backend/src/controllers/rentalController.js backend/src/routes/rentalRoutes.js frontend/src/pages/admin/Rentals.jsx
git commit -m "feat: Implement Rentals module"

echo "Committing Job Cards Module..."
git add backend/src/models/JobCard.js backend/src/controllers/jobCardController.js backend/src/routes/jobCardRoutes.js frontend/src/pages/admin/JobCards.jsx
git commit -m "feat: Implement Job Cards module"

echo "Committing Invoices Module..."
git add backend/src/models/Invoice.js backend/src/controllers/invoiceController.js backend/src/routes/invoiceRoutes.js frontend/src/pages/admin/Invoices.jsx
git commit -m "feat: Implement Invoices module"

echo "Pushing to remote..."
git push origin feat/full-stack-implementation

echo "Done!"
