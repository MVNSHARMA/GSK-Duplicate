const fetch = require('node-fetch');
async function run() {
  const loginRes = await fetch("http://localhost:5005/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gsk.com", password: "password123" })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const res = await fetch("http://localhost:5005/api/invoices?page=1&limit=15", {
      headers: { "Authorization": `Bearer ${token}` }
  });
  console.log(res.status, await res.text());
}
run();
