require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

/**
 * Script to test the SAP Webhook integration locally.
 * This simulates SAP BTP sending an inventory update to the Node.js backend.
 */
async function testSapWebhook() {
  const PORT = process.env.PORT || 3001;
  const BASE_URL = `http://localhost:${PORT}/api/sap`;

  // Dummy IDs (Replace with real ones from your DB for a full flow test)
  const testPayload = {
    materialId: "SKU-TEST-99",
    quantity: 3, // Low quantity to trigger Firebase Notification logic
    branchId: new mongoose.Types.ObjectId(),
    orgId: new mongoose.Types.ObjectId()
  };

  console.log('--- 🚀 Starting SAP Webhook Test ---');
  console.log(`Target: ${BASE_URL}/sync-inventory`);
  
  try {
    const response = await axios.post(`${BASE_URL}/sync-inventory`, testPayload, {
      headers: {
        'x-sap-signature': 'test-signature-locally',
        'Content-Type': 'application/json'
      }
    });

    console.log('--- ✅ Test Result ---');
    console.log('Status:', response.status);
    console.log('Response Body:', response.data);
    
    console.log('\nNext Steps:');
    console.log(`1. Check MongoDB Product collection for: ${testPayload.materialId}`);
    console.log(`2. Check Firebase Firestore for org/branch updates`);
    console.log(`3. Check console logs for "Critical Stock Alert"`);
  } catch (error) {
    console.error('--- ❌ Test Failed ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Could not connect to the server. Is it running on port', PORT, '?');
      console.error('Tip: Run "npm run dev" in another terminal first.');
    } else {
      console.error('Error Details:', error.message);
      if (error.stack) console.error('Stack Trace:', error.stack);
    }
  }
}

testSapWebhook();
