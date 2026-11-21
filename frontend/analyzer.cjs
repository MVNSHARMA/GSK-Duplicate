const fs = require('fs');
const path = require('path');

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('Search') && !content.includes('search') && !content.includes('Filter') && !content.includes('filter')) return null;

    const data = { file: filePath, hasSearch: false, hasDebounce: false, fetchCalls: [], useEffects: [], resetsPagination: false };
    
    if (content.includes('setSearch') || content.includes('search=')) data.hasSearch = true;
    if (content.includes('debounced') || content.includes('useDebounce')) data.hasDebounce = true;
    if (content.includes('setPagination(prev => ({ ...prev, page: 1 }))') || content.match(/page:\s*1/)) data.resetsPagination = true;

    // extract useEffects
    const effectRegex = /useEffect\(\(\) => \{[\s\S]*?\}, \[([^\]]*)\]\)/g;
    let match;
    while ((match = effectRegex.exec(content)) !== null) {
        data.useEffects.push(match[1].trim());
    }

    return data;
}

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const results = [];
walkDir('src/pages', function(filePath) {
    if (filePath.endsWith('.jsx')) {
        const res = analyzeFile(filePath);
        if (res) results.push(res);
    }
});

console.log(JSON.stringify(results, null, 2));
