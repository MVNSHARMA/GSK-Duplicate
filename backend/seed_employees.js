import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const seedEmployees = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        const employees = [
            {
                name: 'John Mechanic',
                email: 'john.mechanic@gskautomotive.com',
                password: 'password123',
                role: 'mechanic',
            },
            {
                name: 'Sarah Service',
                email: 'sarah.service@gskautomotive.com',
                password: 'password123',
                role: 'mechanic',
            },
            {
                name: 'Mike Manager',
                email: 'mike.manager@gskautomotive.com',
                password: 'password123',
                role: 'admin',
                pagePermissions: {
                    service: true,
                    customers: true,
                    vehicles: true,
                    import_trackers: true,
                    daily_sales: true,
                    rentals: true,
                    invoices: true,
                    job_cards: true,
                    inventory: true,
                    dealer_cars: true,
                }
            }
        ];

        for (const emp of employees) {
            const existing = await User.findOne({ email: emp.email });
            if (!existing) {
                await User.create(emp);
                console.log(`Created employee: ${emp.name} (${emp.role})`);
            } else {
                console.log(`Employee already exists: ${emp.name}`);
            }
        }

        console.log('Seeding completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedEmployees();
