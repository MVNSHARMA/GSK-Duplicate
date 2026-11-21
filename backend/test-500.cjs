const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = mongoose.model('User', new mongoose.Schema({ role: String, status: String }, { strict: false }));
  const user = await User.findOne({});
  if (!user) {
    console.log("No user found");
    process.exit(1);
  }
  
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  
  const fs = require('fs');
  const FormData = require('form-data');
  const form = new FormData();
  form.append('customerInfo', JSON.stringify({ fullName: "Test User", email: "test@example.com", phone: "1234567890" }));
  form.append('vehicleInfo', JSON.stringify({ regNo: "TEST1234", make: "Toyota", model: "Corolla" }));
  form.append('services', JSON.stringify([]));
  form.append('description', "Test description");
  
  fs.writeFileSync('dummy.jpg', 'fake image content');
  form.append('images', fs.createReadStream('dummy.jpg'));
  
  fetch('http://localhost:5001/api/intake/quote', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...form.getHeaders()
    },
    body: form
  }).then(r => r.json()).then(data => {
    console.log("Response with file:", data);
    
    // Now test without file (JSON)
    return fetch('http://localhost:5001/api/intake/quote', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerInfo: { fullName: "Test User", email: "test2@example.com", phone: "1234567890" },
        vehicleInfo: { regNo: "TEST5678", make: "Toyota", model: "Corolla" },
        services: [],
        description: "Test description"
      })
    });
  }).then(r => r.json()).then(data => {
    console.log("Response without file:", data);
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
});
