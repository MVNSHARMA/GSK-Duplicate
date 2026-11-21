import mongoose from 'mongoose';

/**
 * Cached connection promise to prevent duplicate connections
 * during concurrent cold-start requests in Vercel serverless.
 */
let cached = global._mongooseConnection;
if (!cached) {
    cached = global._mongooseConnection = { conn: null, promise: null };
}

const connectDB = async () => {
    // If already connected, return immediately
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    // If a connection attempt is already in progress, wait for it
    if (cached.promise) {
        cached.conn = await cached.promise;
        return cached.conn;
    }

    const uri = process.env.MONGODB_URI;

    if (!uri) {
        // In production, MONGODB_URI is mandatory
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
            throw new Error(
                'MONGODB_URI is not defined. Set it in Vercel Environment Variables.'
            );
        }

        // Local development: try in-memory fallback
        console.warn('No MONGODB_URI found. Attempting in-memory MongoDB for local development...');
        try {
            const { MongoMemoryServer } = await import('mongodb-memory-server');
            const mongoServer = await MongoMemoryServer.create();
            const fallbackUri = mongoServer.getUri();
            cached.promise = mongoose.connect(fallbackUri);
            cached.conn = await cached.promise;
            console.log(`In-memory MongoDB Connected: ${cached.conn.connection.host}`);
            return cached.conn;
        } catch (err) {
            throw new Error(`Failed to start in-memory MongoDB: ${err.message}`);
        }
    }

    // Connect to MongoDB Atlas
    try {
        cached.promise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: process.env.VERCEL ? 12 : 20,
            minPoolSize: process.env.VERCEL ? 1 : 2,
            socketTimeoutMS: 45000,
        });
        cached.conn = await cached.promise;
        console.log(`MongoDB Connected: ${cached.conn.connection.host}`);
        return cached.conn;
    } catch (err) {
        // Reset promise so next request can retry
        cached.promise = null;
        console.error(`MongoDB Connection Error: ${err.message}`);
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
            console.error(
                'HINT: Ensure MongoDB Atlas Network Access allows 0.0.0.0/0 for Vercel.'
            );
        }
        throw err;
    }
};

export default connectDB;
