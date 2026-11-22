import dotenv from "dotenv";
import http from "http";
import connectDB from "./config/db.js";
import app from "./app.js";
import runSeeder from "./utils/seeder.js";

dotenv.config();

// Connect to MongoDB and seed default admin
const startServer = async () => {
    const PORT = process.env.PORT || 5005;
    const server = http.createServer(app);

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });

    try {
        await connectDB();
        // Run seeder (auto-seeds admin and demo data if needed)
        await runSeeder();
    } catch (err) {
        console.error("Initial database connection warning:", err.message);
        console.error("Server is listening, but MongoDB connection failed. Please check MONGODB_URI.");
    }
};

startServer();