import http from 'http';

const options = {
  hostname: 'localhost',
  port: 5005,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const json = JSON.parse(data);
    if (!json.token) {
        console.error("Login failed:", data);
        return;
    }
    const token = json.token;
    
    const optionsAudit = {
      hostname: 'localhost',
      port: 5005,
      path: '/api/admins/audit-logs',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    const reqAudit = http.request(optionsAudit, (resAudit) => {
      let auditData = '';
      resAudit.on('data', (chunk) => { auditData += chunk; });
      resAudit.on('end', () => {
        console.log("Audit logs Status:", resAudit.statusCode);
        console.log("Audit logs Response:", auditData.substring(0, 500));
      });
    });
    reqAudit.end();
  });
});

req.write(JSON.stringify({ email: 'admin@gsk.com', password: 'password123' }));
req.end();
