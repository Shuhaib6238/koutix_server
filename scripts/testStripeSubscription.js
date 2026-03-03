require('dotenv').config();
const axios = require('axios');

/**
 * STRIPE TESTING GUIDE
 * -------------------
 * Prerequisite: 
 * 1. Log in as a ChainManager to get a token.
 * 2. In .env, set:
 *    STRIPE_SECRET_KEY=sk_test_...
 *    STRIPE_PLAN_BASIC_ID=price_...
 *    FRONTEND_URL=http://localhost:3000
 */

const BASE_URL = 'http://localhost:3001/api';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjJjMjdhZmY1YzlkNGU1MzVkNWRjMmMwNWM1YTE2N2FlMmY1NjgxYzIiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoic2hpeWFzIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2tvdXRpeC01NzQ0NCIsImF1ZCI6ImtvdXRpeC01NzQ0NCIsImF1dGhfdGltZSI6MTc3MjM2NzEzNywidXNlcl9pZCI6IlRNS1JPbFVIUTJVQlM5QzhLR29UR3h2UUFsaTEiLCJzdWIiOiJUTUtST2xVSFEyVUJTOUM4S0dvVEd4dlFBbGkxIiwiaWF0IjoxNzcyMzY3MTM3LCJleHAiOjE3NzIzNzA3MzcsImVtYWlsIjoic2hpeWFzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJzaGl5YXNAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.WGM91uHYDogwqnYU0tlUgkVKZXFv-57dhDAVy6PFkP8ELFbmdUPQQayQP9x2MRD2aGxHghixTV2-31FIFNAKAoTBQIKHgf5EHIHmHRIEkH-VptP3SfvivQyT0HwyS7OwVnDFYEAKdNq8jXHYAE7xeR7HaMjd4Q1NIB1LzwUQ2hLGmCH4sveTfXJYoqV5_4lEhV13ZB0XXE_kK9WqPrUiddeLkzY8S5QIQ7j5ktp1d52Tyfki0ShOG6gnItU2uTl8h4tez1Dg3B0kng1_rl2GRuKxxVkiBqMpLSmHLtd5vfh6mR6Hm7v4plRmlftmeK7uqzqLd37oYmB3yqAOXehPoA'; // Replace with a real token

async function testSubscriptionFlow() {
  try {
    console.log('🚀 Starting Stripe Subscription Test...');

    // 1. Create Checkout Session
    console.log('📡 Requesting Checkout Session for BASIC plan...');
    const response = await axios.post(`${BASE_URL}/subscription/create-session`, 
      { planType: 'basic' },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    console.log('✅ Checkout Session Created!');
    console.log('🔗 URL:', response.data.url);
    console.log('\n👉 Open the URL above in your browser to complete the payment.');
    console.log('💡 Use Test Card: 4242 4242 4242 4242');

  } catch (error) {
    if (error.response) {
      console.error('❌ Test Failed (Server Response):', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Test Failed (Request Error):', error.message);
    }
  }
}

if (TOKEN === 'YOUR_CHAIN_MANAGER_TOKEN_HERE') {
  console.log('⚠️  Please replace TOKEN in this script with a valid ChainManager token from your server login.');
} else {
  testSubscriptionFlow();
}

/**
 * HOW TO TEST WEBHOOKS LOCALLY:
 * 1. Install Stripe CLI
 * 2. Run: stripe login
 * 3. Run: stripe listen --forward-to localhost:3001/api/webhooks
 * 4. Trigger event manually: stripe trigger checkout.session.completed
 */
