import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Suppress strictQuery warning
mongoose.set('strictQuery', false);

dotenv.config();

const BASE_URL = 'http://localhost:5005';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_placeholder';
const MONGO_URI = process.env.MONGODB_URI;

async function checkEndpoint(endpoint, token, testCases) {
    const headers = { 'Authorization': `Bearer ${token}` };
    
    let allPassed = true;
    const results = [];

    for (const test of testCases) {
        try {
            const res = await fetch(`${BASE_URL}${endpoint}${test.query}`, { headers });
            
            if (res.status === 404 && test.expectedStatus !== 404) {
                 results.push(`[404] ${test.name}: Endpoint not found`);
                 continue;
            }
            
            if (res.status !== 200 && res.status !== test.expectedStatus) {
                const text = await res.text();
                results.push(`[FAIL] ${test.name}: Expected ${test.expectedStatus || 200}, got ${res.status}. Body: ${text}`);
                allPassed = false;
                continue;
            }

            const data = await res.json();
            const pass = test.verify(data);
            if (!pass) {
                results.push(`[FAIL] ${test.name}: Verification failed. Records: ${data.data?.length}`);
                allPassed = false;
            } else {
                results.push(`[PASS] ${test.name}`);
            }
        } catch (err) {
            results.push(`[ERROR] ${test.name}: ${err.message}`);
            allPassed = false;
        }
    }
    
    return { allPassed, results };
}

async function run() {
    console.log("Starting Layer 2: API Integration Tests...\n");
    console.log("Connecting to DB:", MONGO_URI.split('@')[1] || MONGO_URI);
    
    await mongoose.connect(MONGO_URI);
    
    // We don't even need to import the full User model if we just want an ID
    const db = mongoose.connection.db;
    
    const adminUser = await db.collection('users').findOne({ role: 'admin' });
    const customerUser = await db.collection('users').findOne({ role: 'user' });
    
    if (!adminUser) throw new Error("No admin user found in DB");
    
    const adminToken = jwt.sign(
        { id: adminUser._id.toString(), role: adminUser.role },
        JWT_SECRET,
        { expiresIn: '1d' }
    );
    
    console.log("Admin token generated for user ID:", adminUser._id);
    
    const endpoints = [
        {
            path: '/api/customers',
            role: 'ADMIN',
            cases: [
                { name: 'Unfiltered', query: '', verify: d => Array.isArray(d.data) },
                { name: 'Search', query: '?search=test', verify: d => Array.isArray(d.data) },
                { name: 'Classification', query: '?classification=REGULAR', verify: d => d.data.every(c => c.classification === 'REGULAR') },
                { name: 'Combined', query: '?search=test&classification=RENTAL', verify: d => Array.isArray(d.data) }
            ]
        },
        {
            path: '/api/vehicles',
            role: 'ADMIN',
            cases: [
                { name: 'Unfiltered', query: '', verify: d => Array.isArray(d.data) },
                { name: 'Search', query: '?search=test', verify: d => Array.isArray(d.data) }
            ]
        },
        {
            path: '/api/job-cards',
            role: 'ADMIN',
            cases: [
                { name: 'Unfiltered', query: '', verify: d => Array.isArray(d.data) },
                { name: 'Search', query: '?search=test', verify: d => Array.isArray(d.data) },
                { name: 'Status Filter', query: '?status=Completed', verify: d => d.data.every(j => j.status === 'Completed') }
            ]
        }
    ];

    let overallPass = true;
    for (const ep of endpoints) {
        console.log(`Testing ${ep.path}...`);
        const { allPassed, results } = await checkEndpoint(ep.path, adminToken, ep.cases);
        results.forEach(r => console.log(`  ${r}`));
        if (!allPassed) overallPass = false;
        console.log('');
    }

    if (overallPass) {
        console.log("✅ All API tests completed successfully.");
    } else {
        console.log("❌ Some API tests failed.");
    }
    
    process.exit(0);
}

run();
