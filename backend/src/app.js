import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import intakeRoutes from "./routes/intakeRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";

import dailySalesRoutes from "./routes/dailySalesRoutes.js";
import dealerCarRoutes from "./routes/dealerCarRoutes.js";

import rentalEntryRoutes from "./routes/rentalEntryRoutes.js";
import jobCardRoutes from "./routes/jobCardRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import trashRoutes from "./routes/trashRoutes.js";

import settingRoutes from "./routes/settingRoutes.js";
import communicationsRoutes from "./routes/communicationsRoutes.js";
import slotRoutes from "./routes/slotRoutes.js";
import cronRoutes from "./routes/cronRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import vehicleBatchRoutes from "./routes/vehicleBatchRoutes.js";
import vehicleTemplateRoutes from "./routes/vehicleTemplateRoutes.js";
import customerPortalRoutes from "./routes/customerPortalRoutes.js";

import connectDB from "./config/db.js";
import runSeeder from "./utils/seeder.js";
import { invalidateDashboardCache } from "./controllers/dashboardController.js";

const app = express();

// Trust proxy for Vercel and reverse proxies so req.protocol resolves to https correctly
app.set('trust proxy', 1);

app.use(helmet());

const GSK_VERCEL_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]*gsk[a-z0-9-]*\.vercel\.app$/i;
const GSK_RENDER_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i;

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, health checks, or curl requests)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:5000',
            'http://localhost:5005'
        ];

        if (process.env.FRONTEND_URL) {
            const urls = process.env.FRONTEND_URL.split(',').map(u => u.trim().replace(/\/$/, '')).filter(Boolean);
            allowedOrigins.push(...urls);
        }

        // Allow official GSK Automotive Vercel & Render deployment URLs
        if (GSK_VERCEL_ORIGIN_REGEX.test(origin) || GSK_RENDER_ORIGIN_REGEX.test(origin)) {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // Log for debugging blocked origins in serverless logs
            console.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};
app.use(cors(corsOptions));

// Lightweight health check endpoint for Render / load balancers
app.get(['/healthz', '/api/health'], (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'GSK Automotive Backend',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

let seederHasRun = false;

// Global DB Connection & Initialization Middleware for Serverless
app.use(async (req, res, next) => {
    try {
        await connectDB();

        if (!seederHasRun && process.env.SEED_ADMIN === 'true') {
            await runSeeder();
            seederHasRun = true;
        }

        next();
    } catch (error) {
        console.error("Database connection/initialization error:", error);
        res.status(500).json({
            success: false,
            error: 'Database Connection Error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.get('/api/debug-ping', (req, res) => {
    res.json({ success: true, message: 'API is reachable', url: req.url, originalUrl: req.originalUrl });
});

app.use(express.json());

// Automatically invalidate short-lived dashboard cache after any successful write operation
app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        res.on('finish', () => {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                invalidateDashboardCache();
            }
        });
    }
    next();
});

// Mount Routes
app.use("/api/intake", intakeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/vehicles", vehicleRoutes);

app.use("/api/daily-sales", dailySalesRoutes);
app.use("/api/dealer-cars", dealerCarRoutes);

app.use("/api/rental-entries", rentalEntryRoutes);
app.use("/api/job-cards", jobCardRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/trash", trashRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/communications", communicationsRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/vehicle-batches", vehicleBatchRoutes);
app.use("/api/vehicle-templates", vehicleTemplateRoutes);
app.use("/api/customer-portal", customerPortalRoutes);

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "GSK Automotive Backend Running"
    });
});

app.get("/health", (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
        success: true,
        status: 'UP',
        database: dbStatus,
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404 Handler for API routes
app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: `API Route Not Found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global Error:', err.message, err.stack);
    res.status(500).json({ success: false, error: err.message || 'Server Error' });
});

export default app; true
