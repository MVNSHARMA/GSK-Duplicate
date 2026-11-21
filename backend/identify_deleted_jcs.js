import connectDB from './src/config/db.js';
import AuditLog from './src/models/AuditLog.js';
import InventoryTransaction from './src/models/InventoryTransaction.js';
import JobCard from './src/models/JobCard.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Find audit logs
    const auditLogs = await AuditLog.find({
        action: 'DELETE_JOB_CARD',
        createdAt: { $gte: oneHourAgo }
    }).sort({ createdAt: 1 });
    
    const deletedIds = auditLogs.map(log => log.target);
    const uniqueIds = [...new Set(deletedIds)];
    
    console.log(`Found ${auditLogs.length} DELETE_JOB_CARD audit logs in the last hour.`);
    console.log(`Unique Job Card IDs affected:`, uniqueIds);
    
    // Check Inventory Transactions
    const invTxns = await InventoryTransaction.find({
        jobCardId: { $in: uniqueIds },
        createdAt: { $gte: oneHourAgo }
    });
    
    console.log(`Found ${invTxns.length} InventoryTransactions linked to these Job Cards in the last hour.`);
    
    if (invTxns.length > 0) {
        console.log("Inventory Transactions detail:");
        invTxns.forEach(tx => {
            console.log(`- JC: ${tx.jobCardId}, Inv: ${tx.inventoryId}, Variant: ${tx.variantId}, Qty: ${tx.quantity}, Type: ${tx.type}, Reason: ${tx.reason}`);
        });
    }
    
    // Find which are currently inactive vs active just to be absolutely sure
    const jcs = await JobCard.find({ _id: { $in: uniqueIds } }, 'isActive status');
    console.log("Current state of affected JCs:");
    jcs.forEach(jc => {
        console.log(`- ${jc._id}: isActive=${jc.isActive}, status=${jc.status}`);
    });
    
    process.exit(0);
};

run();
