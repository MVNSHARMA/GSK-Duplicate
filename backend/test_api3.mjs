
async function run() {
  // 1. Login
  const loginRes = await fetch('http://localhost:5005/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gsk.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  if (!token) throw new Error('Login failed');

  // 2. Fetch inventory list
  const invRes = await fetch('http://localhost:5005/api/inventory', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const invData = await invRes.json();
  const item = invData.data[0];
  console.log('Got item ID:', item._id);

  // 3. Fetch specific item
  const detailRes = await fetch(`http://localhost:5005/api/inventory/${item._id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Detail Status:', detailRes.status);
  const detailData = await detailRes.json();
  console.log('Detail Data Keys:', Object.keys(detailData));
  if (detailData.data) console.log('Detail Data Item Keys:', Object.keys(detailData.data));
  console.log('Success:', detailData.success);
}

run().catch(console.error);
