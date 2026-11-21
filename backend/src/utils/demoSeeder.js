import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: './.env' });

import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import Supplier from '../models/Supplier.js';
import Inventory from '../models/Inventory.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import JobCard from '../models/JobCard.js';
import Invoice from '../models/Invoice.js';
import Booking from '../models/Booking.js';
import Quote from '../models/Quote.js';
import DealerCar from '../models/DealerCar.js';
import AuditLog from '../models/AuditLog.js';
import VehicleBatch from '../models/VehicleBatch.js';
import VehicleBatchMembership from '../models/VehicleBatchMembership.js';
import Notification from '../models/Notification.js';
import Sequence from '../models/Sequence.js';

const seedData = async () => {
    console.log("==========================================");
    console.log("   INITIATING DEMO DATABASE RESET & SEED   ");
    console.log("==========================================");

    if (process.env.NODE_ENV === 'production') {
        console.error("CRITICAL ERROR: Refusing to run in production environment.");
        process.exit(1);
    }

    if (!process.env.DEMO_ADMIN_PASSWORD) {
        console.error("CRITICAL ERROR: DEMO_ADMIN_PASSWORD environment variable is missing.");
        console.error("Please add DEMO_ADMIN_PASSWORD to your .env file.");
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log(`Connected to MongoDB: ${mongoose.connection.db.databaseName}`);

        console.log("\n1. Wiping Business Collections...");
        await AuditLog.deleteMany({});
        await Booking.deleteMany({});
        await Customer.deleteMany({});
        await DealerCar.deleteMany({});
        await Inventory.deleteMany({});
        await InventoryTransaction.deleteMany({});
        await Invoice.deleteMany({});
        await JobCard.deleteMany({});
        await Notification.deleteMany({});
        await PurchaseOrder.deleteMany({});
        await Quote.deleteMany({});
        await Supplier.deleteMany({});
        await VehicleBatch.deleteMany({});
        await VehicleBatchMembership.deleteMany({});
        await Vehicle.deleteMany({});
        
        // Reset counters for POs and Invoices to start fresh for demo
        await Sequence.deleteMany({});
        
        // Recreate clean demo users
        await User.deleteMany({});

        console.log("\n2. Seeding Users...");
        const adminUser = await User.create({
            name: "Super Admin",
            email: "admin@gskautomobiles.com",
            password: process.env.DEMO_ADMIN_PASSWORD,
            role: "super_admin",
            status: "active"
        });

        console.log("\n3. Seeding Customers...");
        const johnDoe = await Customer.create({
            name: "John Doe",
            email: "john@demo.com",
            phone: "0400111222",
            customerType: "regular",
            address: "123 Main St, Sydney NSW 2000"
        });

        const importCompany = await Customer.create({
            name: "Japan Auto Imports Pty Ltd",
            email: "imports@japanauto.demo.com",
            phone: "0400333444",
            customerType: "import_company"
        });

        const rentalCompany = await Customer.create({
            name: "City Rentals Group",
            email: "fleet@cityrentals.demo.com",
            phone: "0400555666",
            customerType: "rental_company"
        });

        console.log("\n4. Seeding Permanent Vehicles...");
        const johnCamry = await Vehicle.create({
            customerId: johnDoe._id,
            brand: "Toyota",
            model: "Camry",
            year: "2020",
            registrationNumber: "ABC-123",
            vin: "JTDBU123456789012",
            mileage: 45000,
            status: "Available"
        });

        console.log("\n5. Seeding Inventory (Product -> Variant -> Sub-Variant -> Sub-Sub-Variant)...");
        // Level 1: Product
        const brakePads = await Inventory.create({
            itemCode: "PRD-BRAKES",
            itemName: "Brake Pads Set",
            category: "Parts",
            type: "Product",
            retailPrice: 150,
            unitCost: 80,
            stockQuantity: 0
        });

        // Level 2: Variant
        const frontBrakes = await Inventory.create({
            itemCode: "VAR-BRAKES-FR",
            itemName: "Front Brake Pads",
            category: "Parts",
            type: "Variant",
            parentId: brakePads._id,
            retailPrice: 150,
            unitCost: 80,
            stockQuantity: 0
        });

        // Level 3: Sub-Variant (Leaf nodes holding stock)
        const toyotaFrontBrakes = await Inventory.create({
            itemCode: "BP-TY-FR-001",
            itemName: "Toyota Camry Front Brake Pads",
            category: "Parts",
            type: "Sub-Variant",
            parentId: frontBrakes._id,
            retailPrice: 160,
            unitCost: 85,
            stockQuantity: 10,
            minStockLevel: 5
        });

        const hondaFrontBrakes = await Inventory.create({
            itemCode: "BP-HO-FR-001",
            itemName: "Honda Civic Front Brake Pads",
            category: "Parts",
            type: "Sub-Variant",
            parentId: frontBrakes._id,
            retailPrice: 140,
            unitCost: 75,
            stockQuantity: 2,
            minStockLevel: 5
        });

        console.log("\n6. Seeding Suppliers & Purchase Orders...");
        const partsPro = await Supplier.create({
            name: "PartsPro Auto Spares",
            contactPerson: "Dave Smith",
            email: "dave@partspro.demo.com",
            phone: "02 9876 5432"
        });

        // Received PO (Updates Stock)
        const poReceived = await PurchaseOrder.create({
            purchaseOrderNumber: "PO-1001",
            supplierId: partsPro._id,
            createdBy: adminUser._id,
            status: "Received",
            subtotal: 425,
            totalAmount: 425,
            items: [{
                inventoryId: toyotaFrontBrakes._id,
                variantId: toyotaFrontBrakes._id,
                productName: "Brake Pads Set",
                variantName: "Toyota Camry Front Brake Pads",
                quantityOrdered: 5,
                quantityReceived: 5,
                unitPurchasePrice: 85
            }],
            receivedAt: new Date()
        });

        await InventoryTransaction.create({
            inventoryId: toyotaFrontBrakes._id,
            variantId: toyotaFrontBrakes._id,
            type: "PURCHASE_RECEIPT",
            quantity: 5,
            previousQuantity: 10, // Stock before this PO
            newQuantity: 15,
            performedBy: adminUser._id,
            reference: poReceived._id,
            notes: "Initial PO Receipt Demo"
        });

        // Pending PO
        await PurchaseOrder.create({
            purchaseOrderNumber: "PO-1002",
            supplierId: partsPro._id,
            createdBy: adminUser._id,
            status: "Ordered",
            subtotal: 750,
            totalAmount: 750,
            items: [{
                inventoryId: hondaFrontBrakes._id,
                variantId: hondaFrontBrakes._id,
                productName: "Brake Pads Set",
                variantName: "Honda Civic Front Brake Pads",
                quantityOrdered: 10,
                quantityReceived: 0,
                unitPurchasePrice: 75
            }]
        });

        console.log("\n7. Seeding Import / Rental Trackers...");
        const importBatch = await VehicleBatch.create({
            batchNumber: "IMP-2026-001",
            customerId: importCompany._id,
            type: "IMPORT",
            status: "IN PROGRESS",
            totalVehicles: 2
        });

        const [importCar1, importCar2] = await VehicleBatchMembership.insertMany([
            {
                batchId: importBatch._id,
                vehicleInfo: { vin: "IMPJDM12345001", make: "Toyota", model: "Alphard", year: 2018 },
                status: "Received",
                statusUpdatedAt: new Date(),
                isActive: true
            },
            {
                batchId: importBatch._id,
                vehicleInfo: { vin: "IMPJDM12345002", make: "Nissan", model: "Elgrand", year: 2019 },
                status: "Compliance",
                statusUpdatedAt: new Date(),
                isActive: true
            }
        ]);

        const rentalBatch = await VehicleBatch.create({
            batchNumber: "RENT-2026-001",
            customerId: rentalCompany._id,
            type: "RENTAL",
            status: "IN PROGRESS",
            totalVehicles: 1
        });

        await VehicleBatchMembership.insertMany([{
            batchId: rentalBatch._id,
            vehicleInfo: { regNo: "RNT-999", make: "Hyundai", model: "i30", year: 2021 },
            status: "In Service",
            statusUpdatedAt: new Date(),
            isActive: true
        }]);

        console.log("\n8. Seeding Job Cards & Invoices...");
        
        // Completed Job Card -> Generates single deduction
        const completedJob = await JobCard.create({
            jobCardNumber: "JC-1001",
            customerId: johnDoe._id,
            vehicleId: johnCamry._id,
            mechanicId: adminUser._id,
            status: "Completed",
            serviceType: "Major Service",
            reportedIssues: "Brakes grinding",
            mechanicNotes: "Replaced front brake pads.",
            laborHours: 2,
            laborRate: 120,
            partsUsed: [{
                inventoryId: toyotaFrontBrakes._id,
                quantity: 1,
                price: 160
            }],
            totalCost: 400, // 2*120 + 1*160
            completedAt: new Date(Date.now() - 86400000)
        });

        await InventoryTransaction.create({
            inventoryId: toyotaFrontBrakes._id,
            variantId: toyotaFrontBrakes._id,
            type: "JOB_CARD_USAGE",
            quantity: -1,
            previousQuantity: 15, // Stock before this JobCard
            newQuantity: 14,
            performedBy: adminUser._id,
            reference: completedJob._id,
            notes: "Used in JC-1001"
        });

        const [paidInvoice] = await Invoice.insertMany([{
            invoiceNo: "INV-1001",
            type: "Service Invoice",
            customerId: johnDoe._id,
            vehicleId: johnCamry._id,
            jobCardId: completedJob._id,
            status: "Paid",
            issueDate: new Date(Date.now() - 86400000),
            dueDate: new Date(Date.now() + 86400000),
            partsAndLabour: [
                { description: "Labor (2 hours)", qty: 2, price: 120 },
                { description: "Toyota Front Brakes", qty: 1, price: 160 }
            ],
            totalAmount: 400,
            amountPaid: 400,
            paidAt: new Date(Date.now() - 40000000)
        }]);

        // In Progress Job Card
        await JobCard.create({
            jobCardNumber: "JC-1002",
            customerId: importCompany._id, // Tracker B2B
            trackerId: importBatch._id,
            trackerCarId: importCar1._id,
            mechanicId: adminUser._id,
            status: "In Progress",
            serviceType: "Compliance Check",
            reportedIssues: "Standard import compliance",
            laborHours: 0,
            laborRate: 150,
            partsUsed: [],
            totalCost: 0
        });

        console.log("\n9. Seeding Dealer Cars...");
        const purchasedDealerCar = await DealerCar.create({
            stockNumber: "STK-5001",
            make: "Ford",
            model: "Ranger",
            year: 2019,
            vin: "1FDRANGER0001",
            purchasePrice: 25000,
            sellPrice: 30000,
            cost: 25000,
            dealerName: "Demo Wholesale Cars",
            purchaseDate: new Date(Date.now() - 172800000), // 2 days ago (Money Out)
            status: "In Stock"
        });

        const soldDealerCar = await DealerCar.create({
            stockNumber: "STK-5002",
            make: "Mazda",
            model: "BT-50",
            year: 2020,
            vin: "1MZBT5000002",
            purchasePrice: 22000,
            sellPrice: 28000,
            cost: 22000,
            dealerName: "Demo Wholesale Cars",
            purchaseDate: new Date(Date.now() - 345600000), // 4 days ago
            status: "Sold",
            soldDate: new Date(Date.now() - 86400000), // 1 day ago (Money In)
            salePrice: 28000
        });

        console.log("\n10. Seeding Bookings & Notifications...");
        const newBooking = await Booking.create({
            customerId: johnDoe._id,
            vehicleId: johnCamry._id,
            appointment: {
                date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                time: "09:00 AM"
            },
            customerInfo: {
                firstName: "John",
                lastName: "Doe",
                email: "john@example.com",
                phone: "0412345678"
            },
            vehicleInfo: {
                make: "Toyota",
                model: "Camry",
                regNo: "CAM-001"
            },
            serviceType: "Minor Service",
            status: "Confirmed",
            notes: "Customer needs it back by 2PM"
        });

        await Notification.create({
            userId: adminUser._id,
            type: "new_booking",
            title: "New Booking Received",
            message: "John Doe booked a Minor Service.",
            referenceId: newBooking._id,
            referenceType: "Booking",
            isRead: false
        });

        console.log("\n11. Generating Canonical Audit Logs...");
        await AuditLog.create([
            { action: "CREATE_CUSTOMER", performedBy: adminUser._id, entityId: johnDoe._id, entityModel: "Customer", details: "Created Regular Customer John Doe", timestamp: new Date(Date.now() - 200000) },
            { action: "CREATE_CUSTOMER", performedBy: adminUser._id, entityId: importCompany._id, entityModel: "Customer", details: "Created Import Company", timestamp: new Date(Date.now() - 190000) },
            { action: "CREATE_VEHICLE", performedBy: adminUser._id, entityId: johnCamry._id, entityModel: "Vehicle", details: "Added Toyota Camry", timestamp: new Date(Date.now() - 180000) },
            { action: "CREATE_JOB_CARD", performedBy: adminUser._id, entityId: completedJob._id, entityModel: "JobCard", details: "Created Job Card JC-1001", timestamp: new Date(Date.now() - 170000) },
            { action: "JOB_CARD_COMPLETED", performedBy: adminUser._id, entityId: completedJob._id, entityModel: "JobCard", details: "Completed JC-1001", timestamp: new Date(Date.now() - 160000) },
            { action: "CREATE_INVOICE", performedBy: adminUser._id, entityId: paidInvoice._id, entityModel: "Invoice", details: "Generated Invoice INV-1001", timestamp: new Date(Date.now() - 150000) },
            { action: "INVOICE_PAID", performedBy: adminUser._id, entityId: paidInvoice._id, entityModel: "Invoice", details: "Payment Received for INV-1001", timestamp: new Date(Date.now() - 140000) }
        ]);

        console.log("\n==========================================");
        console.log("   DEMO DATA RESET & REBUILD COMPLETE     ");
        console.log("==========================================");
        process.exit(0);

    } catch (error) {
        console.error("Seeding Error:", error);
        process.exit(1);
    }
};

seedData();
