import mongoose from 'mongoose';
import { getDailySales } from './src/controllers/dailySalesController.js';

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const req = {
        query: {
            page: 1,
            limit: 100
        }
    };
    
    const res = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            console.log("Status:", this.statusCode);
            console.log("KPIs:", data.metrics);
            
            const invoices = data.data.filter(d => d.sourceType === 'Invoice');
            console.log(`\nFound ${invoices.length} Invoices in API response`);
            
            let paid0 = 0, paidNonZero = 0;
            for (let inv of invoices) {
                console.log(`Invoice ID: ${inv.sourceId}, moneyIn: ${inv.moneyIn}, net: ${inv.net}, fallback: ${inv.isLegacyFallback}`);
                if (inv.moneyIn === 0) paid0++;
                else paidNonZero++;
            }
            console.log(`\nIn API: moneyIn=0: ${paid0}, moneyIn>0: ${paidNonZero}`);
            process.exit(0);
        }
    };
    
    await getDailySales(req, res);
}

run().catch(console.error);
