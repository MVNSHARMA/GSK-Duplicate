import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const session = await mongoose.startSession();
        session.startTransaction();
        console.log("Transaction started successfully.");
        await session.abortTransaction();
        session.endSession();
    } catch (e) {
        console.error("Error:", e);
    } finally {
        mongoose.disconnect();
    }
}
test();
