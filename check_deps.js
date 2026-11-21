import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const backendPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend/package.json'), 'utf8'));

const rootDeps = Object.keys(rootPkg.dependencies || {});
const backendDeps = Object.keys(backendPkg.dependencies || {});

const missingInRoot = backendDeps.filter(dep => !rootDeps.includes(dep));

console.log("Dependencies in backend/package.json MISSING from root package.json:");
console.log(missingInRoot);

