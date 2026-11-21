import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Invoice from './src/models/Invoice.js';
import DealerCar from './src/models/DealerCar.js';
import InventoryTransaction from './src/models/InventoryTransaction.js';
import Sale from './src/models/Sale.js';
import PurchaseOrder from './src/models/PurchaseOrder.js';

dotenv.config();

async function runVerification() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB for Phase 43B Verification");

  let passed = true;

  // 1. Invoices
  console.log("\n--- Checking Invoices ---");
  const paidInvoices = await Invoice.find({ status: 'Paid' });
  console.log(`Found ${paidInvoices.length} paid invoices.`);
  for (const inv of paidInvoices) {
    if (inv.amountPaid !== inv.totalAmount) {
      console.warn(`WARN: Invoice ${inv.invoiceNo} has amountPaid (${inv.amountPaid}) != totalAmount (${inv.totalAmount}).`);
    }
    if (!inv.paidAt) {
      console.warn(`WARN: Paid Invoice ${inv.invoiceNo} is missing paidAt. Using updatedAt fallback.`);
    }
  }

  // 2. Dealer Cars
  console.log("\n--- Checking Dealer Cars ---");
  const dealerCars = await DealerCar.find();
  let soldCount = 0;
  for (const car of dealerCars) {
    if (car.status === 'Sold') {
      soldCount++;
      const profit = car.soldFor - car.cost;
      if (profit < 0) {
        console.warn(`WARN: Dealer Car ${car.registrationNumber} sold at a loss (${profit}).`);
      }
      if (!car.soldDate) {
        console.warn(`WARN: Sold Dealer Car ${car.registrationNumber} is missing soldDate!`);
        passed = false;
      }
    }
    if (!car.purchaseDate) {
       console.warn(`WARN: Dealer Car ${car.registrationNumber} is missing purchaseDate!`);
       passed = false;
    }
  }
  console.log(`Found ${dealerCars.length} Dealer Cars, ${soldCount} Sold.`);

  // 3. Purchase Orders
  console.log("\n--- Checking Purchase Orders ---");
  const receipts = await InventoryTransaction.find({ type: 'PURCHASE_RECEIPT' });
  console.log(`Found ${receipts.length} Inventory Receipts.`);
  for (const receipt of receipts) {
    const po = await PurchaseOrder.findById(receipt.purchaseOrderId);
    if (!po) {
      console.warn(`WARN: Receipt ${receipt._id} has invalid PO ID.`);
      continue;
    }
    const item = po.items.find(i => i.variantId ? i.variantId.toString() === receipt.variantId?.toString() : i.productId.toString() === receipt.inventoryId.toString());
    if (!item) {
      console.warn(`WARN: Receipt ${receipt._id} cannot find matching PO item in PO ${po.purchaseOrderNumber}.`);
      passed = false;
    } else {
      if (item.unitPurchasePrice == null) {
        console.warn(`WARN: PO Item in PO ${po.purchaseOrderNumber} missing unitPurchasePrice.`);
        passed = false;
      }
    }
  }

  if (passed) {
    console.log("\n✅ ALL PHASE 43B CONSISTENCY CHECKS PASSED.");
  } else {
    console.log("\n❌ SOME PHASE 43B CONSISTENCY CHECKS FAILED.");
  }
  
  process.exit(0);
}

runVerification().catch(console.error);
