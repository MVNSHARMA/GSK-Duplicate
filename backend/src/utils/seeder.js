import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Vehicle from "../models/Vehicle.js";
import Inventory from "../models/Inventory.js";
import Sale from "../models/Sale.js";
import JobCard from "../models/JobCard.js";

const runSeeder = async () => {
    // Auto-seed admin user if none exists
    if (process.env.NODE_ENV === 'development' || process.env.SEED_ADMIN === 'true') {
        try {
            const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@gskautomotive.com";
            const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;
            if (!defaultPassword) {
                console.warn("WARNING: DEFAULT_ADMIN_PASSWORD not set. Admin seeding skipped.");
                return;
            }
            const adminExists = await User.findOne({ email: defaultEmail });
            if (!adminExists) {
                await User.create({
                    name: "Boss",
                    email: defaultEmail,
                    password: defaultPassword,
                    role: "super_admin",
                });
                console.log(`Default admin user seeded: ${defaultEmail}`);
            }
        } catch (err) {
            console.log("Admin seed check:", err.message);
        }
    }

    // Demo Data Seeder - Strictly isolated from SEED_ADMIN
    if (process.env.NODE_ENV === 'development' || process.env.SEED_DEMO_DATA === 'true') {
        try {
            // Seed demo employees
            const demoEmployees = [
                { name: 'John Mechanic', email: 'john.mechanic@gskautomotive.com', password: 'password123', role: 'mechanic' },
                { name: 'Sarah Service', email: 'sarah.service@gskautomotive.com', password: 'password123', role: 'mechanic' },
                { name: 'Mike Manager', email: 'mike.manager@gskautomotive.com', password: 'password123', role: 'admin' }
            ];

            for (const emp of demoEmployees) {
                const exists = await User.findOne({ email: emp.email });
                if (!exists) {
                    await User.create(emp);
                    console.log(`Demo employee seeded: ${emp.name} (${emp.role})`);
                }
            }
        } catch (err) {
            console.log("Admin seed check:", err.message);
        }
    }

    if (process.env.NODE_ENV === 'development' || process.env.SEED_DEMO_DATA === 'true') {
        try {
            const customerCount = await Customer.countDocuments();
            if (customerCount === 0) {
                console.log("Seeding demo data...");
            const customers = await Customer.create([
                // Regular Customers
                { name: 'Michael Davies', email: 'michael.d@example.com.au', phone: '0412 345 678', address: '12 George St, Sydney NSW 2000', customerType: 'regular' },
                { name: 'Sarah Jenkins', email: 'sarah.j@example.com.au', phone: '0434 567 890', address: '45 Pitt St, Sydney NSW 2000', customerType: 'regular' },
                { name: 'David Nguyen', email: 'david.n@example.com.au', phone: '0411 222 333', address: '88 Sussex St, Sydney NSW 2000', customerType: 'regular' },
                
                // Import Companies
                { name: 'Sakura JDM Imports', email: 'sales@sakurajdm.com.au', phone: '02 9876 5432', address: '100 Parramatta Rd, Auburn NSW 2144', customerType: 'import_company', idType: 'ABN', idNumber: '12 345 678 901' },
                { name: 'Tokyo Auto Trade', email: 'imports@tokyoauto.com.au', phone: '02 8765 4321', address: '55 Victoria Rd, Rydalmere NSW 2116', customerType: 'import_company', idType: 'ABN', idNumber: '98 765 432 109' },

                // Rental Companies
                { name: 'Aussie Fleet Rentals', email: 'fleet@aussiefleet.com.au', phone: '1300 123 456', address: '1 Airport Dr, Mascot NSW 2020', customerType: 'rental_company', idType: 'ACN', idNumber: '111 222 333' },
                { name: 'Sydney City Car Hire', email: 'admin@sydneycarhire.com.au', phone: '1300 987 654', address: '200 William St, Woolloomooloo NSW 2011', customerType: 'rental_company', idType: 'ACN', idNumber: '444 555 666' }
            ]);

            const vehicles = await Vehicle.create([
                // Michael's Vehicles (Regular) - Index 0, 1
                { customerId: customers[0]._id, brand: 'Toyota', model: 'Camry', year: 2018, registrationNumber: 'XWZ-123', mileage: 65000, status: 'Available' },
                { customerId: customers[0]._id, brand: 'Subaru', model: 'Outback', year: 2021, registrationNumber: 'ABC-987', mileage: 25000, status: 'Available' },
                
                // Sarah's Vehicle (Regular) - Index 2
                { customerId: customers[1]._id, brand: 'Hyundai', model: 'i30', year: 2020, registrationNumber: 'DEF-456', mileage: 42000, status: 'Available' },
                
                // David's Vehicle (Regular) - Index 3
                { customerId: customers[2]._id, brand: 'Volkswagen', model: 'Golf', year: 2019, registrationNumber: 'GHI-789', mileage: 55000, status: 'Available' },

                // Sakura JDM Imports (Import Company) - Index 4, 5
                { customerId: customers[3]._id, brand: 'Toyota', model: 'Alphard', year: 2017, registrationNumber: 'JDM-001', mileage: 80000, notes: 'Recent import, needs compliance.', status: 'Available' },
                { customerId: customers[3]._id, brand: 'Nissan', model: 'Elgrand', year: 2016, registrationNumber: 'JDM-002', mileage: 92000, notes: 'Awaiting inspection.', status: 'Available' },
                
                // Tokyo Auto Trade (Import Company) - Index 6
                { customerId: customers[4]._id, brand: 'Toyota', model: 'Crown', year: 2018, registrationNumber: 'JDM-003', mileage: 75000, status: 'Available' },
                
                // Aussie Fleet Rentals (Rental Company) - Index 7, 8, 9
                { customerId: customers[5]._id, brand: 'Toyota', model: 'Corolla', year: 2022, registrationNumber: 'FLT-001', mileage: 15000, dailyRate: 50, status: 'Available' },
                { customerId: customers[5]._id, brand: 'Toyota', model: 'Corolla', year: 2022, registrationNumber: 'FLT-002', mileage: 16000, dailyRate: 50, status: 'Rented' },
                { customerId: customers[5]._id, brand: 'Kia', model: 'Cerato', year: 2021, registrationNumber: 'FLT-003', mileage: 30000, dailyRate: 45, status: 'Available' },
                
                // Sydney City Car Hire (Rental Company) - Index 10, 11
                { customerId: customers[6]._id, brand: 'Mitsubishi', model: 'ASX', year: 2023, registrationNumber: 'SYD-001', mileage: 5000, dailyRate: 65, status: 'Available' },
                { customerId: customers[6]._id, brand: 'Hyundai', model: 'Tucson', year: 2022, registrationNumber: 'SYD-002', mileage: 22000, dailyRate: 75, status: 'Maintenance' }
            ]);

            const inventory = await Inventory.create([
                { itemName: 'Synthetic Engine Oil 5W-30', category: 'Fluids', quantity: 50, minStockLevel: 10, unitPrice: 25.00, supplier: 'AutoParts Inc' },
                { 
                    itemName: 'Brake Pads', 
                    category: 'Parts', 
                    supplier: 'Brakes Direct',
                    variants: [
                        { name: 'Toyota Corolla Front', sku: 'BP-COR-F', quantity: 20, minStockLevel: 5, unitPrice: 85.00, isActive: true },
                        { name: 'Toyota Corolla Rear', sku: 'BP-COR-R', quantity: 15, minStockLevel: 5, unitPrice: 75.00, isActive: true },
                        { name: 'Toyota Camry Front', sku: 'BP-CAM-F', quantity: 10, minStockLevel: 4, unitPrice: 90.00, isActive: true },
                        { name: 'Toyota Camry Rear', sku: 'BP-CAM-R', quantity: 8, minStockLevel: 4, unitPrice: 80.00, isActive: true }
                    ]
                },
                { 
                    itemName: 'Oil Filter', 
                    category: 'Filters', 
                    supplier: 'AutoParts Inc',
                    variants: [
                        { name: 'Toyota Corolla', sku: 'OF-COR', quantity: 10, minStockLevel: 5, unitPrice: 25.00, isActive: true },
                        { name: 'Toyota Camry', sku: 'OF-CAM', quantity: 6, minStockLevel: 3, unitPrice: 25.00, isActive: true },
                        { name: 'Toyota RAV4', sku: 'OF-RAV', quantity: 4, minStockLevel: 3, unitPrice: 27.00, isActive: true },
                        { name: 'Universal', sku: 'OF-UNI', quantity: 15, minStockLevel: 5, unitPrice: 20.00, isActive: true }
                    ]
                },
                { 
                    itemName: 'Air Filter', 
                    category: 'Filters', 
                    supplier: 'AutoParts Inc',
                    variants: [
                        { name: 'Toyota Corolla', sku: 'AF-COR', quantity: 12, minStockLevel: 4, unitPrice: 30.00, isActive: true },
                        { name: 'Toyota Camry', sku: 'AF-CAM', quantity: 8, minStockLevel: 4, unitPrice: 32.00, isActive: true }
                    ]
                },
                { itemName: 'Wiper Blades', category: 'Accessories', quantity: 40, minStockLevel: 10, unitPrice: 20.00, supplier: 'ClearView' }
            ]);

            await Sale.create([
                { 
                    customerId: customers[0]._id, 
                    items: [
                        { inventoryId: inventory[0]._id, quantity: 2, unitPrice: 25.00, discount: 0, subtotal: 50.00 },
                        { inventoryId: inventory[2]._id, variantId: inventory[2].variants[0]._id, quantity: 1, unitPrice: 25.00, discount: 0, subtotal: 25.00 }
                    ],
                    paymentMethod: 'Card',
                    totalAmount: 75.00
                },
                { 
                    customerId: customers[1]._id, 
                    items: [
                        { inventoryId: inventory[1]._id, quantity: 1, unitPrice: 85.00, discount: 5.00, subtotal: 80.00 }
                    ],
                    paymentMethod: 'Cash',
                    totalAmount: 80.00
                },
                { 
                    items: [
                        { inventoryId: inventory[3]._id, quantity: 1, unitPrice: 40.00, discount: 0, subtotal: 40.00 },
                        { inventoryId: inventory[4]._id, quantity: 2, unitPrice: 20.00, discount: 0, subtotal: 40.00 }
                    ],
                    paymentMethod: 'EFTPOS',
                    totalAmount: 80.00
                }
            ]);

            await JobCard.create([
                {
                    vehicleId: vehicles[0]._id,
                    customerId: customers[0]._id,
                    vehicleDetails: { technician: 'Mike T.' },
                    servicesOrdered: ['Lubrication', 'Safety Check'],
                    needsAttention: ['Brake'],
                    repairsOrdered: 'Standard 10k service. Check brakes for squeaking.',
                    labourHours: 2,
                    hourlyRate: 110,
                    charges: { lubricantsOil: 45, differentialOil: 0, miscellaneous: 10, transmission: 0, brakeFluid: 0 },
                    notes: 'Brakes are at 30%, recommend replacing next visit.'
                },
                {
                    vehicleId: vehicles[2]._id,
                    customerId: customers[2]._id,
                    vehicleDetails: { technician: 'Dave S.' },
                    servicesOrdered: ['Wheel Alignment', 'Dyn. Wheel Balance'],
                    needsAttention: ['Tyre/ Balance'],
                    repairsOrdered: 'Customer reports pulling to the left on highway.',
                    labourHours: 1.5,
                    hourlyRate: 110,
                    charges: { lubricantsOil: 0, differentialOil: 0, miscellaneous: 0, transmission: 0, brakeFluid: 0 },
                    notes: 'Alignment corrected.'
                },
                {
                    vehicleId: vehicles[4]._id,
                    customerId: customers[3]._id,
                    vehicleDetails: { technician: 'Mike T.' },
                    servicesOrdered: ['Auto Trans. Service'],
                    needsAttention: ['Transmission'],
                    repairsOrdered: 'Transmission fluid flush and filter replacement.',
                    labourHours: 3,
                    hourlyRate: 110,
                    charges: { lubricantsOil: 0, differentialOil: 0, miscellaneous: 20, transmission: 150, brakeFluid: 0 },
                    notes: 'Fluid was very dark, running smoothly now.'
                }
            ]);
            console.log("Demo data seeded successfully.");
        }
        } catch (err) {
            console.error("Demo data seeding failed:", err.message);
        }
    }
};

export default runSeeder;
