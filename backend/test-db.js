import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const testApi = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Customer = (await import('./src/models/Customer.js')).default;
        
        const allTypes = await Customer.distinct('customerType');
        console.log('All customer types in DB:', allTypes);
        
        const counts = await Customer.aggregate([
            { $group: { _id: "$customerType", count: { $sum: 1 } } }
        ]);
        console.log('Counts:', counts);
        
    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
};

testApi();
