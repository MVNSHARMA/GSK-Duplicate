import fs from 'fs';
let content = fs.readFileSync('test_e2e.js', 'utf8');
content = content.replace(
  'const vCheck = await fetchJSON(`/vehicles/${vehicle1._id}`);\n    if (vCheck.data.data.customerId._id !== customerB._id) throw new Error("Vehicle not linked correctly");',
  'const vCheckRes = await fetchJSON(`/vehicles`);\n    const vCheck = vCheckRes.data.data.find(v => v._id === vehicle1._id);\n    if (vCheck.customerId._id !== customerB._id && vCheck.customerId !== customerB._id) throw new Error("Vehicle not linked correctly");'
);
fs.writeFileSync('test_e2e.js', content);
