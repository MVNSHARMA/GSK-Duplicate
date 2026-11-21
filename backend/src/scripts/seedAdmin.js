import dotenv from "dotenv";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../models/User.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    try {
      // Try connecting to the configured URI first
      if (uri) {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log("Connected to MongoDB Atlas.");
      } else {
        throw new Error("No URI");
      }
    } catch {
      // Fall back to in-memory MongoDB
      console.log("Atlas unavailable. Using in-memory MongoDB for seeding...");
      const mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      await mongoose.connect(uri);
      console.log("Connected to in-memory MongoDB.");
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@gskautomobiles.com" });
    
    if (existingAdmin) {
      console.log("Admin user already exists. Skipping seed.");
      await mongoose.disconnect();
      process.exit(0);
    }

    const admin = await User.create({
      name: "Boss",
      email: "admin@gskautomobiles.com",
      password: process.env.DEFAULT_ADMIN_PASSWORD || "your_secure_password",
      role: "admin",
    });

    console.log(`Admin user created successfully: ${admin.email}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error.message);
    process.exit(1);
  }
};

seedAdmin();
