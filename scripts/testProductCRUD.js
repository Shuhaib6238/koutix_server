const axios = require('axios');

/**
 * Script to test Product CRUD operations.
 * Requires a valid JWT token of a user with appropriate roles.
 */
async function testProductCRUD(token) {
  const PORT = process.env.PORT || 3000;
  const BASE_URL = `http://localhost:${PORT}/api/products`;

  if (!token) {
    console.error('❌ Error: JWT_TOKEN is required to run this test.');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('--- 🚀 Starting Product CRUD Test ---');

    // 1. Create Product
    const createRes = await axios.post(BASE_URL, {
      name: "Test Laptop",
      sku: "TEST-LPT-001",
      price: 2500,
      stock: 10,
      category: "Computers"
    }, { headers });
    const productId = createRes.data.product._id;
    console.log('✅ Create Product: Success', productId);

    // 2. Get Products
    const listRes = await axios.get(BASE_URL, { headers });
    console.log('✅ List Products: Success', `Count: ${listRes.data.length}`);

    // 3. Update Product
    const updateRes = await axios.put(`${BASE_URL}/${productId}`, {
      price: 2400
    }, { headers });
    console.log('✅ Update Product: Success', `New Price: ${updateRes.data.product.price}`);

    // 4. Delete Product
    await axios.delete(`${BASE_URL}/${productId}`, { headers });
    console.log('✅ Delete Product: Success');

    console.log('--- 🎉 All Tests Passed! ---');
  } catch (error) {
    console.error('--- ❌ Test Failed ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error Message:', error.message);
    }
  }
}

// To run this script:
// node -e "require('./scripts/testProductCRUD')('YOUR_JWT_TOKEN')"
module.exports = testProductCRUD;
