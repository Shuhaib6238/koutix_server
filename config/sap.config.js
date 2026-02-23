require('dotenv').config();

module.exports = {
  destinations: {
    itRt: {
      url: process.env.SAP_IT_RT_URL,
      tokenUrl: process.env.SAP_TOKEN_URL,
      clientId: process.env.SAP_CLIENT_ID,
      clientSecret: process.env.SAP_CLIENT_SECRET
    }
  },
  webhooks: {
    secret: process.env.SAP_WEBHOOK_SECRET || 'koutix-sap-secret'
  },
  apiBase: process.env.SAP_API_BASE || '/http/koutix'
};
