import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Invoice from "../models/Invoice.js";
import Contact from "../models/Contact.js";
import Inventory from "../models/Inventory.js";
import { seedCompleteDemoLogic } from "./completeDemoSeeder.js";

const runSeeder = async () => {
    // Auto-seed admin user if none exists
    if (process.env.NODE_ENV === 'development' || process.env.SEED_ADMIN === 'true' || true) {
        try {
            const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@gskautomotive.com";
            const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
            const adminExists = await User.findOne({ email: defaultEmail });
            if (!adminExists) {
                await User.create({
                    name: "Boss / Owner",
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

    // Comprehensive Demo Data Seeder
    let shouldSeedDemo = process.env.SEED_DEMO_DATA === 'true';
    if (!shouldSeedDemo) {
        try {
            const [archivedCount, contactCount, inventoryCount] = await Promise.all([
                Invoice.countDocuments({ isArchived: true }),
                Contact.countDocuments({}),
                Inventory.countDocuments({ "variants.0": { $exists: true } })
            ]);
            // If archived invoices, contact messages, or inventory variants are missing, auto-seed
            if (archivedCount === 0 || contactCount === 0 || inventoryCount === 0) {
                console.log(`[AutoSeeder] Incomplete demo data detected (archivedInvoices: ${archivedCount}, contacts: ${contactCount}, inventoryWithVariants: ${inventoryCount}). Seeding complete client demo data...`);
                shouldSeedDemo = true;
            }
        } catch (checkErr) {
            console.warn("[AutoSeeder] Check error:", checkErr.message);
        }
    }

    if (shouldSeedDemo) {
        try {
            console.log("[AutoSeeder] Populating comprehensive client demo data across all modules...");
            await seedCompleteDemoLogic();
        } catch (err) {
            console.error("[AutoSeeder] Demo data seeding failed:", err.message);
        }
    }
};

export default runSeeder;
