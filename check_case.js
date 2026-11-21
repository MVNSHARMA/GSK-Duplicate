import fs from 'fs';
import path from 'path';

// Function to check if a file path exists with exact case matching
function fileExistsWithExactCase(filePath) {
    if (!fs.existsSync(filePath)) return false;
    
    // Check all parent directories up to root for exact case match
    let currentPath = path.resolve(filePath);
    while (currentPath !== path.parse(currentPath).root) {
        const parentPath = path.dirname(currentPath);
        const basename = path.basename(currentPath);
        
        try {
            const files = fs.readdirSync(parentPath);
            if (!files.includes(basename)) {
                return false;
            }
        } catch (e) {
            return false;
        }
        
        currentPath = parentPath;
    }
    return true;
}

// Find all js/jsx files and check their imports
function findMismatches(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist' && !file.startsWith('.')) {
            findMismatches(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const importRegex = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1] || match[2];
                if (importPath.startsWith('.')) {
                    // It's a local file
                    const resolvedPath = path.resolve(path.dirname(fullPath), importPath);
                    // Append .js or .jsx if no extension provided
                    let pathsToCheck = [resolvedPath];
                    if (!path.extname(resolvedPath)) {
                        pathsToCheck.push(`${resolvedPath}.js`, `${resolvedPath}.jsx`, `${resolvedPath}/index.js`, `${resolvedPath}/index.jsx`);
                    }
                    
                    let foundAny = false;
                    let foundExact = false;
                    for (const p of pathsToCheck) {
                        if (fs.existsSync(p)) {
                            foundAny = true;
                            if (fileExistsWithExactCase(p)) {
                                foundExact = true;
                                break;
                            }
                        }
                    }
                    
                    if (foundAny && !foundExact) {
                        console.log(`CASE MISMATCH in ${fullPath}`);
                        console.log(`-> Imported: ${importPath}`);
                    }
                }
            }
        }
    }
}

console.log("Checking frontend...");
findMismatches(path.join(process.cwd(), 'frontend/src'));
console.log("Checking backend...");
findMismatches(path.join(process.cwd(), 'backend/src'));
console.log("Done checking case.");
