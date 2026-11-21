import fs from 'fs';
const buffer = fs.readFileSync('VEHICLE-DOC-TEST-2026.pdf');
console.log(buffer.toString('utf8').includes('VEHICLE DOCUMENT TEST'));
