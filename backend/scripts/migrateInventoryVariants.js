import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGODB_URI is not defined");
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const runMigration = async () => {
    await connectDB();

    console.log('\n--- Starting Inventory Variants Migration ---');

    try {
        const db = mongoose.connection.db;
        const collection = db.collection('inventories');

        // Find all documents
        const items = await collection.find({}).toArray();
        console.log(`Total inventory records found: ${items.length}`);

        let migratedCount = 0;
        let alreadyMigratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const item of items) {
            try {
                // If there is no variants array, initialize it
                const variants = item.variants || [];

                // Check if it's already migrated or if it legitimately has existing variants
                const hasStandardVariant = variants.some(v => v.name === 'Standard' || v.name === 'Default');
                const hasRootQuantity = item.quantity !== undefined;
                
                // If there's no root quantity and it has variants, it's already fine
                if (!hasRootQuantity && variants.length > 0) {
                    skippedCount++;
                    continue;
                }

                if (hasStandardVariant) {
                    alreadyMigratedCount++;
                    // Still remove the root fields if they exist
                    if (hasRootQuantity) {
                        await collection.updateOne(
                            { _id: item._id },
                            { $unset: { quantity: "", unitPrice: "", minStockLevel: "" } }
                        );
                    }
                    continue;
                }

                // Needs migration: create standard variant from root fields
                if (hasRootQuantity || variants.length === 0) {
                    const newVariant = {
                        _id: new mongoose.Types.ObjectId(),
                        name: 'Standard',
                        sku: item.sku || '',
                        quantity: item.quantity || 0,
                        minStockLevel: item.minStockLevel || 0,
                        unitPrice: item.unitPrice || 0,
                        isActive: true
                    };

                    variants.push(newVariant);

                    // Update document: set variants and remove old root fields
                    await collection.updateOne(
                        { _id: item._id },
                        { 
                            $set: { variants: variants },
                            $unset: { quantity: "", unitPrice: "", minStockLevel: "", sku: "" }
                        }
                    );
                    migratedCount++;
                } else {
                    skippedCount++;
                }
            } catch (err) {
                console.error(`Error processing item ${item._id}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n--- Migration Summary ---');
        console.log(`Legacy records found: ${items.length}`);
        console.log(`Migrated: ${migratedCount}`);
        console.log(`Already migrated: ${alreadyMigratedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('-------------------------\n');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed.');
    }
};

runMigration();
