import fs from 'fs';
import path from 'path';

const modelsDir = path.join(process.cwd(), 'backend/src/models');
const files = fs.readdirSync(modelsDir);

for (const file of files) {
    if (file.endsWith('.js')) {
        const content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
        if (content.includes('.index(') || content.includes('index: true')) {
            console.log(`Indexes found in: ${file}`);
        } else {
            console.log(`NO indexes explicitly defined in: ${file}`);
        }
    }
}
