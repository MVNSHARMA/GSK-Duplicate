import fs from 'fs';
import FormData from 'form-data';
import axios from 'axios';

import jwt from 'jsonwebtoken';

const API_URL = 'http://localhost:5005/api';
let token = '';

async function runTest() {
  try {
    console.log('1. Generating admin token...');
    token = jwt.sign({ id: '6ab3141601b6bf40d230904c' }, 'supersecret_jwt_key_placeholder', { expiresIn: '1h' });
    console.log('Token generated.');
    const headers = { Authorization: `Bearer ${token}` };

    console.log('\n2. Finding a vehicle...');
    const vehiclesRes = await axios.get(`${API_URL}/vehicles`, { headers });
    const vehicle = vehiclesRes.data.data[0];
    if (!vehicle) throw new Error('No vehicle found');
    const vehicleId = vehicle._id;
    console.log(`Using Vehicle ID: ${vehicleId}`);

    console.log('\n3. Uploading test document...');
    const form = new FormData();
    form.append('documentName', 'TEST PDF 2026 E2E');
    form.append('documentType', 'Other');
    form.append('expiryDate', '2026-12-31');
    form.append('document', fs.createReadStream('VEHICLE-DOC-TEST-2026.pdf'));
    
    const uploadRes = await axios.post(`${API_URL}/vehicles/${vehicleId}/documents`, form, {
      headers: { ...headers, ...form.getHeaders() }
    });
    const docId = uploadRes.data.data._id;
    console.log(`Document uploaded successfully. Document ID: ${docId}`);

    console.log('\n4. Testing VIEW operation...');
    const viewUrl = `${API_URL}/vehicles/documents/${docId}/file?token=${token}`;
    console.log(`GET ${viewUrl}`);
    const viewRes = await axios.get(viewUrl, { maxRedirects: 0, validateStatus: null });
    // It should redirect to Cloudinary
    console.log(`View Status: ${viewRes.status}`);
    console.log(`View Location Header: ${viewRes.headers.location}`);
    if (viewRes.status !== 302 || !viewRes.headers.location) {
      throw new Error('VIEW operation failed to redirect to Cloudinary');
    }
    
    // Now fetch the actual Cloudinary URL
    const cloudinaryViewRes = await axios.get(viewRes.headers.location, { responseType: 'arraybuffer' });
    console.log(`Cloudinary View Status: ${cloudinaryViewRes.status}`);
    console.log(`Cloudinary Content-Type: ${cloudinaryViewRes.headers['content-type']}`);
    console.log(`Cloudinary Content-Disposition: ${cloudinaryViewRes.headers['content-disposition'] || 'none (inline by default)'}`);
    
    const originalBuffer = fs.readFileSync('VEHICLE-DOC-TEST-2026.pdf');
    if (Buffer.compare(originalBuffer, cloudinaryViewRes.data) === 0) {
      console.log('✅ VIEW test passed! The downloaded binary perfectly matches the uploaded file.');
    } else {
      console.log('❌ VIEW test failed! The file contents differ.');
      console.log(`Original Size: ${originalBuffer.length}, Downloaded Size: ${cloudinaryViewRes.data.length}`);
    }

    console.log('\n5. Testing DOWNLOAD operation...');
    const downloadUrl = `${API_URL}/vehicles/documents/${docId}/file?download=true&token=${token}`;
    console.log(`GET ${downloadUrl}`);
    const downloadRes = await axios.get(downloadUrl, { maxRedirects: 0, validateStatus: null });
    console.log(`Download Status: ${downloadRes.status}`);
    console.log(`Download Location Header: ${downloadRes.headers.location}`);
    
    const cloudinaryDownloadRes = await axios.get(downloadRes.headers.location, { responseType: 'arraybuffer' });
    console.log(`Cloudinary Download Status: ${cloudinaryDownloadRes.status}`);
    console.log(`Cloudinary Content-Disposition: ${cloudinaryDownloadRes.headers['content-disposition']}`);
    if (cloudinaryDownloadRes.headers['content-disposition']?.includes('attachment')) {
      console.log('✅ DOWNLOAD test passed! The file is marked as an attachment.');
    } else {
      console.log('❌ DOWNLOAD test failed! Content-Disposition is not attachment.');
    }

    console.log('\n6. Testing DELETE operation...');
    const deleteRes = await axios.delete(`${API_URL}/vehicles/documents/${docId}`, { headers });
    console.log(`Delete Status: ${deleteRes.status}`);
    console.log(`Delete Response:`, deleteRes.data);
    if (deleteRes.data.success) {
      console.log('✅ DELETE test passed!');
    } else {
      console.log('❌ DELETE test failed!');
    }

    console.log('\n7. Verifying Deletion...');
    const verifyRes = await axios.get(`${API_URL}/vehicles/${vehicleId}/documents`, { headers });
    const stillExists = verifyRes.data.data.find(d => d._id === docId);
    if (!stillExists) {
      console.log('✅ Document successfully removed from Vehicle document list.');
    } else {
      console.log('❌ Document still appears in list after deletion.');
    }

  } catch (err) {
    console.error('Test Failed:', err.message);
    if (err.response) {
      console.error(err.response.data);
    }
  }
}

runTest();
