async function run() {
  const loginRes = await fetch("http://127.0.0.1:5005/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gsk.com", password: "password123" })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  
  // Need a customer ID. Let's fetch one.
  const custRes = await fetch("http://127.0.0.1:5005/api/customers?limit=1", {
      headers: { "Authorization": `Bearer ${token}` }
  });
  const custData = await custRes.json();
  const customerId = custData.data[0]._id;

  const payload = {
    type: "Service Invoice",
    customerId: customerId,
    partsAndLabour: [
       { description: "Test Service", qty: 1, price: 100 }
    ]
  };

  const res = await fetch("http://127.0.0.1:5005/api/invoices", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
  });
  console.log(res.status, await res.text());
}
run();
