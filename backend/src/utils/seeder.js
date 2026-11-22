import User from "../models/User.js";
import Customer from "../models/Customer.js";
import { seedCompleteDemoLogic } from "./completeDemoSeeder.js";

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

    // Comprehensive Demo Data Seeder
    if (process.env.SEED_DEMO_DATA === 'true') {
        try {
            console.log("SEED_DEMO_DATA=true detected. Populating comprehensive client demo data...");
            await seedCompleteDemoLogic();
        } catch (err) {
            console.error("Demo data seeding failed:", err.message);
        }
    } else if (process.env.NODE_ENV === 'development') {
        try {
            const customerCount = await Customer.countDocuments();
            if (customerCount === 0) {
                console.log("Local development: zero customers found. Populating comprehensive demo data...");
                await seedCompleteDemoLogic();
            }
        } catch (err) {
            console.error("Demo data seeding failed:", err.message);
        }
    }
};

export default runSeeder;
