import mongoose from 'mongoose';
import Invoice from './src/models/Invoice.js';
import DealerCar from './src/models/DealerCar.js';

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // 1. Find Paid invoices
    const paidInvoices = await Invoice.find({ status: 'Paid' }).lean();
    console.log(`Found ${paidInvoices.length} Paid Invoices`);
    
    let paidAmount0 = 0;
    let paidAmountNonZero = 0;
    let legacyPaid = 0;
    
    // Find some samples to verify against API
    let sampleZero = null;
    let sampleNonZero = null;
    let sampleLegacy = null;

    for (let inv of paidInvoices) {
        if (inv.amountPaid === 0) {
            paidAmount0++;
            if (!sampleZero) sampleZero = inv;
        } else {
            paidAmountNonZero++;
            if (!sampleNonZero) sampleNonZero = inv;
        }
        
        if (!inv.paidAt) {
            legacyPaid++;
            if (!sampleLegacy) sampleLegacy = inv;
        }
    }

    console.log(`- Paid with amountPaid = 0: ${paidAmount0}`);
    console.log(`- Paid with amountPaid > 0: ${paidAmountNonZero}`);
    console.log(`- Legacy Paid (no paidAt): ${legacyPaid}`);
    
    if (sampleZero) console.log(`Sample amountPaid=0 ID: ${sampleZero._id}, Total: ${sampleZero.totalAmount}`);
    if (sampleNonZero) console.log(`Sample amountPaid>0 ID: ${sampleNonZero._id}, Total: ${sampleNonZero.totalAmount}`);
    if (sampleLegacy) console.log(`Sample Legacy ID: ${sampleLegacy._id}, Total: ${sampleLegacy.totalAmount}`);

    // Unpaid/pending
    const unpaidInvoices = await Invoice.find({ status: { $ne: 'Paid' } }).lean();
    console.log(`\nFound ${unpaidInvoices.length} Unpaid/Pending Invoices`);
    if (unpaidInvoices.length > 0) console.log(`Sample Unpaid ID: ${unpaidInvoices[0]._id}`);
    
    process.exit(0);
}

run().catch(console.error);
