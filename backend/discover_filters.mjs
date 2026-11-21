import fs from 'fs';
import path from 'path';

function findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const stat = fs.statSync(path.join(dir, file));
        if (stat.isDirectory()) {
            findFiles(path.join(dir, file), fileList);
        } else if (file.endsWith('.jsx')) {
            fileList.push(path.join(dir, file));
        }
    }
    return fileList;
}

const frontendPagesDir = '/Users/shashi/chrysolite_gsk_project/GSK-Automotive/frontend/src/pages/';
const componentsDir = '/Users/shashi/chrysolite_gsk_project/GSK-Automotive/frontend/src/components/';

const allFiles = [...findFiles(path.join(frontendPagesDir, 'admin')), ...findFiles(path.join(frontendPagesDir, 'customer')), ...findFiles(path.join(componentsDir, 'admin'))];

const report = [];

for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check if it has fetch and URLSearchParams
    if (content.includes('URLSearchParams') || content.includes('fetch(') || content.includes('AbortController')) {
        const basename = path.basename(file);
        
        // Extract URLSearchParams appends
        const paramAppends = [...content.matchAll(/params\.append\(['"]([^'"]+)['"]/g)].map(m => m[1]);
        
        // Extract states that might be used for searching/filtering
        const stateVars = [...content.matchAll(/const \[([a-zA-Z0-9_]+),\s*set[A-Z]/g)].map(m => m[1]);
        const filters = stateVars.filter(v => v.toLowerCase().includes('search') || v.toLowerCase().includes('filter') || v.toLowerCase().includes('status') || v.toLowerCase().includes('type'));
        
        // Check debounce
        const hasDebounce = content.includes('setTimeout') || content.includes('useDebounce');
        
        // Check AbortController
        const hasAbortController = content.includes('AbortController');
        
        // Check pagination reset
        const hasSetPageOne = content.includes('setPage(1)');
        
        report.push({
            component: basename,
            paramsSentToApi: [...new Set(paramAppends)],
            filterStates: filters,
            hasDebounce,
            hasAbortController,
            hasSetPageOne
        });
    }
}

fs.writeFileSync('/Users/shashi/chrysolite_gsk_project/GSK-Automotive/backend/filter_audit.json', JSON.stringify(report, null, 2));
console.log(`Generated Layer 1 Discovery for ${report.length} components.`);
