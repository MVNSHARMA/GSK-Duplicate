import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Stub functions that match the logic in jobCardController.js for getPartsMap and inventoryDeltas

const getPartsMap = (status, partsArray) => {
    if (status !== 'Completed' || !partsArray) return {};
    return partsArray.reduce((acc, part) => {
        if (part.inventoryId) {
            const id = `${part.inventoryId.toString()}:${part.variantId.toString()}`;
            acc[id] = (acc[id] || 0) + (part.quantity || 1);
        }
        return acc;
    }, {});
};

const calculateDeltas = (oldStatus, newStatus, oldPartsArray, newPartsArray) => {
    const oldPartsMap = getPartsMap(oldStatus, oldPartsArray);
    const newPartsMap = getPartsMap(newStatus, newPartsArray);

    const inventoryDeltas = {};
    for (const [id, qty] of Object.entries(newPartsMap)) {
        inventoryDeltas[id] = (inventoryDeltas[id] || 0) + qty;
    }
    for (const [id, qty] of Object.entries(oldPartsMap)) {
        inventoryDeltas[id] = (inventoryDeltas[id] || 0) - qty;
    }
    
    // Filter out 0 deltas
    for (const id in inventoryDeltas) {
        if (inventoryDeltas[id] === 0) delete inventoryDeltas[id];
    }
    return inventoryDeltas;
}

const mockParts = [
    { inventoryId: 'inv1', variantId: 'var1', quantity: 2 },
    { inventoryId: 'inv2', variantId: 'var2', quantity: 1 }
];

console.log('--- JOB CARD INVENTORY DEDUCTION TESTS ---');

const test1 = calculateDeltas('Open', 'Completed', mockParts, mockParts);
console.log('Test 1: Open -> Completed. Expected deltas: inv1:2, inv2:1. Result:', test1);

const test2 = calculateDeltas('Completed', 'Completed', mockParts, mockParts);
console.log('Test 2: Completed -> Completed (Edit). Expected deltas: Empty {}. Result:', test2);

const test3 = calculateDeltas('In Progress', 'Stuck', mockParts, mockParts);
console.log('Test 3: In Progress -> Stuck. Expected deltas: Empty {}. Result:', test3);

const mockPartsEdited = [
    { inventoryId: 'inv1', variantId: 'var1', quantity: 5 }, // Increased by 3
    { inventoryId: 'inv2', variantId: 'var2', quantity: 1 }
];
const test4 = calculateDeltas('Completed', 'Completed', mockParts, mockPartsEdited);
console.log('Test 4: Completed -> Completed (Increased Qty). Expected deltas: inv1:3. Result:', test4);

const test5 = calculateDeltas('Completed', 'Open', mockParts, mockParts);
console.log('Test 5: Completed -> Open (Reversal). Expected deltas: inv1:-2, inv2:-1. Result:', test5);

console.log('--- TESTS COMPLETE ---');
process.exit(0);
