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
import Contact from '../models/Contact.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Setting from '../models/Setting.js';
import Sequence from '../models/Sequence.js';

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
        Contact.deleteMany({}),
        Notification.deleteMany({}),
        AuditLog.deleteMany({}),
        Setting.deleteMany({}),
        Sequence.deleteMany({})
    ]);

    console.log("[DemoSeeder] Initializing Settings & Sequences...");
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

    await Sequence.create([
        { key: 'invoiceNumber', value: 1006 }
    ]);

    console.log("[DemoSeeder] Ensuring staff accounts...");
    let adminUser = await User.findOne({ email: "admin@gskautomotive.com" });
    if (!adminUser) {
        adminUser = await User.create({
            name: "Boss / Owner",
            email: "admin@gskautomotive.com",
            password: "admin123",
            role: "super_admin",
            status: "active"
        });
    } else {
        adminUser.password = "admin123";
        adminUser.status = "active";
        await adminUser.save();
    }

    let managerUser = await User.findOne({ email: "mike.manager@gskautomotive.com" });
    if (!managerUser) {
        managerUser = await User.create({
            name: "Mike Manager",
            email: "mike.manager@gskautomotive.com",
            password: "password123",
            role: "admin",
            status: "active"
        });
    } else {
        managerUser.password = "password123";
        managerUser.status = "active";
        await managerUser.save();
    }

    let mechanicJohn = await User.findOne({ email: "john.mechanic@gskautomotive.com" });
    if (!mechanicJohn) {
        mechanicJohn = await User.create({
            name: "John Lead Mechanic",
            email: "john.mechanic@gskautomotive.com",
            password: "password123",
            role: "mechanic",
            status: "active"
        });
    } else {
        mechanicJohn.password = "password123";
        mechanicJohn.status = "active";
        await mechanicJohn.save();
    }

    let mechanicSarah = await User.findOne({ email: "sarah.service@gskautomotive.com" });
    if (!mechanicSarah) {
        mechanicSarah = await User.create({
            name: "Sarah Technician",
            email: "sarah.service@gskautomotive.com",
            password: "password123",
            role: "mechanic",
            status: "active"
        });
    } else {
        mechanicSarah.password = "password123";
        mechanicSarah.status = "active";
        await mechanicSarah.save();
    }

    console.log("[DemoSeeder] Creating Customers (Retail, Fleet & Imports)...");
    const [michael, sarahJ, david, emma, robertC, aussieFleet, sydneyCarHire, sakuraJdm, tokyoAuto] = await Customer.create([
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
            name: "Robert Chen",
            email: "robert.c@example.com.au",
            phone: "0408 555 444",
            address: "7 Windsor Rd, Baulkham Hills NSW 2153",
            customerType: "regular",
            totalVisits: 4,
            totalSpend: 1890
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
            name: "Tokyo Auto Trade Australia",
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
    const [hilux, camry, i30, ranger, cx5, bmw3, wrx, corollaFlt1, corollaFlt2, hiaceFlt, i30Syd, outlanderSyd] = await Vehicle.create([
        {
            customerId: michael._id,
            brand: "Toyota",
            model: "HiLux SR5 Dual Cab",
            year: 2021,
            registrationNumber: "NSW-8899",
            vin: "MR0HA3CD123456789",
            mileage: 62450,
            status: "Available"
        },
        {
            customerId: michael._id,
            brand: "Toyota",
            model: "Camry Ascent Hybrid",
            year: 2020,
            registrationNumber: "CAM-101",
            vin: "JTDBU123456789012",
            mileage: 48900,
            status: "Available"
        },
        {
            customerId: sarahJ._id,
            brand: "Hyundai",
            model: "i30 N-Line Hatch",
            year: 2022,
            registrationNumber: "HYU-332",
            vin: "KMHCT41CB12345678",
            mileage: 34100,
            status: "Maintenance"
        },
        {
            customerId: david._id,
            brand: "Ford",
            model: "Ranger Wildtrak 4x4",
            year: 2021,
            registrationNumber: "RNG-404",
            vin: "1FDRANGER00018899",
            mileage: 58200,
            status: "Available"
        },
        {
            customerId: emma._id,
            brand: "Mazda",
            model: "CX-5 Touring AWD",
            year: 2022,
            registrationNumber: "MZD-555",
            vin: "JM3KF4DY123456789",
            mileage: 26800,
            status: "Available"
        },
        {
            customerId: michael._id,
            brand: "BMW",
            model: "330i M Sport Sedan",
            year: 2019,
            registrationNumber: "BMW-330",
            vin: "WBA5R1C5123456789",
            mileage: 71500,
            status: "Maintenance"
        },
        {
            customerId: robertC._id,
            brand: "Subaru",
            model: "WRX STI Spec-R AWD",
            year: 2020,
            registrationNumber: "WRX-055",
            vin: "JF1VAFK0001234567",
            mileage: 42100,
            status: "Available"
        },
        {
            customerId: aussieFleet._id,
            brand: "Toyota",
            model: "Corolla Hybrid Sedan",
            year: 2023,
            registrationNumber: "FLT-101",
            vin: "JTDBR32E123456789",
            mileage: 21400,
            dailyRate: 55,
            status: "Maintenance"
        },
        {
            customerId: aussieFleet._id,
            brand: "Toyota",
            model: "Corolla Hybrid Sedan",
            year: 2023,
            registrationNumber: "FLT-102",
            vin: "JTDBR32E987654321",
            mileage: 28900,
            dailyRate: 55,
            status: "Rented"
        },
        {
            customerId: aussieFleet._id,
            brand: "Toyota",
            model: "HiAce Commuter Van",
            year: 2022,
            registrationNumber: "FLT-201",
            vin: "JTFFT11P000987654",
            mileage: 51200,
            dailyRate: 110,
            status: "Available"
        },
        {
            customerId: sydneyCarHire._id,
            brand: "Hyundai",
            model: "i30 Active Hatch",
            year: 2022,
            registrationNumber: "SYD-101",
            vin: "KMHCT51DB12345678",
            mileage: 39400,
            dailyRate: 48,
            status: "Maintenance"
        },
        {
            customerId: sydneyCarHire._id,
            brand: "Mitsubishi",
            model: "Outlander AWD ES 7-Seat",
            year: 2023,
            registrationNumber: "SYD-202",
            vin: "JMFXDGF0001234567",
            mileage: 18700,
            dailyRate: 75,
            status: "Available"
        }
    ]);

    console.log("[DemoSeeder] Creating Suppliers...");
    const [bosch, repco, castrol, bendix, ryco, ngk] = await Supplier.create([
        {
            name: "Bosch Automotive Australia",
            contactPerson: "Mark Anderson",
            email: "trade.orders@bosch.com.au",
            phone: "+61 2 9540 8800",
            address: "1553 Centre Rd, Clayton VIC 3168",
            status: "Active"
        },
        {
            name: "Repco Commercial Auto Parts",
            contactPerson: "David Miller",
            email: "sevenhills@repco.com.au",
            phone: "+61 2 8814 7700",
            address: "Unit 3, 20 Artisan Rd, Seven Hills NSW 2147",
            status: "Active"
        },
        {
            name: "Castrol Lubricants Australia",
            contactPerson: "Helen Brooks",
            email: "orders@castrol.com.au",
            phone: "+61 2 9795 3000",
            address: "132 McCredie Rd, Guildford NSW 2161",
            status: "Active"
        },
        {
            name: "Bendix Brakes Australia",
            contactPerson: "Craig Watson",
            email: "trade@bendix.com.au",
            phone: "+61 3 9308 0000",
            address: "Elizabeth St, Ballarat VIC 3350",
            status: "Active"
        },
        {
            name: "Ryco Filters Australia",
            contactPerson: "Rachel Scott",
            email: "commercial@rycofilters.com.au",
            phone: "+61 3 9243 3333",
            address: "296 Ferntree Gully Rd, Notting Hill VIC 3168",
            status: "Active"
        },
        {
            name: "NGK Spark Plugs Australia",
            contactPerson: "Darren Kelly",
            email: "sales@ngk.com.au",
            phone: "+61 3 8332 5000",
            address: "115 Dunmore Dr, Truganina VIC 3029",
            status: "Active"
        }
    ]);

    console.log("[DemoSeeder] Creating Hierarchical Inventory with Variants...");
    const [engineOilCastrol, rycoFilters, bendixBrakes, ngkSparkPlugs, batteryBosch, wiperBlades, penriteBrakeFluid, coolantRepco] = await Inventory.create([
        {
            itemName: "Castrol EDGE Premium Engine Oils",
            category: "Fluids",
            supplier: "Castrol Lubricants Australia",
            supplierId: castrol._id,
            variants: [
                {
                    name: "5W-30 Full Synthetic 5L",
                    sku: "CAS-5W30-5L",
                    quantity: 42,
                    minStockLevel: 10,
                    unitPrice: 65.00,
                    level: 1,
                    isActive: true,
                    supplierId: castrol._id
                },
                {
                    name: "10W-40 Synthetic Blend 5L",
                    sku: "CAS-10W40-5L",
                    quantity: 28,
                    minStockLevel: 8,
                    unitPrice: 52.00,
                    level: 1,
                    isActive: true,
                    supplierId: castrol._id
                },
                {
                    name: "0W-20 Ultra Clean Hybrid 5L",
                    sku: "CAS-0W20-5L",
                    quantity: 18,
                    minStockLevel: 6,
                    unitPrice: 72.00,
                    level: 1,
                    isActive: true,
                    supplierId: castrol._id
                }
            ]
        },
        {
            itemName: "Ryco High-Efficiency Filters",
            category: "Filters",
            supplier: "Ryco Filters Australia",
            supplierId: ryco._id,
            variants: [
                {
                    name: "Z418 Oil Filter (Toyota / Lexus 4-Cyl & V6)",
                    sku: "RYC-Z418",
                    quantity: 34,
                    minStockLevel: 10,
                    unitPrice: 22.50,
                    level: 1,
                    isActive: true,
                    supplierId: ryco._id
                },
                {
                    name: "Z516 Oil Filter (Ford Ranger 3.2L / Everest)",
                    sku: "RYC-Z516",
                    quantity: 25,
                    minStockLevel: 8,
                    unitPrice: 26.00,
                    level: 1,
                    isActive: true,
                    supplierId: ryco._id
                },
                {
                    name: "Z79A Oil Filter (Subaru Boxer Engines)",
                    sku: "RYC-Z79A",
                    quantity: 15,
                    minStockLevel: 5,
                    unitPrice: 24.00,
                    level: 1,
                    isActive: true,
                    supplierId: ryco._id
                }
            ]
        },
        {
            itemName: "Bendix Ultimate+ Brake Pad Sets",
            category: "Parts",
            supplier: "Bendix Brakes Australia",
            supplierId: bendix._id,
            variants: [
                {
                    name: "Front Ceramic Set DB1774 (Toyota HiLux / Prado)",
                    sku: "BDX-DB1774",
                    quantity: 2, // Low stock triggers warning!
                    minStockLevel: 8,
                    unitPrice: 135.00,
                    level: 1,
                    isActive: true,
                    supplierId: bendix._id
                },
                {
                    name: "Rear Heavy Duty Set DB1832 (Ford Ranger / Everest)",
                    sku: "BDX-DB1832",
                    quantity: 3, // Low stock triggers warning!
                    minStockLevel: 6,
                    unitPrice: 120.00,
                    level: 1,
                    isActive: true,
                    supplierId: bendix._id
                },
                {
                    name: "Front Performance Set DB2210 (Hyundai i30 N / Elantra)",
                    sku: "BDX-DB2210",
                    quantity: 9,
                    minStockLevel: 4,
                    unitPrice: 165.00,
                    level: 1,
                    isActive: true,
                    supplierId: bendix._id
                }
            ]
        },
        {
            itemName: "NGK Laser Iridium Spark Plugs (4-Pack)",
            category: "Parts",
            supplier: "NGK Spark Plugs Australia",
            supplierId: ngk._id,
            variants: [
                {
                    name: "ILKAR7C10 Laser Iridium (Toyota / Subaru)",
                    sku: "NGK-ILKAR7",
                    quantity: 16,
                    minStockLevel: 6,
                    unitPrice: 88.00,
                    level: 1,
                    isActive: true,
                    supplierId: ngk._id
                },
                {
                    name: "SILZKR7B11 Laser Iridium (Hyundai / Kia GDI)",
                    sku: "NGK-SILZKR",
                    quantity: 12,
                    minStockLevel: 4,
                    unitPrice: 95.00,
                    level: 1,
                    isActive: true,
                    supplierId: ngk._id
                }
            ]
        },
        {
            itemName: "Bosch High Performance AGM Batteries",
            category: "Batteries",
            supplier: "Bosch Automotive Australia",
            supplierId: bosch._id,
            variants: [
                {
                    name: "S5 A08 AGM 12V 70Ah 760CCA",
                    sku: "BOS-S5A08",
                    quantity: 7,
                    minStockLevel: 3,
                    unitPrice: 265.00,
                    level: 1,
                    isActive: true,
                    supplierId: bosch._id
                },
                {
                    name: "S4 024 Lead-Acid 12V 60Ah 540CCA",
                    sku: "BOS-S4024",
                    quantity: 11,
                    minStockLevel: 4,
                    unitPrice: 185.00,
                    level: 1,
                    isActive: true,
                    supplierId: bosch._id
                }
            ]
        },
        {
            itemName: "Bosch Aerotwin Wiper Blade Pairs",
            category: "Accessories",
            supplier: "Bosch Automotive Australia",
            supplierId: bosch._id,
            variants: [
                {
                    name: "A979S Set (24\" and 19\" Dual Pack)",
                    sku: "BOS-A979S",
                    quantity: 24,
                    minStockLevel: 8,
                    unitPrice: 42.00,
                    level: 1,
                    isActive: true,
                    supplierId: bosch._id
                },
                {
                    name: "A863S Set (26\" and 18\" Dual Pack)",
                    sku: "BOS-A863S",
                    quantity: 30,
                    minStockLevel: 8,
                    unitPrice: 45.00,
                    level: 1,
                    isActive: true,
                    supplierId: bosch._id
                }
            ]
        },
        {
            itemName: "Penrite Super Dot 4 Brake Fluid (500ml)",
            category: "Fluids",
            supplier: "Repco Commercial Auto Parts",
            supplierId: repco._id,
            variants: [
                {
                    name: "Super Dot 4 High Boiling Point 500ml",
                    sku: "PEN-DOT4-500",
                    quantity: 38,
                    minStockLevel: 10,
                    unitPrice: 18.50,
                    level: 1,
                    isActive: true,
                    supplierId: repco._id
                }
            ]
        },
        {
            itemName: "Repco Heavy Duty Coolant 50/50 Premix (5L)",
            category: "Fluids",
            supplier: "Repco Commercial Auto Parts",
            supplierId: repco._id,
            variants: [
                {
                    name: "Long Life Red OAT 5L Premix",
                    sku: "REP-COOL-RED5",
                    quantity: 20,
                    minStockLevel: 6,
                    unitPrice: 36.00,
                    level: 1,
                    isActive: true,
                    supplierId: repco._id
                },
                {
                    name: "Universal Long Life Green 5L Premix",
                    sku: "REP-COOL-GRN5",
                    quantity: 16,
                    minStockLevel: 6,
                    unitPrice: 34.00,
                    level: 1,
                    isActive: true,
                    supplierId: repco._id
                }
            ]
        }
    ]);

    console.log("[DemoSeeder] Creating Vehicle Batches for Import Trackers & Rental Fleets...");
    const batchSakura = await VehicleBatch.create({
        batchNumber: "IMP-2026-001",
        customerId: sakuraJdm._id,
        type: "IMPORT",
        status: "IN PROGRESS",
        expectedVehicleCount: 2,
        notes: "JDM luxury people mover shipment arriving Port Botany"
    });

    const [sakuraAlphardMember, sakuraElgrandMember] = await VehicleBatchMembership.create([
        {
            batchId: batchSakura._id,
            referenceNumber: "IMP-001-01",
            registrationNumber: "JDM-888",
            make: "Toyota",
            model: "Alphard Executive Lounge 3.5L",
            year: 2018,
            vin: "AGH30-0198273",
            serviceType: "ADR Compliance & Blue Slip",
            status: "In Compliance",
            complianceStatus: "In Progress",
            keysReceived: true,
            fuelLevel: "3/4",
            odometer: 48200,
            notes: "Child seat anchor points installed. Headlight beam alignment complete.",
            addedAt: new Date(Date.now() - 4 * 86400000),
            receivedAt: new Date(Date.now() - 2 * 86400000),
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 2 * 86400000) },
                { status: "In Compliance", timestamp: new Date() }
            ]
        },
        {
            batchId: batchSakura._id,
            referenceNumber: "IMP-001-02",
            registrationNumber: "JDM-999",
            make: "Nissan",
            model: "Elgrand Highway Star Premium 3.5L",
            year: 2017,
            vin: "PE52-0876123",
            serviceType: "ADR Compliance & Blue Slip",
            status: "Received",
            complianceStatus: "Not Started",
            keysReceived: true,
            fuelLevel: "Full",
            odometer: 62100,
            notes: "Port clearance complete. Booked for compliance hoist Thursday.",
            addedAt: new Date(Date.now() - 4 * 86400000),
            receivedAt: new Date(Date.now() - 1 * 86400000),
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 1 * 86400000) }
            ]
        }
    ]);

    const batchTokyo = await VehicleBatch.create({
        batchNumber: "IMP-2026-002",
        customerId: tokyoAuto._id,
        type: "IMPORT",
        status: "COMPLETED",
        expectedVehicleCount: 2,
        notes: "Performance & Hybrid JDM batch"
    });

    await VehicleBatchMembership.create([
        {
            batchId: batchTokyo._id,
            referenceNumber: "IMP-002-01",
            registrationNumber: "STI-019",
            make: "Subaru",
            model: "Levorg STI Sport 2.0 Turbo",
            year: 2019,
            vin: "VM4-0543210",
            serviceType: "ADR Compliance & Blue Slip",
            status: "Completed",
            complianceStatus: "Completed",
            blueSlip: "BLU-88741",
            keysReceived: true,
            fuelLevel: "Half",
            odometer: 39500,
            finalOdometer: 39520,
            notes: "NSW Blue slip inspection passed and certificate issued.",
            addedAt: new Date(Date.now() - 12 * 86400000),
            receivedAt: new Date(Date.now() - 10 * 86400000),
            readyForCollectionAt: new Date(Date.now() - 2 * 86400000),
            collectedAt: new Date(Date.now() - 1 * 86400000),
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 10 * 86400000) },
                { status: "Compliance", timestamp: new Date(Date.now() - 6 * 86400000) },
                { status: "Completed", timestamp: new Date(Date.now() - 2 * 86400000) }
            ]
        },
        {
            batchId: batchTokyo._id,
            referenceNumber: "IMP-002-02",
            registrationNumber: "CRN-210",
            make: "Toyota",
            model: "Crown Athlete Hybrid 2.5",
            year: 2018,
            vin: "AWS210-908172",
            serviceType: "ADR Compliance & Blue Slip",
            status: "Completed",
            complianceStatus: "Completed",
            blueSlip: "BLU-88742",
            keysReceived: true,
            fuelLevel: "3/4",
            odometer: 51200,
            finalOdometer: 51215,
            notes: "Full Australian compliance certificate verified and affixed.",
            addedAt: new Date(Date.now() - 12 * 86400000),
            receivedAt: new Date(Date.now() - 10 * 86400000),
            readyForCollectionAt: new Date(Date.now() - 2 * 86400000),
            collectedAt: new Date(Date.now() - 1 * 86400000),
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 10 * 86400000) },
                { status: "Compliance", timestamp: new Date(Date.now() - 5 * 86400000) },
                { status: "Completed", timestamp: new Date(Date.now() - 2 * 86400000) }
            ]
        }
    ]);

    const batchAussieRentals = await VehicleBatch.create({
        batchNumber: "FLT-2026-001",
        customerId: aussieFleet._id,
        type: "RENTAL",
        status: "ACTIVE",
        expectedVehicleCount: 2,
        notes: "Monthly scheduled rental fleet servicing batch"
    });

    const [aussieCorollaMember1, aussieCorollaMember2] = await VehicleBatchMembership.create([
        {
            batchId: batchAussieRentals._id,
            vehicleId: corollaFlt1._id,
            referenceNumber: "FLT-001-01",
            registrationNumber: corollaFlt1.registrationNumber,
            make: corollaFlt1.brand,
            model: corollaFlt1.model,
            year: corollaFlt1.year,
            vin: corollaFlt1.vin,
            serviceType: "Fleet Scheduled Maintenance",
            status: "Completed",
            keysReceived: true,
            fuelLevel: "Full",
            odometer: 21400,
            finalOdometer: 21405,
            notes: "Fleet vehicle scheduled service complete."
        },
        {
            batchId: batchAussieRentals._id,
            vehicleId: corollaFlt2._id,
            referenceNumber: "FLT-001-02",
            registrationNumber: corollaFlt2.registrationNumber,
            make: corollaFlt2.brand,
            model: corollaFlt2.model,
            year: corollaFlt2.year,
            vin: corollaFlt2.vin,
            serviceType: "Fleet Scheduled Maintenance",
            status: "In Service",
            keysReceived: true,
            fuelLevel: "3/4",
            odometer: 28900
        }
    ]);

    const batchSydneyRentals = await VehicleBatch.create({
        batchNumber: "FLT-2026-002",
        customerId: sydneyCarHire._id,
        type: "RENTAL",
        status: "ACTIVE",
        expectedVehicleCount: 1,
        notes: "Airport fleet service overhaul agreement"
    });

    const [sydneyMember1] = await VehicleBatchMembership.create([
        {
            batchId: batchSydneyRentals._id,
            vehicleId: i30Syd._id,
            referenceNumber: "FLT-002-01",
            registrationNumber: i30Syd.registrationNumber,
            make: i30Syd.brand,
            model: i30Syd.model,
            year: i30Syd.year,
            vin: i30Syd.vin,
            serviceType: "Fleet Overhaul",
            status: "In Service",
            keysReceived: true,
            fuelLevel: "Full",
            odometer: 39400
        }
    ]);

    console.log("[DemoSeeder] Creating Purchase Orders...");
    const oilVariant5W30 = engineOilCastrol.variants[0];
    const batteryVariantAGM = batteryBosch.variants[0];
    const brakePadVariantToyota = bendixBrakes.variants[0];
    const rycoFilterVariantToyota = rycoFilters.variants[0];

    await PurchaseOrder.create([
        {
            purchaseOrderNumber: "PO-1001",
            supplierId: castrol._id,
            createdBy: adminUser._id,
            status: "Received",
            subtotal: 1520.00,
            totalAmount: 1520.00,
            items: [{
                inventoryId: engineOilCastrol._id,
                variantId: oilVariant5W30._id,
                productName: engineOilCastrol.itemName,
                variantName: oilVariant5W30.name,
                hierarchyPath: `${engineOilCastrol.itemName} > ${oilVariant5W30.name}`,
                sku: oilVariant5W30.sku,
                quantityOrdered: 40,
                quantityReceived: 40,
                unitPurchasePrice: 38.00
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
                variantId: batteryVariantAGM._id,
                productName: batteryBosch.itemName,
                variantName: batteryVariantAGM.name,
                hierarchyPath: `${batteryBosch.itemName} > ${batteryVariantAGM.name}`,
                sku: batteryVariantAGM.sku,
                quantityOrdered: 10,
                quantityReceived: 10,
                unitPurchasePrice: 145.00
            }],
            receivedAt: new Date(Date.now() - 2 * 86400000)
        },
        {
            purchaseOrderNumber: "PO-1003",
            supplierId: bendix._id,
            createdBy: adminUser._id,
            status: "Ordered",
            subtotal: 816.00,
            totalAmount: 816.00,
            items: [{
                inventoryId: bendixBrakes._id,
                variantId: brakePadVariantToyota._id,
                productName: bendixBrakes.itemName,
                variantName: brakePadVariantToyota.name,
                hierarchyPath: `${bendixBrakes.itemName} > ${brakePadVariantToyota.name}`,
                sku: brakePadVariantToyota.sku,
                quantityOrdered: 12,
                quantityReceived: 0,
                unitPurchasePrice: 68.00
            }]
        },
        {
            purchaseOrderNumber: "PO-1004",
            supplierId: ryco._id,
            createdBy: managerUser._id,
            status: "Received",
            subtotal: 360.00,
            totalAmount: 360.00,
            items: [{
                inventoryId: rycoFilters._id,
                variantId: rycoFilterVariantToyota._id,
                productName: rycoFilters.itemName,
                variantName: rycoFilterVariantToyota.name,
                hierarchyPath: `${rycoFilters.itemName} > ${rycoFilterVariantToyota.name}`,
                sku: rycoFilterVariantToyota.sku,
                quantityOrdered: 30,
                quantityReceived: 30,
                unitPurchasePrice: 12.00
            }],
            receivedAt: new Date(Date.now() - 8 * 86400000)
        }
    ]);

    console.log("[DemoSeeder] Creating Job Cards (Retail, Fleet, and Imports)...");
    const [jobHiLux, jobI30, jobRanger, jobBMW, jobCX5, jobFltCorolla, jobSydI30, jobSakuraAlphard] = await JobCard.create([
        {
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
                { inventoryId: engineOilCastrol._id, variantId: oilVariant5W30._id, variantName: oilVariant5W30.name, quantity: 1, unitPrice: 65.00 },
                { inventoryId: rycoFilters._id, variantId: rycoFilterVariantToyota._id, variantName: rycoFilterVariantToyota.name, quantity: 1, unitPrice: 22.50 }
            ],
            needsAttention: ["Front brake pads wearing thin (30% remaining)"],
            repairsOrdered: "Routine 60,000km scheduled maintenance. Replace all engine filters and fluids.",
            labourHours: 2.5,
            hourlyRate: 120,
            charges: { lubricantsOil: 65, miscellaneous: 15, differentialOil: 0, transmission: 0, brakeFluid: 25 },
            status: "Completed",
            financialsFinalized: true,
            finalizedBy: adminUser._id,
            finalizedAt: new Date(Date.now() - 3 * 86400000),
            finalAmount: 437.25,
            completedAt: new Date(Date.now() - 3 * 86400000),
            completedBy: mechanicJohn._id,
            notes: "Vehicle runs perfectly. Customer advised on front brake pad replacement next service.",
            createdAt: new Date(Date.now() - 3 * 86400000)
        },
        {
            customerId: sarahJ._id,
            vehicleId: i30._id,
            technicianId: mechanicSarah._id,
            mechanic: "Sarah Technician",
            servicesOrdered: ["Front Brake Inspection", "Brake Rotor Machining"],
            servicesProvided: [
                { name: "Brake Overhaul Labor", cost: 180, quantity: 1.5, total: 180 }
            ],
            partsUsed: [
                { inventoryId: bendixBrakes._id, variantId: bendixBrakes.variants[2]._id, variantName: bendixBrakes.variants[2].name, quantity: 1, unitPrice: 165.00 }
            ],
            needsAttention: ["Slight brake vibration under heavy braking"],
            repairsOrdered: "Customer complains of grinding noise when braking from speed. Inspect and replace pads.",
            labourHours: 1.5,
            hourlyRate: 120,
            charges: { lubricantsOil: 0, miscellaneous: 10, differentialOil: 0, transmission: 0, brakeFluid: 20 },
            status: "In Progress",
            notes: "Rotors inspected. Machining and pad replacement in progress.",
            createdAt: new Date(Date.now() - 1 * 86400000)
        },
        {
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
            charges: { lubricantsOil: 0, miscellaneous: 20, differentialOil: 0, transmission: 0, brakeFluid: 0 },
            status: "Completed",
            financialsFinalized: true,
            finalizedBy: adminUser._id,
            finalizedAt: new Date(Date.now() - 2 * 86400000),
            finalAmount: 324.50,
            completedAt: new Date(Date.now() - 2 * 86400000),
            completedBy: mechanicJohn._id,
            notes: "4WD safety check completed. Front alignment tuned to factory spec.",
            createdAt: new Date(Date.now() - 2 * 86400000)
        },
        {
            customerId: michael._id,
            vehicleId: bmw3._id,
            technicianId: mechanicJohn._id,
            mechanic: "John Lead Mechanic",
            servicesOrdered: ["Check Engine Diagnostics", "Ignition Coil & Spark Plugs"],
            servicesProvided: [
                { name: "OBD2 Full Diagnostics Scan", cost: 120, quantity: 1, total: 120 }
            ],
            partsUsed: [
                { inventoryId: ngkSparkPlugs._id, variantId: ngkSparkPlugs.variants[0]._id, variantName: ngkSparkPlugs.variants[0].name, quantity: 1, unitPrice: 88.00 }
            ],
            needsAttention: ["Cylinder 2 intermittent misfire code P0302"],
            repairsOrdered: "Check engine light illuminated. Engine runs rough at idle.",
            labourHours: 1.0,
            hourlyRate: 120,
            status: "Waiting For Parts",
            notes: "OEM ignition coils on backorder from Bosch Melbourne warehouse. ETA tomorrow afternoon.",
            createdAt: new Date(Date.now() - 1 * 86400000)
        },
        {
            customerId: emma._id,
            vehicleId: cx5._id,
            technicianId: mechanicSarah._id,
            mechanic: "Sarah Technician",
            servicesOrdered: ["Scheduled 30,000km Maintenance", "Tyre Rotation"],
            servicesProvided: [
                { name: "Routine Service Labor", cost: 180, quantity: 1.5, total: 180 }
            ],
            partsUsed: [],
            needsAttention: [],
            repairsOrdered: "Regular minor service and tyre pressure check.",
            labourHours: 1.5,
            hourlyRate: 120,
            status: "Open",
            notes: "Customer dropped off keys this morning. Awaiting hoist 2 opening.",
            createdAt: new Date(Date.now() - 4 * 3600000)
        },
        {
            customerId: aussieFleet._id,
            vehicleId: corollaFlt1._id,
            technicianId: mechanicJohn._id,
            mechanic: "John Lead Mechanic",
            servicesOrdered: ["Fleet Vehicle Scheduled Servicing", "Brake Fluid Flush", "Wiper Blade Replacement"],
            servicesProvided: [
                { name: "Commercial Fleet Labor", cost: 640, quantity: 1, total: 640 },
                { name: "Brake Fluid Flush Labor", cost: 90, quantity: 1, total: 90 }
            ],
            partsUsed: [
                { inventoryId: wiperBlades._id, variantId: wiperBlades.variants[0]._id, variantName: wiperBlades.variants[0].name, quantity: 2, unitPrice: 42.00 }
            ],
            needsAttention: [],
            repairsOrdered: "Contracted 30,000km fleet turnaround service.",
            labourHours: 3.0,
            hourlyRate: 120,
            charges: { lubricantsOil: 80, miscellaneous: 20, differentialOil: 0, transmission: 0, brakeFluid: 25 },
            status: "Completed",
            financialsFinalized: true,
            finalizedBy: adminUser._id,
            finalizedAt: new Date(Date.now() - 4 * 86400000),
            finalAmount: 913.00,
            completedAt: new Date(Date.now() - 4 * 86400000),
            completedBy: mechanicJohn._id,
            notes: "Fleet vehicle serviced and cleaned. Ready for rental dispatch.",
            createdAt: new Date(Date.now() - 5 * 86400000)
        },
        {
            customerId: sydneyCarHire._id,
            vehicleId: i30Syd._id,
            technicianId: mechanicSarah._id,
            mechanic: "Sarah Technician",
            servicesOrdered: ["Fleet Return Roadworthy Check", "Front Brake Pad Replacement"],
            servicesProvided: [
                { name: "Safety Inspection", cost: 60, quantity: 1, total: 60 }
            ],
            partsUsed: [],
            needsAttention: ["Front pads down to 2mm. Requires replacement."],
            repairsOrdered: "Incoming rental inspection prior to Sydney airport redeployment.",
            labourHours: 1.0,
            hourlyRate: 120,
            status: "In Progress",
            notes: "Inspection complete. Fitting replacement brake pads.",
            createdAt: new Date(Date.now() - 10 * 3600000)
        },
        {
            customerId: sakuraJdm._id,
            vehicleId: hilux._id,
            trackerId: batchSakura._id,
            trackerCarId: sakuraAlphardMember._id,
            technicianId: mechanicJohn._id,
            mechanic: "John Lead Mechanic",
            servicesOrdered: ["ADR Compliance Pre-Inspection", "Blue Slip Inspection"],
            servicesProvided: [
                { name: "Compliance Engineering Inspection", cost: 350, quantity: 1, total: 350 }
            ],
            partsUsed: [],
            needsAttention: [],
            repairsOrdered: "JDM import compliance inspection for Toyota Alphard AGH30.",
            labourHours: 2.0,
            hourlyRate: 120,
            status: "Open",
            notes: "Inspecting child seat anchorages and Australian compliance labels.",
            createdAt: new Date(Date.now() - 6 * 3600000)
        }
    ]);

    console.log("[DemoSeeder] Creating Invoices (Active, Archived >2Y, Cancelled/Voided, Draft Review, 5Y Retention)...");
    const twoAndHalfYearsAgo = new Date(Date.now() - 850 * 86400000);
    const twoYearsTwoMonthsAgo = new Date(Date.now() - 790 * 86400000);
    const fiveAndHalfYearsAgo = new Date(Date.now() - 5.5 * 365 * 86400000);
    const oneHundredTenDaysAgo = new Date(Date.now() - 110 * 86400000);

    const [inv1, inv2, inv3, inv4, inv5, inv6, invArchived1, invArchived2, invCancelled, invVoided, invDraft, inv5YReview] = await Invoice.create([
        // 1. ACTIVE PAID (INV-1001)
        {
            invoiceNo: "INV-1001",
            type: "Service Invoice",
            customerId: michael._id,
            vehicleId: hilux._id,
            jobCardId: jobHiLux._id,
            mechanic: "John Lead Mechanic",
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
                { description: "Castrol EDGE 5W-30 Full Synthetic Oil 5L", qty: 1, price: 65.00 },
                { description: "Ryco Z418 Oil Filter", qty: 1, price: 22.50 },
                { description: "Workshop Consumables & Environmental Fluid Disposal", qty: 1, price: 15.00 }
            ],
            subtotal: 397.50,
            gstAmount: 39.75,
            totalAmount: 437.25,
            amountPaid: 437.25,
            balanceDue: 0,
            paidAt: new Date(Date.now() - 3 * 86400000)
        },
        // 2. ACTIVE PAID (INV-1002 - Rental Fleet with trackerId & trackerCarId)
        {
            invoiceNo: "INV-1002",
            type: "Rental Invoice",
            customerId: aussieFleet._id,
            trackerId: batchAussieRentals._id,
            trackerCarId: aussieCorollaMember1._id,
            jobCardId: jobFltCorolla._id,
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
            vehicleSnapshot: {
                registrationNumber: corollaFlt1.registrationNumber,
                brand: corollaFlt1.brand,
                model: corollaFlt1.model,
                year: String(corollaFlt1.year),
                vin: corollaFlt1.vin
            },
            partsAndLabour: [
                { description: "Commercial Fleet Scheduled Servicing (Corolla FLT-101)", qty: 1, price: 320.00 },
                { description: "Commercial Fleet Scheduled Servicing (Corolla FLT-102)", qty: 1, price: 320.00 },
                { description: "Bosch Aerotwin Front Wiper Blade Replacement", qty: 2, price: 42.00 },
                { description: "Brake Fluid Flush & Bleed", qty: 1, price: 106.00 }
            ],
            subtotal: 830.00,
            gstAmount: 83.00,
            totalAmount: 913.00,
            amountPaid: 913.00,
            balanceDue: 0,
            paidAt: new Date(Date.now() - 4 * 86400000)
        },
        // 3. ACTIVE UNPAID (INV-1003)
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
            vehicleSnapshot: {
                registrationNumber: i30.registrationNumber,
                brand: i30.brand,
                model: i30.model,
                year: String(i30.year),
                vin: i30.vin
            },
            partsAndLabour: [
                { description: "Brake System Overhaul Labor", qty: 1.5, price: 120.00 },
                { description: "Bendix Performance Front Brake Pads Set", qty: 1, price: 165.00 },
                { description: "Front Brake Disc Rotor Machining (Pair)", qty: 1, price: 50.00 }
            ],
            subtotal: 395.00,
            gstAmount: 39.50,
            totalAmount: 434.50,
            amountPaid: 0,
            balanceDue: 434.50
        },
        // 4. ACTIVE PARTIALLY PAID (INV-1004)
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
            vehicleSnapshot: {
                registrationNumber: ranger.registrationNumber,
                brand: ranger.brand,
                model: ranger.model,
                year: String(ranger.year),
                vin: ranger.vin
            },
            partsAndLabour: [
                { description: "4WD 20-Point Off-Road Safety Inspection", qty: 1, price: 150.00 },
                { description: "4-Wheel Computer Laser Wheel Alignment", qty: 1, price: 110.00 },
                { description: "Castrol High-Temperature Wheel Bearing Grease", qty: 1, price: 35.00 }
            ],
            subtotal: 295.00,
            gstAmount: 29.50,
            totalAmount: 324.50,
            amountPaid: 150.00,
            balanceDue: 174.50
        },
        // 5. ACTIVE UNPAID (INV-1005 - Import Company)
        {
            invoiceNo: "INV-1005",
            type: "General Invoice",
            customerId: tokyoAuto._id,
            status: "Unpaid",
            invoiceDate: new Date(Date.now() - 5 * 86400000),
            issuedAt: new Date(Date.now() - 5 * 86400000),
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
        },
        // 6. ACTIVE PAID (INV-1006)
        {
            invoiceNo: "INV-1006",
            type: "Service Invoice",
            customerId: robertC._id,
            vehicleId: wrx._id,
            status: "Paid",
            invoiceDate: new Date(Date.now() - 1 * 86400000),
            issuedAt: new Date(Date.now() - 1 * 86400000),
            customerSnapshot: {
                name: robertC.name,
                email: robertC.email,
                phone: robertC.phone,
                address: robertC.address,
                customerType: "regular"
            },
            vehicleSnapshot: {
                registrationNumber: wrx.registrationNumber,
                brand: wrx.brand,
                model: wrx.model,
                year: String(wrx.year),
                vin: wrx.vin
            },
            partsAndLabour: [
                { description: "Subaru WRX STI Performance Logbook Service", qty: 2.5, price: 120.00 },
                { description: "Castrol EDGE 10W-40 Synthetic Blend 5L", qty: 1, price: 52.00 },
                { description: "Ryco Z79A Boxer Engine Oil Filter", qty: 1, price: 24.00 },
                { description: "Penrite Super Dot 4 Brake Fluid Flush", qty: 1, price: 114.91 }
            ],
            subtotal: 490.91,
            gstAmount: 49.09,
            totalAmount: 540.00,
            amountPaid: 540.00,
            balanceDue: 0,
            paidAt: new Date(Date.now() - 1 * 86400000)
        },
        // 7. ARCHIVED (>2Y) (INV-0842)
        {
            invoiceNo: "INV-0842",
            type: "Service Invoice",
            customerId: michael._id,
            vehicleId: hilux._id,
            status: "Paid",
            invoiceDate: twoAndHalfYearsAgo,
            issuedAt: twoAndHalfYearsAgo,
            isArchived: true,
            archiveStatus: 'archived',
            archivedAt: new Date(Date.now() - 180 * 86400000),
            archivedBy: adminUser._id,
            archiveReason: 'Automated 2-Year Statutory Archival Policy for completed accounts',
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
                { description: "Toyota HiLux 40,000km Major Service", qty: 3, price: 120.00 },
                { description: "Castrol Synthetic Oil & Complete Filter Pack", qty: 1, price: 145.00 },
                { description: "NSW Pink Slip Roadworthy Inspection", qty: 1, price: 45.00 },
                { description: "Coolant Flush & Replacement", qty: 1, price: 163.64 }
            ],
            subtotal: 713.64,
            gstAmount: 71.36,
            totalAmount: 785.00,
            amountPaid: 785.00,
            balanceDue: 0,
            paidAt: twoAndHalfYearsAgo
        },
        // 8. ARCHIVED (>2Y) (INV-0879 - Rental Fleet)
        {
            invoiceNo: "INV-0879",
            type: "Rental Invoice",
            customerId: aussieFleet._id,
            trackerId: batchAussieRentals._id,
            trackerCarId: aussieCorollaMember2._id,
            status: "Paid",
            invoiceDate: twoYearsTwoMonthsAgo,
            issuedAt: twoYearsTwoMonthsAgo,
            isArchived: true,
            archiveStatus: 'archived',
            archivedAt: new Date(Date.now() - 150 * 86400000),
            archivedBy: adminUser._id,
            archiveReason: 'Automated 2-Year Statutory Archival Policy for completed accounts',
            customerSnapshot: {
                name: aussieFleet.name,
                email: aussieFleet.email,
                phone: aussieFleet.phone,
                address: aussieFleet.address,
                customerType: "rental_company"
            },
            vehicleSnapshot: {
                registrationNumber: corollaFlt2.registrationNumber,
                brand: corollaFlt2.brand,
                model: corollaFlt2.model,
                year: String(corollaFlt2.year),
                vin: corollaFlt2.vin
            },
            partsAndLabour: [
                { description: "Monthly Fleet Fleet Routine Servicing Batch (4 Vehicles)", qty: 4, price: 250.00 },
                { description: "Bendix Commercial Brake Pad Replacements", qty: 2, price: 63.64 }
            ],
            subtotal: 1127.28,
            gstAmount: 112.72,
            totalAmount: 1240.00,
            amountPaid: 1240.00,
            balanceDue: 0,
            paidAt: twoYearsTwoMonthsAgo
        },
        // 9. CANCELLED INVOICE (INV-0992)
        {
            invoiceNo: "INV-0992",
            type: "Service Invoice",
            customerId: emma._id,
            vehicleId: cx5._id,
            status: "Cancelled",
            invoiceDate: new Date(Date.now() - 14 * 86400000),
            issuedAt: new Date(Date.now() - 14 * 86400000),
            customerSnapshot: {
                name: emma.name,
                email: emma.email,
                phone: emma.phone,
                address: emma.address,
                customerType: "regular"
            },
            vehicleSnapshot: {
                registrationNumber: cx5.registrationNumber,
                brand: cx5.brand,
                model: cx5.model,
                year: String(cx5.year),
                vin: cx5.vin
            },
            cancellationDetails: {
                cancelledAt: new Date(Date.now() - 7 * 86400000),
                cancelledBy: adminUser._id,
                cancelledByName: "Boss / Owner",
                reason: "Customer postponed transmission overhaul due to sudden interstate travel",
                actionType: "Cancelled",
                originalStatus: "Unpaid",
                originalTotalAmount: 480.00
            },
            partsAndLabour: [
                { description: "Mazda SkyActiv Transmission Fluid Service", qty: 2, price: 120.00 },
                { description: "Full Synthetic Transmission Fluid 4L", qty: 1, price: 196.36 }
            ],
            subtotal: 436.36,
            gstAmount: 43.64,
            totalAmount: 480.00,
            amountPaid: 0,
            balanceDue: 480.00
        },
        // 10. VOIDED INVOICE (INV-0998)
        {
            invoiceNo: "INV-0998",
            type: "Service Invoice",
            customerId: david._id,
            vehicleId: ranger._id,
            status: "Voided",
            invoiceDate: new Date(Date.now() - 20 * 86400000),
            issuedAt: new Date(Date.now() - 20 * 86400000),
            customerSnapshot: {
                name: david.name,
                email: david.email,
                phone: david.phone,
                address: david.address,
                customerType: "regular"
            },
            vehicleSnapshot: {
                registrationNumber: ranger.registrationNumber,
                brand: ranger.brand,
                model: ranger.model,
                year: String(ranger.year),
                vin: ranger.vin
            },
            cancellationDetails: {
                cancelledAt: new Date(Date.now() - 12 * 86400000),
                cancelledBy: adminUser._id,
                cancelledByName: "Boss / Owner",
                reason: "Duplicate draft generated in error; superseded by final invoice INV-1004",
                actionType: "Voided",
                originalStatus: "Draft",
                originalTotalAmount: 350.00
            },
            partsAndLabour: [
                { description: "Suspension Assessment Draft Entry", qty: 1, price: 318.18 }
            ],
            subtotal: 318.18,
            gstAmount: 31.82,
            totalAmount: 350.00,
            amountPaid: 0,
            balanceDue: 350.00
        },
        // 11. DRAFT REVIEW (>90 DAYS INACTIVITY) (INV-0980)
        {
            invoiceNo: "INV-0980",
            type: "Service Invoice",
            customerId: sarahJ._id,
            vehicleId: i30._id,
            status: "Draft",
            invoiceDate: oneHundredTenDaysAgo,
            issuedAt: null,
            customerSnapshot: {
                name: sarahJ.name,
                email: sarahJ.email,
                phone: sarahJ.phone,
                address: sarahJ.address,
                customerType: "regular"
            },
            vehicleSnapshot: {
                registrationNumber: i30.registrationNumber,
                brand: i30.brand,
                model: i30.model,
                year: String(i30.year),
                vin: i30.vin
            },
            partsAndLabour: [
                { description: "Air Conditioning Evaporator Core Inspection Estimate", qty: 1.5, price: 120.00 },
                { description: "AC System Vacuum & Dye Leak Detection", qty: 1, price: 83.64 }
            ],
            subtotal: 263.64,
            gstAmount: 26.36,
            totalAmount: 290.00,
            amountPaid: 0,
            balanceDue: 290.00,
            notes: "Preliminary draft estimate. Customer requested quote before summer heat.",
            createdAt: oneHundredTenDaysAgo,
            updatedAt: new Date(Date.now() - 105 * 86400000)
        },
        // 12. 5-YEAR RETENTION REVIEW / LEGAL HOLD (INV-0512)
        {
            invoiceNo: "INV-0512",
            type: "Rental Invoice",
            customerId: sydneyCarHire._id,
            trackerId: batchSydneyRentals._id,
            trackerCarId: sydneyMember1._id,
            status: "Paid",
            invoiceDate: fiveAndHalfYearsAgo,
            issuedAt: fiveAndHalfYearsAgo,
            isArchived: true,
            archiveStatus: 'archived',
            archivedAt: new Date(Date.now() - 3 * 365 * 86400000),
            customerSnapshot: {
                name: sydneyCarHire.name,
                email: sydneyCarHire.email,
                phone: sydneyCarHire.phone,
                address: sydneyCarHire.address,
                customerType: "rental_company"
            },
            partsAndLabour: [
                { description: "Major Fleet Engine Overhaul Contract (Sydney Airport Fleet)", qty: 1, price: 1954.55 }
            ],
            subtotal: 1954.55,
            gstAmount: 195.45,
            totalAmount: 2150.00,
            amountPaid: 2150.00,
            balanceDue: 0,
            paidAt: fiveAndHalfYearsAgo,
            retentionMetadata: {
                legalHold: true,
                legalHoldReason: "ATO Statutory Audit Review - Retention Hold",
                retentionExpiryDate: new Date(Date.now() + 365 * 86400000)
            }
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
            status: "delivered",
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
            status: "delivered",
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
                { inventoryId: engineOilCastrol._id, quantity: 1, unitPrice: 65.00, discount: 0, subtotal: 65.00 },
                { inventoryId: wiperBlades._id, quantity: 1, unitPrice: 42.00, discount: 0, subtotal: 42.00 }
            ],
            paymentMethod: "Card",
            totalAmount: 107.00,
            createdAt: new Date()
        },
        {
            items: [
                { inventoryId: wiperBlades._id, quantity: 2, unitPrice: 42.00, discount: 4.00, subtotal: 80.00 }
            ],
            paymentMethod: "Cash",
            totalAmount: 80.00,
            createdAt: new Date()
        },
        {
            items: [
                { inventoryId: batteryBosch._id, quantity: 1, unitPrice: 265.00, discount: 0, subtotal: 265.00 }
            ],
            paymentMethod: "EFTPOS",
            totalAmount: 265.00,
            createdAt: new Date(Date.now() - 1 * 86400000)
        },
        {
            customerId: robertC._id,
            items: [
                { inventoryId: engineOilCastrol._id, quantity: 2, unitPrice: 52.00, discount: 0, subtotal: 104.00 },
                { inventoryId: rycoFilters._id, quantity: 2, unitPrice: 24.00, discount: 0, subtotal: 48.00 }
            ],
            paymentMethod: "Card",
            totalAmount: 152.00,
            createdAt: new Date(Date.now() - 3 * 86400000)
        }
    ]);

    console.log("[DemoSeeder] Creating Rentals & Fleet Visit Entries...");
    const rentalVisitAussie = await RentalServiceEntry.create({
        customerId: aussieFleet._id,
        notes: "Monthly fleet return inspection & fluid top-up"
    });

    await RentalServiceEntryVehicle.create([
        {
            serviceEntryId: rentalVisitAussie._id,
            vehicleId: corollaFlt1._id,
            status: "In Service",
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 24 * 3600000) },
                { status: "In Service", timestamp: new Date() }
            ]
        },
        {
            serviceEntryId: rentalVisitAussie._id,
            vehicleId: corollaFlt2._id,
            status: "Completed",
            completionOdometer: 28900,
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 48 * 3600000) },
                { status: "In Service", timestamp: new Date(Date.now() - 24 * 3600000) },
                { status: "Completed", timestamp: new Date() }
            ]
        },
        {
            serviceEntryId: rentalVisitAussie._id,
            vehicleId: hiaceFlt._id,
            status: "Received",
            statusHistory: [
                { status: "Received", timestamp: new Date(Date.now() - 6 * 3600000) }
            ]
        }
    ]);

    console.log("[DemoSeeder] Creating Dealer Cars (In Stock and Sold)...");
    await DealerCar.create([
        {
            make: "Mazda",
            model: "BT-50 XTR Dual Cab 4x4",
            year: 2020,
            registrationNumber: "BT5-001",
            vin: "1MZBT500000987654",
            mileage: 68400,
            colour: "Gunmetal Grey",
            dealerName: "Seven Hills Prestige Wholesale",
            cost: 26500,
            sellPrice: 31990,
            purchaseDate: new Date(Date.now() - 8 * 86400000),
            status: "In Stock",
            notes: "One owner, complete logbook history, heavy duty tow package and electric brake controller."
        },
        {
            make: "Volkswagen",
            model: "Tiguan 162TSI Highline R-Line",
            year: 2021,
            registrationNumber: "TIG-162",
            vin: "WVGZZZ5NZMW123456",
            mileage: 44200,
            colour: "Pure White",
            dealerName: "Parramatta Motor Auction",
            cost: 32000,
            sellPrice: 37800,
            purchaseDate: new Date(Date.now() - 14 * 86400000),
            status: "In Stock",
            notes: "Equipped with Panoramic sunroof, digital virtual cockpit, and full dealer workshop pre-inspection report."
        },
        {
            make: "Toyota",
            model: "RAV4 Cruiser Hybrid AWD",
            year: 2021,
            registrationNumber: "RAV-444",
            vin: "JTMB31FV123456789",
            mileage: 38500,
            colour: "Atomic Rush Red",
            dealerName: "Blacktown Auto Gallery",
            cost: 34000,
            sellPrice: 39500,
            soldFor: 39500,
            purchaseDate: new Date(Date.now() - 25 * 86400000),
            soldDate: new Date(Date.now() - 2 * 86400000),
            status: "Sold",
            buyerName: "Mark Harrison",
            buyerPhone: "0421 789 654",
            buyerEmail: "mark.harrison@gmail.com",
            buyerAddress: {
                addressLine1: "14 Kings Rd",
                suburb: "Castle Hill",
                state: "NSW",
                postcode: "2154",
                country: "Australia"
            },
            buyerLicense: {
                licenseNumber: "98765432",
                holderName: "Mark Harrison",
                issuingState: "NSW",
                licenseClass: "C"
            },
            notes: "Sold with 12-month complimentary national roadside assistance and full service completed."
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

    const [booking1, booking2, booking3] = await Booking.create([
        {
            customerId: emma._id,
            vehicleId: cx5._id,
            appointment: { date: tomorrowStr, time: "09:00 AM" },
            customerInfo: { fullName: "Emma Thompson", firstName: "Emma", lastName: "Thompson", email: emma.email, phone: emma.phone },
            vehicleInfo: { make: "Mazda", model: "CX-5", regNo: "MZD-555" },
            services: ["Logbook Servicing", "Tyres & Balancing"],
            serviceType: "Logbook Service",
            status: "Confirmed",
            notes: "Prefers morning drop-off before 9:00 AM."
        },
        {
            customerId: michael._id,
            vehicleId: hilux._id,
            appointment: { date: dayAfterStr, time: "10:00 AM" },
            customerInfo: { fullName: "Michael Davies", firstName: "Michael", lastName: "Davies", email: michael.email, phone: michael.phone },
            vehicleInfo: { make: "Toyota", model: "HiLux SR5", regNo: "NSW-8899" },
            services: ["Suspension & Steering", "Wheel Alignment"],
            serviceType: "Wheel Alignment & Tyre Balance",
            status: "Confirmed",
            notes: "Check rear tyre pressure and spare as well."
        },
        {
            customerId: sarahJ._id,
            vehicleId: i30._id,
            appointment: { date: todayStr, time: "02:00 PM" },
            customerInfo: { fullName: "Sarah Jenkins", firstName: "Sarah", lastName: "Jenkins", email: sarahJ.email, phone: sarahJ.phone },
            vehicleInfo: { make: "Hyundai", model: "i30 N-Line", regNo: "HYU-332" },
            services: ["Brake & Clutch", "Safety Inspection"],
            serviceType: "Brake Service",
            status: "Confirmed",
            notes: "Drop off during lunch break."
        }
    ]);

    console.log("[DemoSeeder] Creating Quotes (Active and 12-Month Review)...");
    await Quote.create([
        {
            customerInfo: { fullName: "Robert Taylor", firstName: "Robert", lastName: "Taylor", email: "robert.t@example.com", phone: "0455 123 456" },
            vehicleInfo: { make: "Volkswagen", model: "Golf GTI", year: "2017", regNo: "VWG-777" },
            services: ["Logbook Servicing", "Brake & Clutch"],
            description: "Quote for 100,000km major service including timing chain inspection.",
            status: "Pending",
            createdAt: new Date(Date.now() - 4 * 3600000)
        },
        {
            customerInfo: { fullName: "Karen White", firstName: "Karen", lastName: "White", email: "karen.w@example.com", phone: "0466 987 654" },
            vehicleInfo: { make: "Subaru", model: "Forester", year: "2019", regNo: "SUB-808" },
            services: ["Air Conditioning", "Mechanical Repairs"],
            description: "Air conditioner blowing warm air on hot days. Need diagnostic and regas quote.",
            status: "In Review",
            createdAt: new Date(Date.now() - 20 * 3600000)
        },
        // Old Quote (>12 Months) for Retention Review Panel
        {
            customerInfo: { fullName: "Gregory Stone", firstName: "Gregory", lastName: "Stone", email: "greg.stone@example.com", phone: "0412 888 777" },
            vehicleInfo: { make: "Holden", model: "Commodore SS V8", year: "2015", regNo: "SS-6200" },
            services: ["Exhaust & Performance", "Dyno Tuning"],
            description: "Stainless steel cat-back exhaust installation and dyno tune quote.",
            status: "Closed",
            createdAt: new Date(Date.now() - 420 * 86400000) // 14 months old
        }
    ]);

    console.log("[DemoSeeder] Creating Communications Messages (Contacts)...");
    await Contact.create([
        {
            firstName: "James",
            lastName: "Wilson",
            email: "james.w@gmail.com",
            phone: "0422 111 222",
            subject: "Quote for Timing Belt Replacement - 2016 Golf",
            message: "Hi GSK team, looking for a quote on timing belt & water pump replacement for my 2016 VW Golf TSI. Do you use OEM Continental kits?",
            status: "Unread",
            customerId: null,
            createdAt: new Date(Date.now() - 2 * 3600000)
        },
        {
            firstName: "Amanda",
            lastName: "Taylor",
            email: "amanda.t@outlook.com",
            phone: "0433 999 888",
            subject: "Fleet Servicing Inquiry",
            message: "Good morning, we operate a 12-vehicle courier van fleet in Western Sydney. Wondering if you offer priority corporate turnaround times and commercial credit terms.",
            status: "Replied",
            internalNotes: "Mike reached out with commercial fleet pack. Awaiting fleet list.",
            replies: [
                {
                    communicationId: new (await import('mongoose')).default.Types.ObjectId(),
                    communicationType: "Message",
                    senderName: "GSK Automotive",
                    senderEmail: "info@gskautomotive.com.au",
                    authorName: "Mike Manager",
                    sentBy: managerUser._id,
                    recipientEmail: "amanda.t@outlook.com",
                    subject: "Re: Fleet Servicing Inquiry — GSK Automotive",
                    body: "Hi Amanda, thank you for reaching out. Yes, we provide full commercial fleet accounts with 24-hr turnaround guarantees and dedicated trade pricing.",
                    message: "Hi Amanda, thank you for reaching out. Yes, we provide full commercial fleet accounts with 24-hr turnaround guarantees and dedicated trade pricing.",
                    deliveryStatus: "delivered",
                    sentAt: new Date(Date.now() - 5 * 3600000)
                }
            ],
            createdAt: new Date(Date.now() - 8 * 3600000)
        },
        {
            firstName: "Daniel",
            lastName: "Kovacs",
            email: "dan.kovacs@gmail.com",
            phone: "0415 678 123",
            subject: "JDM Import Compliance Inspection",
            message: "Hi, I have a Nissan Silvia S15 arriving at Port Botany next week. Do you handle full ADR blue slip compliance and headlight aiming?",
            status: "Read",
            customerId: sakuraJdm._id,
            internalNotes: "Advised customer to book via Sakura JDM batch queue.",
            createdAt: new Date(Date.now() - 24 * 3600000)
        }
    ]);

    console.log("[DemoSeeder] Creating Notifications & Audit Logs...");
    await Notification.create([
        {
            type: "new_message",
            title: "New Customer Inquiry: James Wilson",
            message: "Quote inquiry received: Timing Belt Replacement for 2016 VW Golf.",
            relatedModel: "Contact",
            isRead: false,
            createdAt: new Date(Date.now() - 2 * 3600000)
        },
        {
            type: "new_booking",
            title: "New Booking: Emma Thompson",
            message: "Mazda CX-5 scheduled for Logbook Service tomorrow at 09:00 AM.",
            relatedModel: "Booking",
            relatedId: booking1._id,
            isRead: false,
            createdAt: new Date(Date.now() - 5 * 3600000)
        },
        {
            type: "job_completed",
            title: "Job Card Completed: Toyota HiLux",
            message: "Major 60k service completed by John Lead Mechanic. Tax Invoice INV-1001 issued.",
            relatedModel: "JobCard",
            relatedId: jobHiLux._id,
            isRead: true,
            createdAt: new Date(Date.now() - 3 * 86400000)
        },
        {
            type: "system",
            title: "Inventory Stock Alert",
            message: "Bendix Front Brake Pads DB1774 reached minimum threshold (2 sets remaining).",
            relatedModel: null,
            isRead: false,
            createdAt: new Date(Date.now() - 1 * 3600000)
        }
    ]);

    await AuditLog.create([
        { actor: adminUser._id, actorName: adminUser.name, actorEmail: adminUser.email, actorRole: adminUser.role, action: "CREATE_CUSTOMER", entityType: "Customer", entityId: String(michael._id), description: "Created Customer Michael Davies" },
        { actor: adminUser._id, actorName: adminUser.name, actorEmail: adminUser.email, actorRole: adminUser.role, action: "CREATE_CUSTOMER", entityType: "Customer", entityId: String(aussieFleet._id), description: "Created Fleet Company Aussie Fleet Rentals" },
        { actor: adminUser._id, actorName: adminUser.name, actorEmail: adminUser.email, actorRole: adminUser.role, action: "RECEIVE_PURCHASE_ORDER", entityType: "PurchaseOrder", entityId: "PO-1001", description: "Received PO-1001 (Castrol EDGE 5W-30 Oil)" },
        { actor: managerUser._id, actorName: managerUser.name, actorEmail: managerUser.email, actorRole: managerUser.role, action: "CREATE_JOB_CARD", entityType: "JobCard", entityId: String(jobHiLux._id), description: "Created Job Card JC-1001 for Toyota HiLux" },
        { actor: adminUser._id, actorName: adminUser.name, actorEmail: adminUser.email, actorRole: adminUser.role, action: "CREATE_INVOICE", entityType: "Invoice", entityId: String(inv1._id), description: "Generated Tax Invoice INV-1001 ($437.25)" },
        { actor: adminUser._id, actorName: adminUser.name, actorEmail: adminUser.email, actorRole: adminUser.role, action: "INVOICE_PAID", entityType: "Invoice", entityId: String(inv1._id), description: "Payment recorded for INV-1001 ($437.25)" },
        { actor: adminUser._id, actorName: adminUser.name, actorEmail: adminUser.email, actorRole: adminUser.role, action: "CREATE_BOOKING", entityType: "Booking", entityId: String(booking1._id), description: "Confirmed appointment for Emma Thompson" }
    ]);

    console.log("[DemoSeeder] Seeding completed successfully!");
}
