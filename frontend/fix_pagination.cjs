const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // We only care if the file has pagination
    if (!content.includes('setPage') && !content.includes('setPagination')) return;

    // Pattern for simple setState: onChange={(e) => setStatusFilter(e.target.value)}
    // or onChange={(e) => setFilter(e.target.value)}
    const regex = /onChange=\{\(\w+\)\s*=>\s*(set[A-Za-z0-9_]+)\([^)]+\)\}/g;
    
    content = content.replace(regex, (match, setterFn) => {
        // Exclude generic inputs like setSearchTerm because that has debouncing usually
        // Exclude pagination changes themselves
        if (setterFn.includes('Search') || setterFn.includes('Page') || setterFn.includes('Pagination')) {
            return match;
        }

        // Find the right pagination setter
        const pageSetter = content.includes('setPagination(prev => ({ ...prev, page: 1 }))') 
            ? 'setPagination(prev => ({ ...prev, page: 1 }));'
            : content.includes('setPagination(') && content.includes('page: 1') 
                ? 'setPagination(prev => ({ ...prev, page: 1 }));'
                : 'setPage(1);';

        modified = true;
        return `onChange={(e) => { ${match.slice(15, -1)}; ${pageSetter} }}`;
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Modified:", filePath);
    }
}

function walkDir(dir) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            walkDir(dirPath);
        } else if (dirPath.endsWith('.jsx')) {
            processFile(dirPath);
        }
    });
}

walkDir('src/pages');
