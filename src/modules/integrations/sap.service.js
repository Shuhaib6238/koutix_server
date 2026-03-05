const axios = require('axios');
const sapConfig = require('../../config/sap.config');

class SAPService {
  constructor() {
    this.accessToken = null;
    this.expiresAt = null;
  }

  /**
   * Fetches OAuth 2.0 Access Token from SAP BTP XSUAA
   */
  async getAccessToken() {
    // Check if current token is still valid (with 30s buffer)
    if (this.accessToken && this.expiresAt && Date.now() < this.expiresAt - 30000) {
      return this.accessToken;
    }

    const { tokenUrl, clientId, clientSecret } = sapConfig.destinations.itRt;
    
    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post(
        tokenUrl,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Expires in seconds, convert to absolute timestamp
      this.expiresAt = Date.now() + (response.data.expires_in * 1000);
      
      console.log('✅ SAP Access Token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      console.error('❌ SAP Auth Error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with SAP BTP');
    }
  }

  /**
   * Generic SAP API Caller
   * @param {string} method HTTP Method
   * @param {string} endpoint iFlow/API Endpoint
   * @param {object} data Payload
   */
  async request(method, endpoint, data = null) {
    const token = await this.getAccessToken();
    const url = `${sapConfig.destinations.itRt.url}${endpoint}`;

    try {
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error(`❌ SAP API Error [${method} ${endpoint}]:`, error.response?.data || error.message);
      
      // Auto-retry once if unauthorized (token might have been revoked)
      if (error.response?.status === 401) {
        this.accessToken = null;
        return this.request(method, endpoint, data);
      }
      
      throw error;
    }
  }

  // Example: Sync Inventory
  async getMaterialStock(materialId) {
    return this.request('GET', `/InventorySync?MaterialId='${materialId}'`);
  }
}

module.exports = new SAPService();
