import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';

async function test() {
    const token = jwt.sign({ _id: '64b1f4c7f0b5d5d8c8e1e8a9', role: 'superadmin' }, process.env.JWT_SECRET || 'gsk_secret', { expiresIn: '1d' });
    const payload = {
        "make":"TestMake",
        "model":"TestModel",
        "year":2022,
        "registrationNumber":"TST123",
        "cost":1000,
        "sellPrice":1500,
        "purchaseDate":"2026-01-01",
        "dealerName":"TestDealer"
    };

    const res = await fetch('http://localhost:5005/api/dealer-cars', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });
    
    const data = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", data);
}
test();
