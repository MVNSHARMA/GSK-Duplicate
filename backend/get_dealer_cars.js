import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gsk_automotive');
    const DealerCar = (await import('./src/models/DealerCar.js')).default;
    const metricsAgg = await DealerCar.aggregate([
        { $match: { isActive: true } },
        { $group: {
            _id: null,
            inStockCount: {
                $sum: { $cond: [{ $eq: ["$status", "In Stock"] }, 1, 0] }
            },
            soldCount: {
                $sum: { $cond: [{ $eq: ["$status", "Sold"] }, 1, 0] }
            },
            costInStock: {
                $sum: { $cond: [{ $eq: ["$status", "In Stock"] }, "$cost", 0] }
            },
            actualProfit: {
                $sum: { 
                    $cond: [{ $eq: ["$status", "Sold"] }, { $subtract: [{ $ifNull: ["$soldFor", "$sellPrice"] }, "$cost"] }, 0]
                }
            }
        }}
    ]);
    console.log("Metrics:", JSON.stringify(metricsAgg));
    process.exit(0);
}
test();
