import bcrypt from 'bcryptjs';

import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import Inventory from '../models/Inventory.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import JobCard from '../models/JobCard.js';
import Invoice from '../models/Invoice.js';
import InvoiceEmailLog from '../models/InvoiceEmailLog.js';
import Sale from '../models/Sale.js';
import RentalServiceEntry from '../models/RentalServiceEntry.js';
import RentalServiceEntryVehicle from '../models/RentalServiceEntryVehicle.js';
import DealerCar from '../models/DealerCar.js';
import VehicleBatch from '../models/VehicleBatch.js';
import VehicleBatchMembership from '../models/VehicleBatchMembership.js';
import Booking from '../models/Booking.js';
import BookingSlot from '../models/BookingSlot.js';
import Quote from '../models/Quote.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Setting from '../models/Setting.js';

export async function seedCompleteDemoLogic() {
    console.log("[DemoSeeder] Clearing old demo collections...");
    await Promise.all([
        Customer.deleteMany({}),
        Vehicle.deleteMany({}),
        Inventory.deleteMany({}),
        Supplier.deleteMany({}),
        PurchaseOrder.deleteMany({}),
        JobCard.deleteMany({}),
        Invoice.deleteMany({}),
        InvoiceEmailLog.deleteMany({}),
        Sale.deleteMany({}),
        RentalServiceEntry.deleteMany({}),
        RentalServiceEntryVehicle.deleteMany({}),
        DealerCar.deleteMany({}),
        VehicleBatch.deleteMany({}),
        VehicleBatchMembership.deleteMany({}),
        Booking.deleteMany({}),
        BookingSlot.deleteMany({}),
        Quote.deleteMany({}),
        Notification.deleteMany({}),
        AuditLog.deleteMany({}),
        Setting.deleteMany({})
    ]);

    console.log("[DemoSeeder] Initializing Settings...");
    await Setting.create({
        businessName: 'GSK Automotive',
        businessAddress: '22 Artisan Rd, Seven Hills NSW 2147, Australia',
        businessPhone: '+61 2 8856 5650',
        businessEmail: 'info@gskautomotive.com.au',
        gstRate: 10,
        standardLabourRate: 120,
        timezone: 'Australia/Sydney',
        defaultBookingCapacity: 3,
        inventoryWarningThreshold: 5,
        invoicePrefix: 'INV-'
    });

    console.log("[DemoSeeder] Ensuring staff accounts...");
    const staffPasswordHash = await bcrypt.hash("password123", 10);
    
    let adminUser = await User.findOne({ role: 'super_admin' });
    if (!adminUser) {
        adminUser = await User.create({
            name: "Boss / Owner",
            email: process.env.DEFAULT_ADMIN_EMAIL || "admin@gskautomotive.com",
            password: staffPasswordHash,
            role: "super_admin",
            status: "active"
        });
    }

    let managerUser = await User.findOne({ email: "mike.manager@gskautomotive.com" });
    if (!managerUser) {
        managerUser = await User.create({
            name: "Mike Manager",
            email: "mike.manager@gskautomotive.com",
            password: staffPasswordHash,
            role: "admin",
            status: "active"
        });
    }

    let mechanicJohn = await User.findOne({ email: "john.mechanic@gskautomotive.com" });
    if (!mechanicJohn) {
        mechanicJohn = await User.create({
            name: "John Lead Mechanic",
            email: "john.mechanic@gskautomotive.com",
            password: staffPasswordHash,
            role: "mechanic",
            status: "active"
        });
    }

    let mechanicSarah = await User.findOne({ email: "sarah.service@gskautomotive.com" });
    if (!mechanicSarah) {
        mechanicSarah = await User.create({
            name: "Sarah Technician",
            email: "sarah.service@gskautomotive.com",
            password: staffPasswordHash,
            role: "mechanic",
            status: "active"
        });
    }

    console.log("[DemoSeeder] Creating Customers (Retail, Fleet & Imports)...");
    const [michael, sarahJ, david, emma, aussieFleet, sydneyCarHire, sakuraJdm, tokyoAuto] = await Customer.create([
        {
            name: "Michael Davies",
            email: "michael.d@example.com.au",
            phone: "0412 345 678",
            address: "12 George St, Seven Hills NSW 2147",
            customerType: "regular",
            totalVisits: 6,
            totalSpend: 2450
        },
        {
            name: "Sarah Jenkins",
            email: "sarah.j@example.com.au",
            phone: "0434 567 890",
            address: "45 Pitt St, Parramatta NSW 2150",
            customerType: "regular",
            totalVisits: 3,
            totalSpend: 1120
        },
        {
            name: "David Nguyen",
            email: "david.n@example.com.au",
            phone: "0411 222 333",
            address: "88 Sussex St, Blacktown NSW 2148",
            customerType: "regular",
            totalVisits: 2,
            totalSpend: 650
        },
        {
            name: "Emma Thompson",
            email: "emma.t@example.com.au",
            phone: "0422 789 012",
            address: "19 Terminus St, Castle Hill NSW 2154",
            customerType: "regular",
            totalVisits: 1,
            totalSpend: 280
        },
        {
            name: "Aussie Fleet Rentals Pty Ltd",
            email: "fleet@aussiefleet.com.au",
            phone: "1300 123 456",
            address: "1 Airport Dr, Mascot NSW 2020",
            customerType: "rental_company",
            idType: "ACN",
            idNumber: "111 222 333",
            totalVisits: 14,
            totalSpend: 18400
        },
        {
            name: "Sydney City Car Hire",
            email: "admin@sydneycarhire.com.au",
            phone: "1300 987 654",
            address: "200 William St, Woolloomooloo NSW 2011",
            customerType: "rental_company",
            idType: "ACN",
            idNumber: "444 555 666",
            totalVisits: 9,
            totalSpend: 12600
        },
        {
            name: "Sakura JDM Imports Pty Ltd",
            email: "sales@sakurajdm.com.au",
            phone: "02 9876 5432",
            address: "100 Parramatta Rd, Auburn NSW 2144",
            customerType: "import_company",
            idType: "ABN",
            idNumber: "12 345 678 901",
            totalVisits: 22,
            totalSpend: 28900
        },
        {
            name: "Tokyo Auto Trade",
            email: "imports@tokyoauto.com.au",
            phone: "02 8765 4321",
            address: "55 Victoria Rd, Rydalmere NSW 2116",
            customerType: "import_company",
            idType: "ABN",
            idNumber: "98 765 432 109",
            totalVisits: 16,
            totalSpend: 19500
        }
    ]);

    console.log("[DemoSeeder] Creating Vehicles...");
    const [hilux, camry, i30, ranger, cx5, bmw3, corollaFlt1, corollaFlt2] = await Vehicle.create([
        {
            customerId: michael._id,
            brand: "Toyota",
            make: "Toyota",
            model: "HiLux SR5 Dual Cab",
            year: 2021,
            registrationNumber: "NSW-8899",
            vin: "MR0HA3CD123456789",
            mileage: 62450,
            color: "Glacier White",
            status: "Available"
        },
        {
            customerId: michael._id,
            brand: "Toyota",
            make: "Toyota",
            model: "Camry Ascent Hybrid",
            year: 2020,
            registrationNumber: "CAM-101",
            vin: "JTDBU123456789012",
            mileage: 48900,
            color: "Silver Pearl",
            status: "Available"
        },
        {
            customerId: sarahJ._id,
            brand: "Hyundai",
            make: "Hyundai",
            model: "i30 N-Line Hatch",
            year: 2022,
            registrationNumber: "HYU-332",
            vin: "KMHCT41CB12345678",
            mileage: 34100,
            color: "Polar White",
            status: "In Workshop"
        },
        {
            customerId: david._id,
            brand: "Ford",
            make: "Ford",
            model: "Ranger Wildtrak 4x4",
            year: 2021,
            registrationNumber: "RNG-404",
            vin: "1FDRANGER00018899",
            mileage: 58200,
            color: "Saber Orange",
            status: "Completed"
        },
        {
            customerId: emma._id,
            brand: "Mazda",
            make: "Mazda",
            model: "CX-5 Touring AWD",
            year: 2022,
            registrationNumber: "MZD-555",
            vin: "JM3KF4DY123456789",
            mileage: 26800,
            color: "Soul Red Crystal",
            status: "Available"
        },
        {
            customerId: michael._id,
            brand: "BMW",
            make: "BMW",
            model: "330i M Sport Sedan",
            year: 2019,
            registrationNumber: "BMW-330",
            vin: "WBA5R1C5123456789",
            mileage: 71500,
            color: "Mineral Grey",
            status: "Awaiting Parts"
        },
        {
            customerId: aussieFleet._id,
            brand: "Toyota",
            make: "Toyota",
            model: "Corolla Hybrid Sedan",
            year: 2023,
            registrationNumber: "FLT-101",
            vin: "JTDBR32E123456789",
            mileage: 21400,
            dailyRate: 55,
            color: "Silver",
            status: "Available"
        },
        {
            customerId: aussieFleet._id,
            brand: "Toyota",
            make: "Toyota",
            model: "Corolla Hybrid Sedan",
            year: 2023,
            registrationNumber: "FLT-102",
            vin: "JTDBR32E987654321",
            mileage: 28900,
            dailyRate: 55,
            color: "White",
            status: "Rented"
        }
    ]);

    console.log("[DemoSeeder] Creating Suppliers...");
    const [bosch, repco, castrol] = await Supplier.create([
        {
            name: "Bosch Automotive Australia",
            contactPerson: "Mark Anderson",
            email: "trade.orders@bosch.com.au",
            phone: "+61 2 9540 8800",
            address: "1553 Centre Rd, Clayton VIC 3168"
        },
        {
            name: "Repco Commercial Auto Parts",
            contactPerson: "David Miller",
            email: "sevenhills@repco.com.au",
            phone: "+61 2 8814 7700",
            address: "Unit 3, 20 Artisan Rd, Seven Hills NSW 2147"
        },
        {
            name: "Castrol Lubricants Australia",
            contactPerson: "Helen Brooks",
            email: "orders@castrol.com.au",
            phone: "+61 2 9795 3000",
            address: "132 McCredie Rd, Guildford NSW 2161"
        }
    ]);

    console.log("[DemoSeeder] Creating Inventory...");
    const [engineOilCastrol, oilFilterToyota, brakePadsFront, sparkPlugsNGK, batteryBosch, wiperBlades] = await Inventory.create([
        {
            itemName: "Castrol EDGE 5W-30 Full Synthetic Oil (5L)",
            category: "Fluids",
            quantity: 42,
            minStockLevel: 10,
            unitPrice: 58.00,
            unitCost: 34.00,
            supplier: "Castrol Lubricants Australia",
            itemCode: "OIL-CAS-5W30"
        },
        {
            itemName: "Toyota Genuine Engine Oil Filter",
            category: "Filters",
            quantity: 28,
            minStockLevel: 8,
            unitPrice: 24.50,
            unitCost: 12.00,
            supplier: "Repco Commercial Auto Parts",
            itemCode: "FLT-TOY-001"
        },
        {
            itemName: "Bendix Heavy Duty Front Brake Pads Set",
            category: "Parts",
            quantity: 2, // Low stock triggers warning badge on dashboard!
            minStockLevel: 6,
            unitPrice: 125.00,
            unitCost: 68.00,
            supplier: "Repco Commercial Auto Parts",
            itemCode: "BRK-BEN-FR"
        },
        {
            itemName: "NGK Laser Iridium Spark Plug (Pack of 4)",
            category: "Parts",
            quantity: 16,
            minStockLevel: 5,
            unitPrice: 85.00,
            unitCost: 45.00,
            supplier: "Bosch Automotive Australia",
            itemCode: "SPK-NGK-IR4"
        },
        {
            itemName: "Bosch High Performance AGM Battery 12V 70Ah",
            category: "Batteries",
            quantity: 7,
            minStockLevel: 3,
            unitPrice: 245.00,
            unitCost: 145.00,
            supplier: "Bosch Automotive Australia",
            itemCode: "BAT-BOS-70AH"
        },
        {
            itemName: "Bosch Aerotwin Front Wiper Blades Set 24\"/18\"",
            category: "Accessories",
            quantity: 35,
            minStockLevel: 10,
            unitPrice: 38.00,
            unitCost: 16.00,
            supplier: "Bosch Automotive Australia",
            itemCode: "WPR-BOS-2418"
        }
    ]);

    console.log("[DemoSeeder] Creating Purchase Orders...");
    await PurchaseOrder.create([
        {
            purchaseOrderNumber: "PO-1001",
            supplierId: castrol._id,
            createdBy: adminUser._id,
            status: "Received",
            subtotal: 1360.00,
            totalAmount: 1360.00,
            items: [{
                inventoryId: engineOilCastrol._id,
                productName: engineOilCastrol.itemName,
                quantityOrdered: 40,
                quantityReceived: 40,
                unitPurchasePrice: 34.00
            }],
            receivedAt: new Date(Date.now() - 5 * 86400000)
        },
        {
            purchaseOrderNumber: "PO-1002",
            supplierId: bosch._id,
            createdBy: managerUser._id,
            status: "Received",
            subtotal: 1450.00,
            totalAmount: 1450.00,
            items: [{
                inventoryId: batteryBosch._id,
                productName: batteryBosch.itemName,
                quantityOrdered: 10,
                quantityReceived: 10,
                unitPurchasePrice: 145.00
            }],
            receivedAt: new Date(Date.now() - 2 * 86400000)
        },
        {
            purchaseOrderNumber: "PO-1003",
            supplierId: repco._id,
            createdBy: adminUser._id,
            status: "Ordered",
            subtotal: 680.00,
            totalAmount: 680.00,
            items: [{
                inventoryId: brakePadsFront._id,
                productName: brakePadsFront.itemName,
                quantityOrdered: 10,
                quantityReceived: 0,
                unitPurchasePrice: 68.00
            }]
        }
    ]);

    console.log("[DemoSeeder] Creating Job Cards...");
    const [jobHiLux, jobI30, jobRanger] = await JobCard.create([
        {
            jobCardNumber: "JC-1001",
            customerId: michael._id,
            vehicleId: hilux._id,
            technicianId: mechanicJohn._id,
            mechanic: "John Lead Mechanic",
            servicesOrdered: ["Major 60k Logbook Service", "Engine Oil Flush", "Brake Fluid Replacement"],
            servicesProvided: [
                { name: "Major Service Labor", cost: 240, quantity: 2, total: 240 },
                { name: "Safety & Diagnostic Scan", cost: 80, quantity: 1, total: 80 }
            ],
            partsUsed: [
                { inventoryId: engineOilCastrol._id, quantity: 1, unitPrice: 58.00 },
                { inventoryId: oilFilterToyota._id, quantity: 1, unitPrice: 24.50 }
            ],
            needsAttention: ["Front brake pads wearing thin (30% remaining)"],
            repairsOrdered: "Routine 60,000km scheduled maintenance. Replace all engine filters and fluids.",
            labourHours: 2.5,
            hourlyRate: 120,
            charges: { lubricantsOil: 58, miscellaneous: 15, differentialOil: 0, transmission: 0, brakeFluid: 25 },
            status: "Invoiced",
            notes: "Vehicle runs perfectly. Customer advised on front brake pad replacement next service.",
            createdAt: new Date(Date.now() - 3 * 86400000)
        },
        {
            jobCardNumber: "JC-1002",
            customerId: sarahJ._id,
            vehicleId: i30._id,
            technicianId: mechanicSarah._id,
            mechanic: "Sarah Technician",
            servicesOrdered: ["Front Brake Inspection", "Brake Rotor Machining"],
            servicesProvided: [
                { name: "Brake Overhaul Labor", cost: 180, quantity: 1.5, total: 180 }
            ],
            partsUsed: [
                { inventoryId: brakePadsFront._id, quantity: 1, unitPrice: 125.00 }
            ],
            needsAttention: ["Slight brake vibration under heavy braking"],
            repairsOrdered: "Customer complains of grinding noise when braking from speed. Inspect and replace pads.",
            labourHours: 1.5,
            hourlyRate: 120,
            status: "In Progress",
            notes: "Rotors inspected. Machining in progress.",
            createdAt: new Date(Date.now() - 1 * 86400000)
        },
        {
            jobCardNumber: "JC-1003",
            customerId: david._id,
            vehicleId: ranger._id,
            technicianId: mechanicJohn._id,
            mechanic: "John Lead Mechanic",
            servicesOrdered: ["4x4 Suspension Inspection", "Wheel Alignment"],
            servicesProvided: [
                { name: "Suspension Service & Alignment", cost: 210, quantity: 1.75, total: 210 }
            ],
            partsUsed: [],
            needsAttention: ["Rear leaf spring bushings have minor wear"],
            repairsOrdered: "Pre-outback trip inspection. Check suspension, steering linkage, and tie rod ends.",
            labourHours: 1.75,
            hourlyRate: 120,
            status: "Completed",
            notes: "4WD safety check completed. Front alignment tuned to factory spec.",
            createdAt: new Date(Date.now() - 2 * 86400000)
        },
        {
            jobCardNumber: "JC-1004",
            customerId: michael._id,
            vehicleId: bmw3._id,
            technicianId: mechanicSarah._id,
            mechanic: "Sarah Technician",
            servicesOrdered: ["Check Engine Diagnostics", "Ignition Coil & Spark Plugs"],
            servicesProvided: [
                { name: "OBD2 Full Diagnostics Scan", cost: 120, quantity: 1, total: 120 }
            ],
            partsUsed: [
                { inventoryId: sparkPlugsNGK._id, quantity: 1, unitPrice: 85.00 }
            ],
            needsAttention: ["Cylinder 2 intermittent misfire code P0302"],
            repairsOrdered: "Check engine light illuminated. Engine runs rough at idle.",
            labourHours: 1.0,
            hourlyRate: 120,
            status: "Pending Approval",
            notes: "Quote prepared for customer. Awaiting approval for ignition coil set.",
            createdAt: new Date(Date.now() - 12 * 3600000)
        },
        {
            jobCardNumber: "JC-1005",
            customerId: michael._id,
            vehicleId: camry._id,
            technicianId: mechanicJohn._id,
            mechanic: "John Lead Mechanic",
            servicesOrdered: ["eSafety Check (Pink Slip)", "Battery Health Test"],
            servicesProvided: [
                { name: "NSW Pink Slip Inspection", cost: 45, quantity: 1, total: 45 },
                { name: "Battery Load Test", cost: 20, quantity: 1, total: 20 }
            ],
            partsUsed: [],
            needsAttention: [],
            repairsOrdered: "Annual registration roadworthy inspection.",
            labourHours: 0.5,
            hourlyRate: 120,
            status: "Completed",
            notes: "Passed NSW roadworthy inspection. Pass certificate sent to Service NSW electronically.",
            createdAt: new Date(Date.now() - 8 * 3600000)
        }
    ]);

    console.log("[DemoSeeder] Creating Invoices...");
    const [inv1, inv2] = await Invoice.create([
        {
            invoiceNo: "INV-1001",
            type: "Service Invoice",
            customerId: michael._id,
            vehicleId: hilux._id,
            jobCardId: jobHiLux._id,
            status: "Paid",
            invoiceDate: new Date(Date.now() - 3 * 86400000),
            issuedAt: new Date(Date.now() - 3 * 86400000),
            customerSnapshot: {
                name: michael.name,
                email: michael.email,
                phone: michael.phone,
                address: michael.address,
                customerType: "regular"
            },
            vehicleSnapshot: {
                registrationNumber: hilux.registrationNumber,
                brand: hilux.brand,
                model: hilux.model,
                year: String(hilux.year),
                vin: hilux.vin
            },
            partsAndLabour: [
                { description: "60k Scheduled Major Logbook Service", qty: 2.5, price: 120.00 },
                { description: "Castrol EDGE 5W-30 Full Synthetic Oil (5L)", qty: 1, price: 58.00 },
                { description: "Toyota Genuine Engine Oil Filter", qty: 1, price: 24.50 },
                { description: "Workshop Consumables & Environmental Disposal", qty: 1, price: 15.00 }
            ],
            subtotal: 397.50,
            gstAmount: 39.75,
            totalAmount: 437.25,
            amountPaid: 437.25,
            balanceDue: 0,
            paidAt: new Date(Date.now() - 3 * 86400000)
        },
        {
            invoiceNo: "INV-1002",
            type: "Rental Invoice",
            customerId: aussieFleet._id,
            vehicleId: corollaFlt1._id,
            status: "Paid",
            invoiceDate: new Date(Date.now() - 5 * 86400000),
            issuedAt: new Date(Date.now() - 5 * 86400000),
            customerSnapshot: {
                name: aussieFleet.name,
                email: aussieFleet.email,
                phone: aussieFleet.phone,
                address: aussieFleet.address,
                customerType: "rental_company"
            },
            partsAndLabour: [
                { description: "Fleet Vehicle Scheduled Servicing (Corolla FLT-101)", qty: 1, price: 320.00 },
                { description: "Fleet Vehicle Scheduled Servicing (Corolla FLT-102)", qty: 1, price: 320.00 },
                { description: "Front Wiper Replacement & Brake Fluid Flush", qty: 2, price: 95.00 }
            ],
            subtotal: 830.00,
            gstAmount: 83.00,
            totalAmount: 913.00,
            amountPaid: 913.00,
            balanceDue: 0,
            paidAt: new Date(Date.now() - 4 * 86400000)
        },
        {
            invoiceNo: "INV-1003",
            type: "Service Invoice",
            customerId: sarahJ._id,
            vehicleId: i30._id,
            jobCardId: jobI30._id,
            status: "Unpaid",
            invoiceDate: new Date(),
            issuedAt: new Date(),
            customerSnapshot: {
                name: sarahJ.name,
                email: sarahJ.email,
                phone: sarahJ.phone,
                address: sarahJ.address,
                customerType: "regular"
            },
            partsAndLabour: [
                { description: "Brake System Overhaul Labor", qty: 1.5, price: 120.00 },
                { description: "Bendix Heavy Duty Front Brake Pads Set", qty: 1, price: 125.00 },
                { description: "Brake Disc Rotor Machining", qty: 2, price: 45.00 }
            ],
            subtotal: 395.00,
            gstAmount: 39.50,
            totalAmount: 434.50,
            amountPaid: 0,
            balanceDue: 434.50
        },
        {
            invoiceNo: "INV-1004",
            type: "Service Invoice",
            customerId: david._id,
            vehicleId: ranger._id,
            jobCardId: jobRanger._id,
            status: "Partially Paid",
            invoiceDate: new Date(Date.now() - 2 * 86400000),
            issuedAt: new Date(Date.now() - 2 * 86400000),
            customerSnapshot: {
                name: david.name,
                email: david.email,
                phone: david.phone,
                address: david.address,
                customerType: "regular"
            },
            partsAndLabour: [
                { description: "4WD 20-Point Off-Road Safety Inspection", qty: 1, price: 150.00 },
                { description: "4-Wheel Laser Wheel Alignment", qty: 1, price: 110.00 },
                { description: "Castrol High-Temp Wheel Bearing Grease", qty: 1, price: 35.00 }
            ],
            subtotal: 295.00,
            gstAmount: 29.50,
            totalAmount: 324.50,
            amountPaid: 150.00,
            balanceDue: 174.50
        },
        {
            invoiceNo: "INV-1005",
            type: "General Invoice",
            customerId: tokyoAuto._id,
            status: "Unpaid",
            invoiceDate: new Date(Date.now() - 15 * 86400000),
            issuedAt: new Date(Date.now() - 15 * 86400000),
            customerSnapshot: {
                name: tokyoAuto.name,
                email: tokyoAuto.email,
                phone: tokyoAuto.phone,
                address: tokyoAuto.address,
                customerType: "import_company"
            },
            partsAndLabour: [
                { description: "ADR Compliance Pre-Inspection Service (3 Vehicles)", qty: 3, price: 250.00 }
            ],
            subtotal: 750.00,
            gstAmount: 75.00,
            totalAmount: 825.00,
            amountPaid: 0,
            balanceDue: 825.00
        }
    ]);

    console.log("[DemoSeeder] Creating Sent Invoice Logs...");
    await InvoiceEmailLog.create([
        {
            customerId: michael._id,
            customerName: michael.name,
            recipientEmail: michael.email,
            invoiceIds: [inv1._id],
            invoiceNumbers: [inv1.invoiceNo],
            invoiceCount: 1,
            combinedAmount: inv1.totalAmount,
            currency: "AUD",
            mode: "single",
            subject: "Tax Invoice INV-1001 — GSK Automotive",
            sentByName: "GSK Automotive Accounts",
            sentAt: new Date(Date.now() - 3 * 86400000)
        },
        {
            customerId: aussieFleet._id,
            customerName: aussieFleet.name,
            recipientEmail: aussieFleet.email,
            invoiceIds: [inv2._id],
            invoiceNumbers: [inv2.invoiceNo],
            invoiceCount: 1,
            combinedAmount: inv2.totalAmount,
            currency: "AUD",
            mode: "consolidated",
            subject: "Consolidated Monthly Fleet Tax Invoice INV-1002 — GSK Automotive",
            sentByName: "GSK Automotive Accounts",
            sentAt: new Date(Date.now() - 5 * 86400000)
        }
    ]);

    console.log("[DemoSeeder] Creating Daily Sales...");
    await Sale.create([
        {
            customerId: michael._id,
            items: [
                { inventoryId: engineOilCastrol._id, quantity: 1, unitPrice: 58.00, discount: 0, subtotal: 58.00 },
                { inventoryId: wiperBlades._id, quantity: 1, unitPrice: 38.00, discount: 0, subtotal: 38.00 }
            ],
            paymentMethod: "Card",
            totalAmount: 96.00
        },
        {
            items: [
                { inventoryId: wiperBlades._id, quantity: 2, unitPrice: 38.00, discount: 6.00, subtotal: 70.00 }
            ],
            paymentMethod: "Cash",
            totalAmount: 70.00
        },
        {
            items: [
                { inventoryId: batteryBosch._id, quantity: 1, unitPrice: 245.00, discount: 0, subtotal: 245.00 }
            ],
            paymentMethod: "EFTPOS",
            totalAmount: 245.00
        }
    ]);

    console.log("[DemoSeeder] Creating Rentals...");
    const rentalVisit = await RentalServiceEntry.create({
        customerId: aussieFleet._id,
        notes: "Monthly fleet return inspection & fluid top-up"
    });

    await RentalServiceEntryVehicle.create([
        {
            serviceEntryId: rentalVisit._id,
            vehicleId: corollaFlt1._id,
            status: "In Service",
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 24 * 3600000) },
                { status: "In Service", timestamp: new Date() }
            ]
        },
        {
            serviceEntryId: rentalVisit._id,
            vehicleId: corollaFlt2._id,
            status: "Completed",
            completionOdometer: 28900,
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 48 * 3600000) },
                { status: "In Service", timestamp: new Date(Date.now() - 24 * 3600000) },
                { status: "Completed", timestamp: new Date() }
            ]
        }
    ]);

    console.log("[DemoSeeder] Creating Dealer Cars...");
    await DealerCar.create([
        {
            stockNumber: "STK-7001",
            make: "Mazda",
            model: "BT-50 XTR Dual Cab",
            year: 2020,
            vin: "1MZBT500000987654",
            purchasePrice: 26500,
            sellPrice: 31990,
            cost: 26500,
            dealerName: "Seven Hills Prestige Wholesale",
            purchaseDate: new Date(Date.now() - 4 * 86400000),
            status: "In Stock"
        },
        {
            stockNumber: "STK-7002",
            make: "Toyota",
            model: "RAV4 Cruiser Hybrid",
            year: 2021,
            vin: "JTMB31FV123456789",
            purchasePrice: 34000,
            sellPrice: 39500,
            salePrice: 39500,
            cost: 34000,
            dealerName: "Blacktown Auto Gallery",
            purchaseDate: new Date(Date.now() - 10 * 86400000),
            soldDate: new Date(Date.now() - 1 * 86400000),
            status: "Sold"
        }
    ]);

    console.log("[DemoSeeder] Creating Vehicle Batches...");
    const importBatch = await VehicleBatch.create({
        batchNumber: "IMP-2026-001",
        customerId: sakuraJdm._id,
        type: "IMPORT",
        status: "IN PROGRESS",
        totalVehicles: 2
    });

    await VehicleBatchMembership.insertMany([
        {
            batchId: importBatch._id,
            vehicleInfo: { vin: "AGH30-0198273", make: "Toyota", model: "Alphard Executive Lounge", year: 2018 },
            status: "Compliance",
            statusUpdatedAt: new Date(),
            isActive: true
        },
        {
            batchId: importBatch._id,
            vehicleInfo: { vin: "PE52-0876123", make: "Nissan", model: "Elgrand Highway Star", year: 2017 },
            status: "Received",
            statusUpdatedAt: new Date(),
            isActive: true
        }
    ]);

    console.log("[DemoSeeder] Creating Bookings & Slots...");
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfterStr = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

    await BookingSlot.create([
        { date: todayStr, time: "08:30 AM", capacity: 3 },
        { date: todayStr, time: "11:00 AM", capacity: 3 },
        { date: todayStr, time: "02:00 PM", capacity: 3 },
        { date: tomorrowStr, time: "09:00 AM", capacity: 3 },
        { date: tomorrowStr, time: "01:30 PM", capacity: 3 },
        { date: dayAfterStr, time: "10:00 AM", capacity: 3 }
    ]);

    const [booking1] = await Booking.create([
        {
            customerId: emma._id,
            vehicleId: cx5._id,
            appointment: { date: tomorrowStr, time: "09:00 AM" },
            customerInfo: { firstName: "Emma", lastName: "Thompson", email: emma.email, phone: emma.phone },
            vehicleInfo: { make: "Mazda", model: "CX-5", regNo: "MZD-555" },
            serviceType: "Logbook Service",
            status: "Confirmed",
            notes: "Prefers morning drop-off before 9:00 AM."
        },
        {
            customerId: michael._id,
            vehicleId: hilux._id,
            appointment: { date: dayAfterStr, time: "10:00 AM" },
            customerInfo: { firstName: "Michael", lastName: "Davies", email: michael.email, phone: michael.phone },
            vehicleInfo: { make: "Toyota", model: "HiLux", regNo: "NSW-8899" },
            serviceType: "Wheel Alignment & Tyre Balance",
            status: "Confirmed",
            notes: "Check rear tyre pressure as well."
        }
    ]);

    console.log("[DemoSeeder] Creating Quotes...");
    await Quote.create([
        {
            customerInfo: { firstName: "Robert", lastName: "Taylor", email: "robert.t@example.com", phone: "0455 123 456" },
            vehicleInfo: { make: "Volkswagen", model: "Golf GTI", year: 2017, regNo: "VWG-777" },
            services: ["Logbook Servicing", "Brake & Clutch"],
            description: "Quote for 100,000km major service including timing chain inspection.",
            status: "pending",
            createdAt: new Date(Date.now() - 4 * 3600000)
        },
        {
            customerInfo: { firstName: "Karen", lastName: "White", email: "karen.w@example.com", phone: "0466 987 654" },
            vehicleInfo: { make: "Subaru", model: "Forester", year: 2019, regNo: "SUB-808" },
            services: ["Air Conditioning", "Mechanical Repairs"],
            description: "Air conditioner blowing warm air on hot days. Need diagnostic and regas quote.",
            status: "reviewed",
            createdAt: new Date(Date.now() - 20 * 3600000)
        }
    ]);

    console.log("[DemoSeeder] Creating Notifications & Audit Logs...");
    await Notification.create([
        {
            userId: adminUser._id,
            type: "new_booking",
            title: "New Booking: Emma Thompson",
            message: "Mazda CX-5 scheduled for Logbook Service tomorrow at 09:00 AM.",
            referenceId: booking1._id,
            referenceType: "Booking",
            isRead: false
        },
        {
            userId: adminUser._id,
            type: "low_stock",
            title: "Low Stock Alert: Bendix Front Brake Pads",
            message: "Current stock is 2 sets (minimum threshold: 6). Reorder recommended.",
            referenceId: brakePadsFront._id,
            referenceType: "Inventory",
            isRead: false
        },
        {
            userId: adminUser._id,
            type: "invoice_paid",
            title: "Payment Received: $437.25",
            message: "Michael Davies completed full payment for Invoice INV-1001.",
            referenceId: inv1._id,
            referenceType: "Invoice",
            isRead: true
        }
    ]);

    await AuditLog.create([
        { action: "CREATE_CUSTOMER", performedBy: adminUser._id, entityId: michael._id, entityModel: "Customer", details: "Created Regular Customer Michael Davies", timestamp: new Date(Date.now() - 6 * 86400000) },
        { action: "CREATE_CUSTOMER", performedBy: adminUser._id, entityId: aussieFleet._id, entityModel: "Customer", details: "Created B2B Rental Company Aussie Fleet Rentals", timestamp: new Date(Date.now() - 5 * 86400000) },
        { action: "RECEIVE_PURCHASE_ORDER", performedBy: adminUser._id, entityId: engineOilCastrol._id, entityModel: "PurchaseOrder", details: "Received PO-1001 (Castrol EDGE 5W-30 Oil)", timestamp: new Date(Date.now() - 5 * 86400000) },
        { action: "CREATE_JOB_CARD", performedBy: managerUser._id, entityId: jobHiLux._id, entityModel: "JobCard", details: "Created Job Card JC-1001 for Toyota HiLux", timestamp: new Date(Date.now() - 3 * 86400000) },
        { action: "CREATE_INVOICE", performedBy: adminUser._id, entityId: inv1._id, entityModel: "Invoice", details: "Generated Tax Invoice INV-1001 ($437.25)", timestamp: new Date(Date.now() - 3 * 86400000) },
        { action: "INVOICE_PAID", performedBy: adminUser._id, entityId: inv1._id, entityModel: "Invoice", details: "Full payment received for INV-1001 via Card", timestamp: new Date(Date.now() - 3 * 86400000) },
        { action: "SEND_EMAIL", performedBy: adminUser._id, entityId: inv1._id, entityModel: "Invoice", details: "Sent Tax Invoice INV-1001 PDF to michael.d@example.com.au", timestamp: new Date(Date.now() - 3 * 86400000) },
        { action: "CREATE_BOOKING", performedBy: adminUser._id, entityId: booking1._id, entityModel: "Booking", details: "Confirmed appointment for Emma Thompson", timestamp: new Date(Date.now() - 1 * 86400000) }
    ]);

    console.log("[DemoSeeder] Seeding completed successfully!");
}
